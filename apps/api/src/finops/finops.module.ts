import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { FinopsController } from './finops.controller';
import { FinopsService } from './finops.service';
@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [FinopsController],
  providers: [FinopsService, RolesGuard],
})
export class FinopsModule {}
