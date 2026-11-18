import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
@Module({ imports: [PrismaModule, AuthModule, AuditModule], controllers: [AlertsController], providers: [AlertsService, RolesGuard] })
export class AlertsModule {}
