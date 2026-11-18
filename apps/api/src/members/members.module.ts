import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
@Module({imports:[AuthModule],controllers:[MembersController],providers:[MembersService,RolesGuard]})
export class MembersModule {}
