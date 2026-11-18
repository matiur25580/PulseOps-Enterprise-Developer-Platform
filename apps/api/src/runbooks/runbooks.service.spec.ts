import { ConflictException, NotFoundException } from '@nestjs/common';
import { RunbooksService } from './runbooks.service';

describe('RunbooksService tenant isolation and policy validation', () => {
  const prisma: any = {
    service: { findFirst: jest.fn() },
    runbookReference: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    escalationPolicy: { findUnique: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
  };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  let service: RunbooksService;
  beforeEach(() => { jest.clearAllMocks(); service = new RunbooksService(prisma, audit as never); prisma.service.findFirst.mockResolvedValue({ id: 'service-a' }); });

  it('scopes runbook listing to tenant and service', async () => {
    prisma.runbookReference.findMany.mockResolvedValue([]);
    await service.list('tenant-a', 'service-a');
    expect(prisma.runbookReference.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a', serviceId: 'service-a' } }));
  });

  it('rejects a service from another tenant', async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(service.list('tenant-a', 'service-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.runbookReference.findMany).not.toHaveBeenCalled();
  });

  it('clears the previous primary runbook before creating a new primary', async () => {
    prisma.runbookReference.create.mockResolvedValue({ id: 'runbook-1' });
    await service.create('tenant-a', 'actor-a', 'service-a', { title: 'Payments rollback', url: 'https://docs.example.com/payments/rollback', isPrimary: true });
    expect(prisma.runbookReference.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a', serviceId: 'service-a', isPrimary: true }, data: { isPrimary: false } }));
    expect(prisma.runbookReference.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a', serviceId: 'service-a', isPrimary: true }) }));
  });

  it('rejects identical primary and secondary escalation contacts', async () => {
    await expect(service.upsertPolicy('tenant-a', 'actor-a', 'service-a', {
      primaryContactEmail: 'oncall@example.com', secondaryContactEmail: 'ONCALL@example.com', escalationAfterMinutes: 15,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.escalationPolicy.upsert).not.toHaveBeenCalled();
  });

  it('upserts a tenant-scoped escalation policy', async () => {
    prisma.escalationPolicy.upsert.mockResolvedValue({ id: 'policy-1' });
    await service.upsertPolicy('tenant-a', 'actor-a', 'service-a', {
      primaryContactEmail: 'primary@example.com', secondaryContactEmail: 'secondary@example.com', escalationAfterMinutes: 20,
    });
    expect(prisma.escalationPolicy.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_serviceId: { tenantId: 'tenant-a', serviceId: 'service-a' } },
      create: expect.objectContaining({ primaryContactEmail: 'primary@example.com', escalationAfterMinutes: 20 }),
    }));
  });
});
