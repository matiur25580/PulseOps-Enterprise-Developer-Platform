import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { TeamsModule } from './teams/teams.module';

@Module({ imports: [PrismaModule, AuthModule, HealthModule, ServicesModule, TeamsModule] })
export class AppModule {}
