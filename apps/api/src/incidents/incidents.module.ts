import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
@Module({ imports: [PrismaModule, AuthModule, AuditModule], controllers: [IncidentsController], providers: [IncidentsService, RolesGuard] })
export class IncidentsModule {}
