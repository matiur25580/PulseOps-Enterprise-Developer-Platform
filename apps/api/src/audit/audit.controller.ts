import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get()
  @Roles('ADMIN')
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsed = Number(limit ?? 50);
    return this.audit.list(user.tenantId, Number.isFinite(parsed) ? parsed : 50);
  }
}
