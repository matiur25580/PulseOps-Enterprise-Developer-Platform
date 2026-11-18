import { NotFoundException } from '@nestjs/common';
import { FinopsService } from './finops.service';

describe('FinopsService cost import and budget evaluation', () => {
  let prisma: any;
  const audit = { record: jest.fn().mockResolvedValue({}) };
  let service: FinopsService;

  beforeEach(() => {
    prisma = {
      service: { findMany: jest.fn().mockResolvedValue([{ id: 'service-1' }]), findFirst: jest.fn() },
      costRecord: { upsert: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
      costBudget: { create: jest.fn(), findMany: jest.fn() },
      costBudgetEvent: { upsert: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    };
    jest.clearAllMocks();
    service = new FinopsService(prisma, audit as never);
  });

  it('imports normalized records idempotently within the authenticated tenant', async () => {
    const result = await service.importRecords('tenant-1', 'actor-1', [{
      provider: 'AWS' as any, sourceRecordId: 'line-001', resourceId: 'i-123',
      billingPeriodStart: '2026-11-01T00:00:00.000Z', costAmount: 12.5, currency: 'usd',
      serviceId: 'service-1', tags: { environment: 'staging' },
    }]);
    expect(result.recordsProcessed).toBe(1);
    expect(prisma.costRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_provider_sourceRecordId: { tenantId: 'tenant-1', provider: 'AWS', sourceRecordId: 'line-001' } },
      create: expect.objectContaining({ tenantId: 'tenant-1', currency: 'USD', serviceId: 'service-1' }),
    }));
  });

  it('rejects cost records assigned to a service outside the tenant', async () => {
    prisma.service.findMany.mockResolvedValue([]);
    await expect(service.importRecords('tenant-1', 'actor-1', [{
      provider: 'AWS' as any, sourceRecordId: 'line-002', resourceId: 'i-456',
      billingPeriodStart: '2026-11-01T00:00:00.000Z', costAmount: 1, currency: 'USD', serviceId: 'foreign-service',
    }])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.costRecord.upsert).not.toHaveBeenCalled();
  });

  it('returns service and provider totals without combining different currencies', async () => {
    prisma.costRecord.findMany.mockResolvedValue([
      { provider: 'AWS', currency: 'USD', costAmount: { toNumber: () => 10.25 }, serviceId: 'service-1', service: { id: 'service-1', name: 'Payments' } },
      { provider: 'GCP', currency: 'USD', costAmount: { toNumber: () => 4.75 }, serviceId: null, service: null },
      { provider: 'AWS', currency: 'EUR', costAmount: { toNumber: () => 3 }, serviceId: 'service-1', service: { id: 'service-1', name: 'Payments' } },
    ]);
    const result = await service.costSummary('tenant-1', '2026-11');
    expect(result.totalsByCurrency).toEqual([{ currency: 'USD', amount: 15 }, { currency: 'EUR', amount: 3 }]);
    expect(result.byService).toHaveLength(3);
    expect(result.note).toContain('no exchange-rate conversion');
  });

  it('records a budget threshold event only when spend reaches the configured threshold', async () => {
    prisma.costBudget.findMany.mockResolvedValue([
      { id: 'budget-1', amount: { toNumber: () => 100 }, currency: 'USD', thresholdPercent: 80, serviceId: 'service-1' },
    ]);
    prisma.costRecord.aggregate.mockResolvedValue({ _sum: { costAmount: { toNumber: () => 85 } }, _count: { _all: 4 } });
    const result = await service.evaluateBudgets('tenant-1', 'actor-1', '2026-11');
    expect(result.outcomes).toEqual([expect.objectContaining({ budgetId: 'budget-1', state: 'THRESHOLD_REACHED', actualAmount: 85, thresholdAmount: 80 })]);
    expect(prisma.costBudgetEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { budgetId_periodStart_thresholdPercent: { budgetId: 'budget-1', periodStart: new Date('2026-11-01T00:00:00.000Z'), thresholdPercent: 80 } },
    }));
  });

  it('reports NO_DATA instead of treating missing cost records as zero spend', async () => {
    prisma.costBudget.findMany.mockResolvedValue([
      { id: 'budget-2', amount: { toNumber: () => 50 }, currency: 'USD', thresholdPercent: 80, serviceId: null },
    ]);
    prisma.costRecord.aggregate.mockResolvedValue({ _sum: { costAmount: null }, _count: { _all: 0 } });
    const result = await service.evaluateBudgets('tenant-1', 'actor-1', '2026-11');
    expect(result.outcomes[0]).toMatchObject({ state: 'NO_DATA', actualAmount: null });
    expect(prisma.costBudgetEvent.upsert).not.toHaveBeenCalled();
  });
});
