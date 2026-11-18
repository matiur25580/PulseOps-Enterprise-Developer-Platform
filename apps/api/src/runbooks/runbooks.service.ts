import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRunbookDto } from './dto/create-runbook.dto';
import { UpsertEscalationPolicyDto } from './dto/upsert-escalation-policy.dto';

@Injectable()
export class RunbooksService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(tenantId: string, serviceId: string) {
    await this.assertService(tenantId, serviceId);
    return this.prisma.runbookReference.findMany({
      where: { tenantId, serviceId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(tenantId: string, actorId: string, serviceId: string, input: CreateRunbookDto) {
    await this.assertService(tenantId, serviceId);
    try {
      const runbook = await this.prisma.$transaction(async tx => {
        if (input.isPrimary) await tx.runbookReference.updateMany({ where: { tenantId, serviceId, isPrimary: true }, data: { isPrimary: false } });
        return tx.runbookReference.create({
          data: { tenantId, serviceId, title: input.title.trim(), url: input.url, category: input.category ?? 'RUNBOOK', isPrimary: input.isPrimary ?? false },
        });
      });
      await this.audit.record({ tenantId, actorId, action: 'RUNBOOK_CREATED', entityType: 'RUNBOOK', entityId: runbook.id });
      return runbook;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A runbook with this title already exists or a primary runbook is already set');
      }
      throw error;
    }
  }

  async remove(tenantId: string, actorId: string, serviceId: string, runbookId: string) {
    const existing = await this.prisma.runbookReference.findFirst({ where: { id: runbookId, tenantId, serviceId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Runbook not found for this service');
    await this.prisma.runbookReference.delete({ where: { id: runbookId } });
    await this.audit.record({ tenantId, actorId, action: 'RUNBOOK_DELETED', entityType: 'RUNBOOK', entityId: runbookId });
    return { deleted: true, id: runbookId };
  }

  async getPolicy(tenantId: string, serviceId: string) {
    await this.assertService(tenantId, serviceId);
    return this.prisma.escalationPolicy.findUnique({ where: { tenantId_serviceId: { tenantId, serviceId } } });
  }

  async upsertPolicy(tenantId: string, actorId: string, serviceId: string, input: UpsertEscalationPolicyDto) {
    await this.assertService(tenantId, serviceId);
    if (input.secondaryContactEmail && input.secondaryContactEmail.toLowerCase() === input.primaryContactEmail.toLowerCase()) {
      throw new ConflictException('Primary and secondary escalation contacts must be different');
    }
    const policy = await this.prisma.escalationPolicy.upsert({
      where: { tenantId_serviceId: { tenantId, serviceId } },
      create: {
        tenantId, serviceId, primaryContactEmail: input.primaryContactEmail.toLowerCase(),
        secondaryContactEmail: input.secondaryContactEmail?.toLowerCase(),
        escalationAfterMinutes: input.escalationAfterMinutes ?? 15, onCallUrl: input.onCallUrl, notes: input.notes?.trim(),
      },
      update: {
        primaryContactEmail: input.primaryContactEmail.toLowerCase(),
        secondaryContactEmail: input.secondaryContactEmail?.toLowerCase() ?? null,
        escalationAfterMinutes: input.escalationAfterMinutes ?? 15, onCallUrl: input.onCallUrl ?? null, notes: input.notes?.trim() ?? null,
      },
    });
    await this.audit.record({ tenantId, actorId, action: 'ESCALATION_POLICY_UPDATED', entityType: 'ESCALATION_POLICY', entityId: policy.id });
    return policy;
  }

  private async assertService(tenantId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } });
    if (!service) throw new NotFoundException('Service not found in this workspace');
  }
}
