import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateSliSampleDto } from './dto/create-sli-sample.dto';
import { CreateSloDto } from './dto/create-slo.dto';
import { SlosService } from './slos.service';
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('slos')
export class SlosController {
  constructor(private readonly slos: SlosService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.slos.list(user.tenantId); }
  @Post('services/:serviceId') @Roles('ADMIN') create(@CurrentUser() user: AuthenticatedUser, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Body() body: CreateSloDto) { return this.slos.create(user.tenantId, user.sub, serviceId, body); }
  @Post(':id/samples') @Roles('ADMIN') sample(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateSliSampleDto) { return this.slos.addSample(user.tenantId, user.sub, id, body); }
  @Delete(':id') @Roles('ADMIN') remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.slos.remove(user.tenantId, user.sub, id); }
}
