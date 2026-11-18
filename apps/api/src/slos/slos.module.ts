import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { SlosController } from './slos.controller';
import { SlosService } from './slos.service';
@Module({ imports: [AuthModule, AuditModule], controllers: [SlosController], providers: [SlosService, RolesGuard] })
export class SlosModule {}
