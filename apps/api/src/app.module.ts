import { Module } from '@nestjs/common';
import { AlertsModule } from './alerts/alerts.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { SlosModule } from './slos/slos.module';
import { ObservabilityModule } from './observability/observability.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { TeamsModule } from './teams/teams.module';

@Module({ imports: [PrismaModule, AlertsModule, AuthModule, HealthModule, ServicesModule, TeamsModule, MembersModule, AuditModule, IncidentsModule, DependenciesModule, SlosModule, ObservabilityModule] })
export class AppModule {}
