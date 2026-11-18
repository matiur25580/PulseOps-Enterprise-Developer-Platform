import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRunbookDto } from './dto/create-runbook.dto';
import { UpsertEscalationPolicyDto } from './dto/upsert-escalation-policy.dto';
import { RunbooksService } from './runbooks.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('services/:serviceId')
export class RunbooksController {
  constructor(private readonly runbooks: RunbooksService) {}

  @Get('runbooks')
  list(@CurrentUser() user: AuthenticatedUser, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.runbooks.list(user.tenantId, serviceId);
  }

  @Post('runbooks') @Roles('ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Body() body: CreateRunbookDto) {
    return this.runbooks.create(user.tenantId, user.sub, serviceId, body);
  }

  @Delete('runbooks/:runbookId') @Roles('ADMIN')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Param('runbookId', ParseUUIDPipe) runbookId: string) {
    return this.runbooks.remove(user.tenantId, user.sub, serviceId, runbookId);
  }

  @Get('escalation-policy')
  getPolicy(@CurrentUser() user: AuthenticatedUser, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.runbooks.getPolicy(user.tenantId, serviceId);
  }

  @Put('escalation-policy') @Roles('ADMIN')
  upsertPolicy(@CurrentUser() user: AuthenticatedUser, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Body() body: UpsertEscalationPolicyDto) {
    return this.runbooks.upsertPolicy(user.tenantId, user.sub, serviceId, body);
  }
}
