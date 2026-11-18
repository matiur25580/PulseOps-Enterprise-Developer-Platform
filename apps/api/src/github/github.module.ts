import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { DoraMetricsController, GitHubRepositoriesController, GitHubWebhookController } from './github.controller';
import { GitHubService } from './github.service';
@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [GitHubWebhookController, GitHubRepositoriesController, DoraMetricsController],
  providers: [GitHubService, RolesGuard],
})
export class GitHubModule {}
