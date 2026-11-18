import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCostBudgetDto } from './dto/create-cost-budget.dto';
import { CostRecordDto } from './dto/cost-record.dto';

@Injectable()
export class FinopsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async importRecords(tenantId: string, actorId: string, records: CostRecordDto[]) {
    const serviceIds = [...new Set(records.map(row => row.serviceId).filter((id): id is string => Boolean(id)))];
    if (serviceIds.length) {
      const services = await this.prisma.service.findMany({ where: { tenantId, id: { in: serviceIds } }, select: { id: true } });
      if (services.length !== serviceIds.length) throw new NotFoundException('One or more services are not in this workspace');
    }
    const imported = await this.prisma.$transaction(async tx => {
      let count = 0;
      for (const row of records) {
        const period = new Date(row.billingPeriodStart);
        if (period.getUTCDate() !== 1) throw new BadRequestException('billingPeriodStart must be the first day of a month');
        await tx.costRecord.upsert({
          where: { tenantId_provider_sourceRecordId: { tenantId, provider: row.provider, sourceRecordId: row.sourceRecordId } },
          create: {
            tenantId, serviceId: row.serviceId, provider: row.provider, sourceRecordId: row.sourceRecordId,
            resourceId: row.resourceId, resourceName: row.resourceName, region: row.region,
            billingPeriodStart: period, costAmount: new Prisma.Decimal(row.costAmount),
            currency: row.currency.toUpperCase(), tags: row.tags as Prisma.InputJsonValue | undefined,
          },
          update: {
            serviceId: row.serviceId ?? null, resourceId: row.resourceId, resourceName: row.resourceName ?? null,
            region: row.region ?? null, billingPeriodStart: period,
            costAmount: new Prisma.Decimal(row.costAmount), currency: row.currency.toUpperCase(),
            tags: row.tags as Prisma.InputJsonValue | undefined, importedAt: new Date(),
          },
        });
        count += 1;
      }
      return count;
    }, { timeout: 15000 });
    await this.audit.record({ tenantId, actorId, action: 'CLOUD_COSTS_IMPORTED', entityType: 'COST_IMPORT', metadata: { recordsProcessed: imported } });
    return { recordsProcessed: imported, idempotency: 'tenant + provider + sourceRecordId' };
  }

  async costSummary(tenantId: string, requestedPeriod?: string) {
    const period = requestedPeriod ?? this.currentPeriod();
    const range = this.periodRange(period);
    const rows = await this.prisma.costRecord.findMany({
      where: { tenantId, billingPeriodStart: { gte: range.start, lt: range.end } },
      include: { service: { select: { id: true, name: true } } },
      orderBy: [{ provider: 'asc' }, { resourceId: 'asc' }],
    });
    const byCurrency = new Map<string, number>();
    const byProvider = new Map<string, number>();
    const byService = new Map<string, { serviceId: string | null; serviceName: string; currency: string; amount: number }>();
    for (const row of rows) {
      const amount = row.costAmount.toNumber();
      byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + amount);
      const providerKey = row.provider + ':' + row.currency;
      byProvider.set(providerKey, (byProvider.get(providerKey) ?? 0) + amount);
      const serviceKey = (row.serviceId ?? 'unallocated') + ':' + row.currency;
      const previous = byService.get(serviceKey);
      byService.set(serviceKey, {
        serviceId: row.serviceId,
        serviceName: row.service?.name ?? 'Unallocated',
        currency: row.currency,
        amount: (previous?.amount ?? 0) + amount,
      });
    }
    return {
      period,
      generatedAt: new Date().toISOString(),
      recordCount: rows.length,
      totalsByCurrency: [...byCurrency].map(([currency, amount]) => ({ currency, amount: Number(amount.toFixed(6)) })),
      byProvider: [...byProvider].map(([key, amount]) => {
        const [provider, currency] = key.split(':');
        return { provider, currency, amount: Number(amount.toFixed(6)) };
      }),
      byService: [...byService.values()].map(row => ({ ...row, amount: Number(row.amount.toFixed(6)) })),
      note: 'Currencies are reported separately; no exchange-rate conversion is applied.',
    };
  }

  async createBudget(tenantId: string, actorId: string, input: CreateCostBudgetDto) {
    if (input.serviceId) {
      const service = await this.prisma.service.findFirst({ where: { id: input.serviceId, tenantId }, select: { id: true } });
      if (!service) throw new NotFoundException('Service not found in this workspace');
    }
    try {
      const budget = await this.prisma.costBudget.create({
        data: {
          tenantId, serviceId: input.serviceId, name: input.name.trim(),
          amount: new Prisma.Decimal(input.amount), currency: input.currency.toUpperCase(),
          thresholdPercent: input.thresholdPercent ?? 80,
        },
      });
      await this.audit.record({ tenantId, actorId, action: 'COST_BUDGET_CREATED', entityType: 'COST_BUDGET', entityId: budget.id });
      return budget;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A budget with this name already exists in this workspace');
      }
      throw error;
    }
  }

  async listBudgets(tenantId: string, requestedPeriod?: string) {
    const period = requestedPeriod ?? this.currentPeriod();
    const range = this.periodRange(period);
    const budgets = await this.prisma.costBudget.findMany({
      where: { tenantId }, include: { service: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' },
    });
    return Promise.all(budgets.map(async budget => {
      const aggregate = await this.prisma.costRecord.aggregate({
        where: {
          tenantId, currency: budget.currency,
          billingPeriodStart: { gte: range.start, lt: range.end },
          ...(budget.serviceId ? { serviceId: budget.serviceId } : {}),
        },
        _sum: { costAmount: true }, _count: { _all: true },
      });
      const actual = aggregate._sum.costAmount?.toNumber() ?? 0;
      const amount = budget.amount.toNumber();
      return {
        ...budget,
        amount,
        actualAmount: Number(actual.toFixed(6)),
        utilizationPercent: amount ? Number((actual / amount * 100).toFixed(2)) : null,
        recordCount: aggregate._count._all,
        period,
        service: budget.service,
      };
    }));
  }

  async evaluateBudgets(tenantId: string, actorId: string, requestedPeriod?: string) {
    const period = requestedPeriod ?? this.currentPeriod();
    const range = this.periodRange(period);
    const budgets = await this.prisma.costBudget.findMany({ where: { tenantId, enabled: true } });
    const outcomes = [];
    for (const budget of budgets) {
      const aggregate = await this.prisma.costRecord.aggregate({
        where: {
          tenantId, currency: budget.currency,
          billingPeriodStart: { gte: range.start, lt: range.end },
          ...(budget.serviceId ? { serviceId: budget.serviceId } : {}),
        },
        _sum: { costAmount: true }, _count: { _all: true },
      });
      const actual = aggregate._sum.costAmount?.toNumber() ?? 0;
      const budgetAmount = budget.amount.toNumber();
      if (aggregate._count._all === 0) {
        outcomes.push({ budgetId: budget.id, state: 'NO_DATA', actualAmount: null, thresholdAmount: Number((budgetAmount * budget.thresholdPercent / 100).toFixed(6)) });
        continue;
      }
      const thresholdAmount = budgetAmount * budget.thresholdPercent / 100;
      if (actual < thresholdAmount) {
        outcomes.push({ budgetId: budget.id, state: 'BELOW_THRESHOLD', actualAmount: Number(actual.toFixed(6)), thresholdAmount: Number(thresholdAmount.toFixed(6)) });
        continue;
      }
      await this.prisma.costBudgetEvent.upsert({
        where: { budgetId_periodStart_thresholdPercent: { budgetId: budget.id, periodStart: range.start, thresholdPercent: budget.thresholdPercent } },
        create: { budgetId: budget.id, periodStart: range.start, actualAmount: new Prisma.Decimal(actual), thresholdPercent: budget.thresholdPercent },
        update: { actualAmount: new Prisma.Decimal(actual) },
      });
      outcomes.push({ budgetId: budget.id, state: 'THRESHOLD_REACHED', actualAmount: Number(actual.toFixed(6)), thresholdAmount: Number(thresholdAmount.toFixed(6)) });
    }
    await this.audit.record({ tenantId, actorId, action: 'COST_BUDGETS_EVALUATED', entityType: 'COST_BUDGET', metadata: { period, budgetsEvaluated: budgets.length } });
    return { period, evaluatedAt: new Date().toISOString(), budgetsEvaluated: budgets.length, outcomes };
  }

  private currentPeriod() {
    const now = new Date();
    return now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
  }

  private periodRange(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('period must use YYYY-MM format');
    const [year, month] = period.split('-').map(Number);
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }
}
