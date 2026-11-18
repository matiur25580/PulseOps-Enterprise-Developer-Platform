import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.incidents.list(user.tenantId); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateIncidentDto) { return this.incidents.create(user.tenantId, user.sub, body); }
  @Patch(':id/assign') assign(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AssignIncidentDto) { return this.incidents.assign(user.tenantId, user.sub, id, body); }
  @Post(':id/acknowledge') acknowledge(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.incidents.acknowledge(user.tenantId, user.sub, id); }
  @Post(':id/resolve') resolve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { message?: string }) { return this.incidents.resolve(user.tenantId, user.sub, id, body?.message); }
}
