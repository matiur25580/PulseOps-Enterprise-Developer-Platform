import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('services')
export class ServicesController {
 constructor(private readonly services:ServicesService){}
 @Get() list(@CurrentUser() user:AuthenticatedUser){return this.services.list(user.tenantId)}
 @Post() @Roles('ADMIN') create(@CurrentUser() user:AuthenticatedUser,@Body() body:CreateServiceDto){return this.services.create(user.tenantId,body)}
 @Patch(':id') @Roles('ADMIN') update(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string,@Body() body:UpdateServiceDto){return this.services.update(user.tenantId,id,body)}
 @Delete(':id') @Roles('ADMIN') remove(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string){return this.services.remove(user.tenantId,id)}
}
