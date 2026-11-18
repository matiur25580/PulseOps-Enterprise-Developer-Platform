import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { AlertsService } from './alerts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.alerts.list(user.tenantId); }
  @Post('slos/:sloId/rules') @Roles('ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Param('sloId', ParseUUIDPipe) sloId: string, @Body() body: CreateAlertRuleDto) {
    return this.alerts.create(user.tenantId, user.sub, sloId, body);
  }
  @Patch(':id/enabled') @Roles('ADMIN')
  setEnabled(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { enabled: boolean }) {
    if (typeof body?.enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean');
    return this.alerts.setEnabled(user.tenantId, user.sub, id, body.enabled);
  }
  @Post('evaluate') @Roles('ADMIN')
  evaluate(@CurrentUser() user: AuthenticatedUser) { return this.alerts.evaluate(user.tenantId, user.sub); }
  @Get(':id/events') events(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.alerts.events(user.tenantId, id); }
}
