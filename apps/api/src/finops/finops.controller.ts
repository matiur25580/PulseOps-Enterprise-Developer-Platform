import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCostBudgetDto } from './dto/create-cost-budget.dto';
import { CostPeriodDto } from './dto/cost-period.dto';
import { ImportCostRecordsDto } from './dto/import-cost-records.dto';
import { FinopsService } from './finops.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finops')
export class FinopsController {
  constructor(private readonly finops: FinopsService) {}

  @Post('cost-records/import') @Roles('ADMIN')
  importRecords(@CurrentUser() user: AuthenticatedUser, @Body() body: ImportCostRecordsDto) {
    return this.finops.importRecords(user.tenantId, user.sub, body.records);
  }

  @Get('costs')
  costs(@CurrentUser() user: AuthenticatedUser, @Query() query: CostPeriodDto) {
    return this.finops.costSummary(user.tenantId, query.period);
  }

  @Get('budgets')
  budgets(@CurrentUser() user: AuthenticatedUser, @Query() query: CostPeriodDto) {
    return this.finops.listBudgets(user.tenantId, query.period);
  }

  @Post('budgets') @Roles('ADMIN')
  createBudget(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCostBudgetDto) {
    return this.finops.createBudget(user.tenantId, user.sub, body);
  }

  @Post('budgets/evaluate') @Roles('ADMIN')
  evaluateBudgets(@CurrentUser() user: AuthenticatedUser, @Query() query: CostPeriodDto) {
    return this.finops.evaluateBudgets(user.tenantId, user.sub, query.period);
  }
}
