import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { AppRole, ROLES_KEY } from '../decorators/roles.decorator';
@Injectable()
export class RolesGuard implements CanActivate {
 constructor(private readonly reflector:Reflector){}
 canActivate(context:ExecutionContext):boolean{
  const required=this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY,[context.getHandler(),context.getClass()]);
  if(!required?.length)return true;
  const request=context.switchToHttp().getRequest<{user?:AuthenticatedUser}>();
  if(!request.user||!required.includes(request.user.role))throw new ForbiddenException('Insufficient workspace role');
  return true;
 }
}
