import { ConflictException, NotFoundException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';

describe('IncidentsService escalation workflow', () => {
  let prisma: any;
  const audit = { record: jest.fn().mockResolvedValue({}) };
  let service: IncidentsService;
  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn(), updateMany: jest.fn() },
      escalationPolicy: { findUnique: jest.fn() },
      incidentEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    };
    service = new IncidentsService(prisma, audit as never);
  });

  it('records a level-one escalation and its audit event atomically', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', title: 'Payments down', status: 'OPEN', serviceId: 'service-1', escalationLevel: 0 });
    prisma.escalationPolicy.findUnique.mockResolvedValue({ primaryContactEmail: 'primary@example.com', secondaryContactEmail: 'secondary@example.com', escalationAfterMinutes: 15 });
    prisma.incident.updateMany.mockResolvedValue({ count: 1 });
    prisma.incident.findFirst.mockResolvedValueOnce({ id: 'incident-1', title: 'Payments down', status: 'OPEN', serviceId: 'service-1', escalationLevel: 0 }).mockResolvedValueOnce({ id: 'incident-1', escalationLevel: 1 });

    const result = await service.escalate('tenant-1', 'actor-1', 'incident-1');
    expect(prisma.incident.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'incident-1', tenantId: 'tenant-1', escalationLevel: 0 }),
      data: expect.objectContaining({ escalationLevel: 1 }),
    }));
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'ESCALATED', metadata: expect.objectContaining({ targetContact: 'primary@example.com' }) }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-1', action: 'INCIDENT_ESCALATED' }),
    }));
    expect(result).toEqual({ id: 'incident-1', escalationLevel: 1 });
  });

  it('does not escalate resolved incidents', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', status: 'RESOLVED', serviceId: 'service-1', escalationLevel: 0 });
    await expect(service.escalate('tenant-1', 'actor-1', 'incident-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.escalationPolicy.findUnique).not.toHaveBeenCalled();
  });

  it('does not allow escalation without a service or policy', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', status: 'OPEN', serviceId: null, escalationLevel: 0 });
    await expect(service.escalate('tenant-1', 'actor-1', 'incident-1')).rejects.toBeInstanceOf(ConflictException);
    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', status: 'OPEN', serviceId: 'service-1', escalationLevel: 0 });
    prisma.escalationPolicy.findUnique.mockResolvedValue(null);
    await expect(service.escalate('tenant-1', 'actor-1', 'incident-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses compare-and-set to prevent concurrent escalation levels', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', status: 'OPEN', serviceId: 'service-1', escalationLevel: 0 });
    prisma.escalationPolicy.findUnique.mockResolvedValue({ primaryContactEmail: 'primary@example.com', secondaryContactEmail: null, escalationAfterMinutes: 10 });
    prisma.incident.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.escalate('tenant-1', 'actor-1', 'incident-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
  });
});
