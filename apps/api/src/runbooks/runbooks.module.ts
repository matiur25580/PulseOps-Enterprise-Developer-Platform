import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RunbooksController } from './runbooks.controller';
import { RunbooksService } from './runbooks.service';
@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [RunbooksController],
  providers: [RunbooksService, RolesGuard],
})
export class RunbooksModule {}
