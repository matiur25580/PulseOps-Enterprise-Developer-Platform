import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export interface AuthenticatedUser { sub:string; email:string; tenantId:string; tenantSlug:string; role:'ADMIN'|'MEMBER'; }
@Injectable()
export class JwtAuthGuard implements CanActivate {
 constructor(private readonly jwt:JwtService,private readonly prisma:PrismaService){}
 async canActivate(context:ExecutionContext):Promise<boolean>{
  const request=context.switchToHttp().getRequest<{headers:{authorization?:string};user?:AuthenticatedUser}>();
  const [scheme,token]=(request.headers.authorization??'').split(' ');
  if(scheme!=='Bearer'||!token)throw new UnauthorizedException('Bearer token required');
  try{
   const claims=await this.jwt.verifyAsync<AuthenticatedUser>(token);
   if(!claims.sub||!claims.tenantId||!claims.email)throw new Error('Invalid claims');
   const membership=await this.prisma.tenantMembership.findUnique({where:{userId_tenantId:{userId:claims.sub,tenantId:claims.tenantId}},include:{tenant:{select:{slug:true}}}});
   if(!membership)throw new Error('Membership revoked');
   request.user={...claims,role:membership.role,tenantSlug:membership.tenant.slug};return true;
  }catch{throw new UnauthorizedException('Invalid, expired, or revoked workspace access')}
 }
}
