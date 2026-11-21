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
      tenantMembership: { findUnique: jest.fn() },
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

  it('acknowledges an incident with its event and audit entry in one transaction', async () => {
    prisma.incident.findFirst.mockResolvedValueOnce({ id: 'incident-1', status: 'OPEN' }).mockResolvedValueOnce({ id: 'incident-1', status: 'ACKNOWLEDGED' });
    prisma.incident.updateMany.mockResolvedValue({ count: 1 });

    await service.acknowledge('tenant-1', 'actor-1', 'incident-1');

    expect(prisma.incident.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'incident-1', tenantId: 'tenant-1', status: 'OPEN' },
    }));
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'ACKNOWLEDGED' }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'INCIDENT_ACKNOWLEDGED' }),
    }));
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects a stale acknowledgement without writing an event or audit entry', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', status: 'OPEN' });
    prisma.incident.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.acknowledge('tenant-1', 'actor-1', 'incident-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('resolves an incident atomically and rejects concurrent resolution attempts', async () => {
    prisma.incident.findFirst.mockResolvedValueOnce({ id: 'incident-1', status: 'ACKNOWLEDGED' }).mockResolvedValueOnce({ id: 'incident-1', status: 'RESOLVED' });
    prisma.incident.updateMany.mockResolvedValueOnce({ count: 1 });

    await service.resolve('tenant-1', 'actor-1', 'incident-1', '  fixed  ');
    expect(prisma.incident.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'incident-1', tenantId: 'tenant-1', status: { not: 'RESOLVED' } },
    }));
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'RESOLVED', message: 'fixed' }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'INCIDENT_RESOLVED' }),
    }));

    prisma.incident.findFirst.mockResolvedValue({ id: 'incident-1', status: 'ACKNOWLEDGED' });
    prisma.incident.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.incidentEvent.create.mockClear();
    prisma.auditLog.create.mockClear();
    await expect(service.resolve('tenant-1', 'actor-1', 'incident-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('assigns only unresolved incidents and commits history and audit together', async () => {
    prisma.incident.findFirst.mockResolvedValueOnce({ id: 'incident-1', status: 'ACKNOWLEDGED' }).mockResolvedValueOnce({ id: 'incident-1', status: 'ACKNOWLEDGED', assignedToUserId: 'user-2' });
    prisma.tenantMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    prisma.incident.updateMany.mockResolvedValue({ count: 1 });

    await service.assign('tenant-1', 'actor-1', 'incident-1', { assignedToUserId: 'user-2' } as any);
    expect(prisma.incident.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'incident-1', tenantId: 'tenant-1', status: { not: 'RESOLVED' } },
    }));
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'ASSIGNED' }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'INCIDENT_ASSIGNED' }),
    }));
  });
});
