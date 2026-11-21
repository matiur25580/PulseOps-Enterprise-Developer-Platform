import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string) {
    return this.prisma.incident.findMany({
      where: { tenantId }, orderBy: { updatedAt: 'desc' },
      include: { service: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true, email: true } }, events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true } } } } },
    });
  }

  async create(tenantId: string, actorId: string, input: CreateIncidentDto) {
    if (input.assignedToUserId) await this.assertMember(tenantId, input.assignedToUserId);
    if (input.serviceId) {
      const service = await this.prisma.service.findFirst({ where: { id: input.serviceId, tenantId }, select: { id: true } });
      if (!service) throw new NotFoundException('Service not found in this workspace');
    }
    const incident = await this.prisma.incident.create({
      data: {
        tenantId, createdByUserId: actorId, title: input.title.trim(),
        description: input.description?.trim(), severity: input.severity ?? 'MEDIUM',
        assignedToUserId: input.assignedToUserId, serviceId: input.serviceId,
        events: { create: { actorId, eventType: 'CREATED', message: 'Incident created' } },
      },
      include: { service: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true, email: true } }, events: true },
    });
    await this.audit.record({ tenantId, actorId, action: 'INCIDENT_CREATED', entityType: 'INCIDENT', entityId: incident.id, metadata: { severity: incident.severity } });
    return incident;
  }

  async assign(tenantId: string, actorId: string, id: string, input: AssignIncidentDto) {
    const incident = await this.find(tenantId, id);
    if (incident.status === 'RESOLVED') throw new ConflictException('Resolved incidents cannot be reassigned');
    await this.assertMember(tenantId, input.assignedToUserId);
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.incident.updateMany({
        where: { id, tenantId, status: { not: IncidentStatus.RESOLVED } },
        data: { assignedToUserId: input.assignedToUserId },
      });
      if (claimed.count !== 1) throw new ConflictException('Incident changed while assignment was being applied; refresh and retry');
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, eventType: 'ASSIGNED', message: 'Incident assigned', metadata: { assignedToUserId: input.assignedToUserId } } });
      await tx.auditLog.create({ data: { tenantId, actorId, action: 'INCIDENT_ASSIGNED', entityType: 'INCIDENT', entityId: id, metadata: { assignedToUserId: input.assignedToUserId } } });
      return tx.incident.findFirst({
        where: { id, tenantId },
        include: { assignee: { select: { id: true, name: true, email: true } }, events: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async acknowledge(tenantId: string, actorId: string, id: string) {
    const incident = await this.find(tenantId, id);
    if (incident.status !== 'OPEN') throw new ConflictException('Only open incidents can be acknowledged');
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.incident.updateMany({
        where: { id, tenantId, status: IncidentStatus.OPEN },
        data: { status: IncidentStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('Incident changed while acknowledgement was being applied; refresh and retry');
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, eventType: 'ACKNOWLEDGED', message: 'Incident acknowledged' } });
      await tx.auditLog.create({ data: { tenantId, actorId, action: 'INCIDENT_ACKNOWLEDGED', entityType: 'INCIDENT', entityId: id } });
      return tx.incident.findFirst({ where: { id, tenantId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resolve(tenantId: string, actorId: string, id: string, message?: string) {
    const incident = await this.find(tenantId, id);
    if (incident.status === 'RESOLVED') throw new ConflictException('Incident is already resolved');
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.incident.updateMany({
        where: { id, tenantId, status: { not: IncidentStatus.RESOLVED } },
        data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('Incident changed while resolution was being applied; refresh and retry');
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, eventType: 'RESOLVED', message: message?.trim() || 'Incident resolved' } });
      await tx.auditLog.create({ data: { tenantId, actorId, action: 'INCIDENT_RESOLVED', entityType: 'INCIDENT', entityId: id } });
      return tx.incident.findFirst({ where: { id, tenantId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }


  async escalate(tenantId: string, actorId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, tenantId },
      select: { id: true, title: true, status: true, serviceId: true, escalationLevel: true },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (incident.status === IncidentStatus.RESOLVED) throw new ConflictException('Resolved incidents cannot be escalated');
    if (!incident.serviceId) throw new ConflictException('Link this incident to a service before escalating');
    const policy = await this.prisma.escalationPolicy.findUnique({
      where: { tenantId_serviceId: { tenantId, serviceId: incident.serviceId } },
    });
    if (!policy) throw new NotFoundException('No escalation policy is configured for this service');
    const nextLevel = incident.escalationLevel + 1;
    const targetContact = nextLevel === 1 ? policy.primaryContactEmail : nextLevel === 2 ? policy.secondaryContactEmail : null;
    if (!targetContact) throw new ConflictException('No further escalation contact is configured');
    const escalatedAt = new Date();
    const message = 'Incident escalated to level ' + nextLevel + ' contact ' + targetContact;
    return this.prisma.$transaction(async tx => {
      const claimed = await tx.incident.updateMany({
        where: { id, tenantId, status: { not: IncidentStatus.RESOLVED }, escalationLevel: incident.escalationLevel },
        data: { escalationLevel: nextLevel, escalatedAt },
      });
      if (claimed.count !== 1) throw new ConflictException('Incident changed while escalation was being applied; retry');
      await tx.incidentEvent.create({
        data: { incidentId: id, actorId, eventType: 'ESCALATED', message, metadata: { escalationLevel: nextLevel, targetContact, escalationAfterMinutes: policy.escalationAfterMinutes } },
      });
      await tx.auditLog.create({
        data: { tenantId, actorId, action: 'INCIDENT_ESCALATED', entityType: 'INCIDENT', entityId: id, metadata: { escalationLevel: nextLevel, targetContact } },
      });
      return tx.incident.findFirst({
        where: { id, tenantId },
        include: { service: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true, email: true } }, events: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async find(tenantId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }
  private async assertMember(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMembership.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { id: true } });
    if (!membership) throw new NotFoundException('Assignee is not a member of this workspace');
  }
}
