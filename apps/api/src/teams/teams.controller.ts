import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('teams')
export class TeamsController {
 constructor(private readonly teams:TeamsService){}
 @Get() list(@CurrentUser() user:AuthenticatedUser){return this.teams.list(user.tenantId)}
 @Post() @Roles('ADMIN') create(@CurrentUser() user:AuthenticatedUser,@Body() body:CreateTeamDto){return this.teams.create(user.tenantId,user.sub,body)}
 @Patch(':id') @Roles('ADMIN') update(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string,@Body() body:UpdateTeamDto){return this.teams.update(user.tenantId,user.sub,id,body)}
 @Delete(':id') @Roles('ADMIN') remove(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string){return this.teams.remove(user.tenantId,user.sub,id)}
}
