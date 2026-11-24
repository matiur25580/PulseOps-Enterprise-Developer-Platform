import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export interface AuthenticatedUser{sub:string;email:string;tenantId:string;tenantSlug:string;role:'ADMIN'|'MEMBER';sid:string;}
@Injectable()
// Authenticate each protected request and attach the verified principal for downstream authorization.
export class JwtAuthGuard implements CanActivate{
 constructor(private readonly jwt:JwtService,private readonly prisma:PrismaService){}
 async canActivate(context:ExecutionContext):Promise<boolean>{
  const req=context.switchToHttp().getRequest<{headers:{authorization?:string};user?:AuthenticatedUser}>();const[scheme,token]=(req.headers.authorization??'').split(' ');
  if(scheme!=='Bearer'||!token)throw new UnauthorizedException('Bearer token required');
  try{
   const claims=await this.jwt.verifyAsync<AuthenticatedUser>(token);
   if(!claims.sub||!claims.tenantId||!claims.email||!claims.sid)throw new Error('Invalid claims');
   const[membership,session]=await Promise.all([
    this.prisma.tenantMembership.findUnique({where:{userId_tenantId:{userId:claims.sub,tenantId:claims.tenantId}},include:{tenant:{select:{slug:true}}}}),
    this.prisma.authSession.findFirst({where:{id:claims.sid,userId:claims.sub,tenantId:claims.tenantId,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true}})
   ]);
   if(!membership||!session)throw new Error('Revoked session');
   req.user={...claims,role:membership.role,tenantSlug:membership.tenant.slug};return true;
  }catch{throw new UnauthorizedException('Invalid, expired, or revoked workspace access');}
 }
}
