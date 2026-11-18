import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
@Module({imports:[AuthModule,AuditModule],controllers:[MembersController],providers:[MembersService,RolesGuard]})
export class MembersModule {}
