import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: 'ADMIN' | 'MEMBER';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthenticatedUser }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Bearer token required');
    try {
      const claims = await this.jwt.verifyAsync<AuthenticatedUser>(token);
      if (!claims.sub || !claims.tenantId || !claims.email) throw new Error('Invalid claims');
      request.user = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
