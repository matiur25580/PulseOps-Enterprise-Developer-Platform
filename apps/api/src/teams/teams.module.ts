import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
@Module({ imports: [AuthModule], controllers: [TeamsController], providers: [TeamsService, RolesGuard] })
export class TeamsModule {}
