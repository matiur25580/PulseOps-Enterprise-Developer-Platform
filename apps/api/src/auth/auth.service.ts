import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
@Injectable()
export class AuthService {
 constructor(private readonly prisma:PrismaService,private readonly jwt:JwtService){}
 async register(input:RegisterDto){
  const email=input.email.trim().toLowerCase();
  const existing=await this.prisma.user.findUnique({where:{email},select:{id:true}});
  if(existing)throw new ConflictException('An account with this email already exists');
  const baseSlug=input.tenantName.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'workspace';
  const passwordHash=await hash(input.password,12);
  const tenant=await this.prisma.$transaction(async tx=>{
   const createdTenant=await tx.tenant.create({data:{name:input.tenantName.trim(),slug:`${baseSlug}-${randomUUID().slice(0,8)}`}});
   const user=await tx.user.create({data:{email,name:input.name.trim(),passwordHash}});
   await tx.tenantMembership.create({data:{userId:user.id,tenantId:createdTenant.id,role:'ADMIN'}});
   return {...createdTenant,user};
  });
  return this.issueToken(tenant.user,tenant.id,tenant.slug,'ADMIN');
 }
 async login(input:LoginDto){
  const user=await this.prisma.user.findUnique({where:{email:input.email.trim().toLowerCase()},include:{memberships:{include:{tenant:true}}}});
  if(!user||!(await compare(input.password,user.passwordHash)))throw new UnauthorizedException('Invalid email or password');
  const membership=user.memberships.find(item=>item.tenant.slug===input.tenantSlug);
  if(!membership)throw new UnauthorizedException('Invalid email or password');
  return this.issueToken(user,membership.tenantId,membership.tenant.slug,membership.role);
 }
 async acceptInvitation(input:AcceptInvitationDto){
  const email=input.email.trim().toLowerCase();
  const tokenHash=createHash('sha256').update(input.token).digest('hex');
  return this.prisma.$transaction(async tx=>{
   const invitation=await tx.workspaceInvitation.findFirst({where:{email,tokenHash,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},include:{tenant:true}});
   if(!invitation)throw new UnauthorizedException('Invitation is invalid, expired, or revoked');
   const claimed=await tx.workspaceInvitation.updateMany({where:{id:invitation.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date()}});
   if(claimed.count!==1)throw new ConflictException('Invitation has already been used');
   let user=await tx.user.findUnique({where:{email}});
   if(user){if(!(await compare(input.password,user.passwordHash)))throw new UnauthorizedException('Use the existing account password to accept this invitation')}
   else{user=await tx.user.create({data:{email,name:input.name.trim(),passwordHash:await hash(input.password,12)}})}
   const membership=await tx.tenantMembership.findUnique({where:{userId_tenantId:{userId:user.id,tenantId:invitation.tenantId}}});
   if(membership)throw new ConflictException('This account is already a workspace member');
   await tx.tenantMembership.create({data:{userId:user.id,tenantId:invitation.tenantId,role:'MEMBER'}});
   return this.issueToken(user,invitation.tenantId,invitation.tenant.slug,'MEMBER');
  });
 }
 private issueToken(user:{id:string;email:string;name:string},tenantId:string,tenantSlug:string,role:string){
  const accessToken=this.jwt.sign({sub:user.id,email:user.email,tenantId,tenantSlug,role});
  return {accessToken,tokenType:'Bearer',expiresIn:3600,user:{id:user.id,email:user.email,name:user.name},tenant:{id:tenantId,slug:tenantSlug},role};
 }
}
