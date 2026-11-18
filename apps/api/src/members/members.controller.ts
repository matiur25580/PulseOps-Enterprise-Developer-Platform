import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MembersService } from './members.service';
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('members')
export class MembersController {
 constructor(private readonly members:MembersService){}
 @Get() list(@CurrentUser() user:AuthenticatedUser){return this.members.list(user.tenantId)}
 @Post('invitations') @Roles('ADMIN') invite(@CurrentUser() user:AuthenticatedUser,@Body() body:CreateInvitationDto){return this.members.createInvitation(user.tenantId,user.sub,body)}
 @Delete('invitations/:id') @Roles('ADMIN') revoke(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string){return this.members.revokeInvitation(user.tenantId,id)}
 @Patch(':userId/role') @Roles('ADMIN') updateRole(@CurrentUser() user:AuthenticatedUser,@Param('userId',ParseUUIDPipe) userId:string,@Body() body:UpdateMemberRoleDto){return this.members.updateRole(user.tenantId,user.sub,userId,body)}
 @Delete(':userId') @Roles('ADMIN') remove(@CurrentUser() user:AuthenticatedUser,@Param('userId',ParseUUIDPipe) userId:string){return this.members.removeMember(user.tenantId,user.sub,userId)}
}
