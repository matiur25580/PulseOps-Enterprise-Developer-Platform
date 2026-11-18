import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { DependenciesService } from './dependencies.service';
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-dependencies')
export class DependenciesController {
  constructor(private readonly dependencies: DependenciesService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.dependencies.list(user.tenantId); }
  @Post() @Roles('ADMIN') create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateDependencyDto) { return this.dependencies.create(user.tenantId, user.sub, body.sourceServiceId, body.targetServiceId); }
  @Delete(':id') @Roles('ADMIN') remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.dependencies.remove(user.tenantId, user.sub, id); }
}
