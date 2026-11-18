import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
@Module({ imports: [AuthModule, AuditModule], controllers: [ServicesController], providers: [ServicesService, RolesGuard] })
export class ServicesModule {}
