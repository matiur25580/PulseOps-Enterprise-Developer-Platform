import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { TeamsModule } from './teams/teams.module';

@Module({ imports: [PrismaModule, AuthModule, HealthModule, ServicesModule, TeamsModule, MembersModule, AuditModule, IncidentsModule] })
export class AppModule {}
