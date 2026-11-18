import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
@Module({ imports: [AuthModule, AuditModule], controllers: [DependenciesController], providers: [DependenciesService, RolesGuard] })
export class DependenciesModule {}
