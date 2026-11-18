import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
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
      include: { assignee: { select: { id: true, name: true, email: true } }, events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true } } } } },
    });
  }

  async create(tenantId: string, actorId: string, input: CreateIncidentDto) {
    if (input.assignedToUserId) await this.assertMember(tenantId, input.assignedToUserId);
    const incident = await this.prisma.incident.create({
      data: {
        tenantId, createdByUserId: actorId, title: input.title.trim(),
        description: input.description?.trim(), severity: input.severity ?? 'MEDIUM',
        assignedToUserId: input.assignedToUserId,
        events: { create: { actorId, eventType: 'CREATED', message: 'Incident created' } },
      },
      include: { assignee: { select: { id: true, name: true, email: true } }, events: true },
    });
    await this.audit.record({ tenantId, actorId, action: 'INCIDENT_CREATED', entityType: 'INCIDENT', entityId: incident.id, metadata: { severity: incident.severity } });
    return incident;
  }

  async assign(tenantId: string, actorId: string, id: string, input: AssignIncidentDto) {
    const incident = await this.find(tenantId, id);
    if (incident.status === 'RESOLVED') throw new ConflictException('Resolved incidents cannot be reassigned');
    await this.assertMember(tenantId, input.assignedToUserId);
    const updated = await this.prisma.incident.update({
      where: { id }, data: { assignedToUserId: input.assignedToUserId },
      include: { assignee: { select: { id: true, name: true, email: true } }, events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.prisma.incidentEvent.create({ data: { incidentId: id, actorId, eventType: 'ASSIGNED', message: 'Incident assigned', metadata: { assignedToUserId: input.assignedToUserId } } });
    await this.audit.record({ tenantId, actorId, action: 'INCIDENT_ASSIGNED', entityType: 'INCIDENT', entityId: id, metadata: { assignedToUserId: input.assignedToUserId } });
    return updated;
  }

  async acknowledge(tenantId: string, actorId: string, id: string) {
    const incident = await this.find(tenantId, id);
    if (incident.status !== 'OPEN') throw new ConflictException('Only open incidents can be acknowledged');
    const updated = await this.prisma.incident.update({ where: { id }, data: { status: IncidentStatus.ACKNOWLEDGED, acknowledgedAt: new Date() } });
    await this.prisma.incidentEvent.create({ data: { incidentId: id, actorId, eventType: 'ACKNOWLEDGED', message: 'Incident acknowledged' } });
    await this.audit.record({ tenantId, actorId, action: 'INCIDENT_ACKNOWLEDGED', entityType: 'INCIDENT', entityId: id });
    return updated;
  }

  async resolve(tenantId: string, actorId: string, id: string, message?: string) {
    const incident = await this.find(tenantId, id);
    if (incident.status === 'RESOLVED') throw new ConflictException('Incident is already resolved');
    const updated = await this.prisma.incident.update({ where: { id }, data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() } });
    await this.prisma.incidentEvent.create({ data: { incidentId: id, actorId, eventType: 'RESOLVED', message: message?.trim() || 'Incident resolved' } });
    await this.audit.record({ tenantId, actorId, action: 'INCIDENT_RESOLVED', entityType: 'INCIDENT', entityId: id });
    return updated;
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
