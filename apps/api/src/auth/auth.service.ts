import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
const ACCESS_TOKEN_SECONDS=900, REFRESH_TOKEN_DAYS=30;
type SessionUser={id:string;email:string;name:string}; type SessionTenant={id:string;slug:string};
@Injectable()
export class AuthService {
 constructor(private readonly prisma:PrismaService,private readonly jwt:JwtService){}
 // Store rate-limit counters in PostgreSQL so limits remain consistent across API instances.
 async assertRateLimit(scope:string,subject:string,limit:number,windowSeconds:number):Promise<void>{
  const key=createHash('sha256').update(`pulseops:${scope}:${subject}`).digest('hex');
  await this.prisma.$executeRaw`
   INSERT INTO auth_rate_limit_buckets ("key","window_started_at","request_count","blocked_until") VALUES (${key},NOW(),1,NULL)
   ON CONFLICT ("key") DO UPDATE SET
   "window_started_at"=CASE WHEN auth_rate_limit_buckets."window_started_at"<=NOW()-(${windowSeconds}*INTERVAL '1 second') THEN NOW() ELSE auth_rate_limit_buckets."window_started_at" END,
   "request_count"=CASE WHEN auth_rate_limit_buckets."window_started_at"<=NOW()-(${windowSeconds}*INTERVAL '1 second') THEN 1 ELSE auth_rate_limit_buckets."request_count"+1 END,
   "blocked_until"=CASE WHEN auth_rate_limit_buckets."blocked_until">NOW() THEN auth_rate_limit_buckets."blocked_until" WHEN auth_rate_limit_buckets."window_started_at"<=NOW()-(${windowSeconds}*INTERVAL '1 second') THEN NULL WHEN auth_rate_limit_buckets."request_count"+1>${limit} THEN NOW()+(${windowSeconds}*INTERVAL '1 second') ELSE NULL END
  `;
  const rows=await this.prisma.$queryRaw<Array<{blocked_until:Date|null}>>`SELECT "blocked_until" FROM auth_rate_limit_buckets WHERE "key"=${key}`;
  if(rows[0]?.blocked_until&&rows[0].blocked_until>new Date())throw new HttpException('Too many authentication attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
 }
 async register(input:RegisterDto){
  const email=input.email.trim().toLowerCase();
  if(await this.prisma.user.findUnique({where:{email},select:{id:true}}))throw new ConflictException('An account with this email already exists');
  const baseSlug=input.tenantName.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'workspace';
  const passwordHash=await hash(input.password,12);
  const result=await this.prisma.$transaction(async tx=>{const tenant=await tx.tenant.create({data:{name:input.tenantName.trim(),slug:`${baseSlug}-${randomUUID().slice(0,8)}`}});const user=await tx.user.create({data:{email,name:input.name.trim(),passwordHash}});await tx.tenantMembership.create({data:{userId:user.id,tenantId:tenant.id,role:'ADMIN'}});return{user,tenant,role:'ADMIN'};});
  return this.issueSession(result.user,result.tenant,result.role);
 }
 async login(input:LoginDto){
  const user=await this.prisma.user.findUnique({where:{email:input.email.trim().toLowerCase()},include:{memberships:{include:{tenant:true}}}});
  if(!user||!(await compare(input.password,user.passwordHash)))throw new UnauthorizedException('Invalid email or password');
  const workspaceIdentifier=input.tenantSlug.trim().toLowerCase();
  const matches=user.memberships.filter(item=>item.tenant.slug.toLowerCase()===workspaceIdentifier||item.tenant.name.trim().toLowerCase()===workspaceIdentifier);
  if(matches.length!==1)throw new UnauthorizedException('Invalid email or password');
  const membership=matches[0];
  return this.issueSession(user,membership.tenant,membership.role);
 }
 async acceptInvitation(input:AcceptInvitationDto){
  const email=input.email.trim().toLowerCase(),tokenHash=createHash('sha256').update(input.token).digest('hex');
  const result=await this.prisma.$transaction(async tx=>{
   const invitation=await tx.workspaceInvitation.findFirst({where:{email,tokenHash,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},include:{tenant:true}});
   if(!invitation)throw new UnauthorizedException('Invitation is invalid, expired, or revoked');
   const claimed=await tx.workspaceInvitation.updateMany({where:{id:invitation.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date()}});
   if(claimed.count!==1)throw new ConflictException('Invitation has already been used');
   let user=await tx.user.findUnique({where:{email}});
   if(user){if(!(await compare(input.password,user.passwordHash)))throw new UnauthorizedException('Use the existing account password to accept this invitation');}
   else user=await tx.user.create({data:{email,name:input.name.trim(),passwordHash:await hash(input.password,12)}});
   if(await tx.tenantMembership.findUnique({where:{userId_tenantId:{userId:user.id,tenantId:invitation.tenantId}}}))throw new ConflictException('This account is already a workspace member');
   await tx.tenantMembership.create({data:{userId:user.id,tenantId:invitation.tenantId,role:'MEMBER'}});
   return{user,tenant:invitation.tenant,role:'MEMBER'};
  });
  return this.issueSession(result.user,result.tenant,result.role);
 }
 async refresh(rawToken:string){
  if(!rawToken||rawToken.length>256)throw new UnauthorizedException('Refresh token is invalid or expired');
  const rotated=await this.prisma.$transaction(async tx=>{
   const current=await tx.authSession.findUnique({where:{tokenHash:this.hashToken(rawToken)},include:{user:true,tenant:true}});
   if(!current)return{invalid:true as const};
   if(current.revokedAt){await tx.authSession.updateMany({where:{familyId:current.familyId,revokedAt:null},data:{revokedAt:new Date()}});return{replay:true as const};}
   if(current.expiresAt<=new Date()){await tx.authSession.updateMany({where:{id:current.id,revokedAt:null},data:{revokedAt:new Date()}});return{invalid:true as const};}
   const membership=await tx.tenantMembership.findUnique({where:{userId_tenantId:{userId:current.userId,tenantId:current.tenantId}},include:{tenant:true}});
   if(!membership){await tx.authSession.updateMany({where:{id:current.id,revokedAt:null},data:{revokedAt:new Date()}});return{invalid:true as const};}
   const refreshToken=randomBytes(48).toString('base64url'),nextId=randomUUID();
   const claimed=await tx.authSession.updateMany({where:{id:current.id,revokedAt:null,expiresAt:{gt:new Date()}},data:{revokedAt:new Date(),replacedById:nextId,lastUsedAt:new Date()}});
   if(claimed.count!==1){await tx.authSession.updateMany({where:{familyId:current.familyId,revokedAt:null},data:{revokedAt:new Date()}});return{replay:true as const};}
   await tx.authSession.create({data:{id:nextId,userId:current.userId,tenantId:current.tenantId,familyId:current.familyId,tokenHash:this.hashToken(refreshToken),expiresAt:new Date(Date.now()+REFRESH_TOKEN_DAYS*86400000)}});
   return{user:current.user,tenant:membership.tenant,role:membership.role,sessionId:nextId,refreshToken} as const;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if('invalid'in rotated||'replay'in rotated)throw new UnauthorizedException('Refresh token is invalid, expired, or already used');
  return this.issueAccessToken(rotated.user,rotated.tenant,rotated.role,rotated.sessionId,rotated.refreshToken);
 }
 async logout(token?:string){if(token)await this.prisma.authSession.updateMany({where:{tokenHash:this.hashToken(token),revokedAt:null},data:{revokedAt:new Date()}});return{loggedOut:true};}
 async logoutAll(userId:string,tenantId:string){const r=await this.prisma.authSession.updateMany({where:{userId,tenantId,revokedAt:null},data:{revokedAt:new Date()}});return{revokedSessions:r.count};}
 listSessions(userId:string,tenantId:string){return this.prisma.authSession.findMany({where:{userId,tenantId,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true,createdAt:true,lastUsedAt:true,expiresAt:true},orderBy:{createdAt:'desc'}});}
 async revokeSession(userId:string,tenantId:string,id:string){const r=await this.prisma.authSession.updateMany({where:{id,userId,tenantId,revokedAt:null},data:{revokedAt:new Date()}});if(!r.count)throw new UnauthorizedException('Session not found or already revoked');return{revoked:true,sessionId:id};}
 private async issueSession(user:SessionUser,tenant:SessionTenant,role:string){
  const sid=randomUUID(),refreshToken=randomBytes(48).toString('base64url');
  await this.prisma.authSession.create({data:{id:sid,userId:user.id,tenantId:tenant.id,familyId:randomUUID(),tokenHash:this.hashToken(refreshToken),expiresAt:new Date(Date.now()+REFRESH_TOKEN_DAYS*86400000)}});
  return this.issueAccessToken(user,tenant,role,sid,refreshToken);
 }
 private issueAccessToken(user:SessionUser,tenant:SessionTenant,role:string,sid:string,refreshToken:string){
  const accessToken=this.jwt.sign({sub:user.id,email:user.email,tenantId:tenant.id,tenantSlug:tenant.slug,role,sid});
  return{accessToken,refreshToken,tokenType:'Bearer',expiresIn:ACCESS_TOKEN_SECONDS,user:{id:user.id,email:user.email,name:user.name},tenant:{id:tenant.id,slug:tenant.slug},role};
 }
 private hashToken(token:string){return createHash('sha256').update(token).digest('hex');}
}
