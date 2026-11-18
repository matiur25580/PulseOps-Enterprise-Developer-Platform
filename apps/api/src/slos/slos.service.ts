import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SloIndicator } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSliSampleDto } from './dto/create-sli-sample.dto';
import { CreateSloDto } from './dto/create-slo.dto';
@Injectable()
export class SlosService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async list(tenantId: string) {
    const rows = await this.prisma.sloDefinition.findMany({ where: { tenantId }, include: { service: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map(row => this.withStatus(row)));
  }
  async create(tenantId: string, actorId: string, serviceId: string, input: CreateSloDto) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } });
    if (!service) throw new NotFoundException('Service not found in this workspace');
    if (input.indicator === 'LATENCY' && !input.latencyThresholdMs) throw new BadRequestException('Latency SLO requires latencyThresholdMs');
    if (input.indicator === 'AVAILABILITY' && input.latencyThresholdMs !== undefined) throw new BadRequestException('Availability SLO must not include latencyThresholdMs');
    const slo = await this.prisma.sloDefinition.create({ data: { tenantId, serviceId, name: input.name.trim(), indicator: input.indicator as SloIndicator, targetPercent: input.targetPercent, windowDays: input.windowDays ?? 30, latencyThresholdMs: input.latencyThresholdMs }, include: { service: { select: { id: true, name: true, slug: true } } } });
    await this.audit.record({ tenantId, actorId, action: 'SLO_CREATED', entityType: 'SLO', entityId: slo.id });
    return this.withStatus(slo);
  }
  async addSample(tenantId: string, actorId: string, id: string, input: CreateSliSampleDto) {
    const slo = await this.prisma.sloDefinition.findFirst({ where: { id, tenantId } });
    if (!slo) throw new NotFoundException('SLO not found');
    if (slo.indicator === 'LATENCY' && input.latencyMs === undefined) throw new BadRequestException('Latency SLO samples require latencyMs');
    const sample = await this.prisma.sliSample.create({ data: { sloId: id, success: input.success, latencyMs: input.latencyMs } });
    await this.audit.record({ tenantId, actorId, action: 'SLI_SAMPLE_RECORDED', entityType: 'SLO', entityId: id, metadata: { sampleId: sample.id } });
    return this.withStatus(slo);
  }
  async remove(tenantId: string, actorId: string, id: string) {
    const row = await this.prisma.sloDefinition.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!row) throw new NotFoundException('SLO not found');
    await this.prisma.sloDefinition.delete({ where: { id } });
    await this.audit.record({ tenantId, actorId, action: 'SLO_DELETED', entityType: 'SLO', entityId: id });
    return { deleted: true, id };
  }
  private async withStatus<T extends { id: string; indicator: SloIndicator; targetPercent: number; windowDays: number; latencyThresholdMs: number | null }>(slo: T) {
    const since = new Date(Date.now() - slo.windowDays * 24 * 60 * 60 * 1000);
    const samples = await this.prisma.sliSample.findMany({ where: { sloId: slo.id, observedAt: { gte: since } }, select: { success: true, latencyMs: true } });
    const good = samples.filter(sample => slo.indicator === 'AVAILABILITY' ? sample.success : sample.success && sample.latencyMs !== null && sample.latencyMs <= (slo.latencyThresholdMs ?? 0)).length;
    const total = samples.length;
    const sliPercent = total ? (good / total) * 100 : null;
    const allowedBadPercent = 100 - slo.targetPercent;
    const actualBadPercent = total ? 100 - (sliPercent ?? 0) : null;
    const errorBudgetRemainingPercent = total && allowedBadPercent > 0 ? Math.max(0, Math.min(100, ((allowedBadPercent - (actualBadPercent ?? 0)) / allowedBadPercent) * 100)) : total && allowedBadPercent === 0 ? (actualBadPercent === 0 ? 100 : 0) : null;
    return { ...slo, measurement: { sampleCount: total, goodCount: good, sliPercent, errorBudgetRemainingPercent, windowStart: since.toISOString(), windowEnd: new Date().toISOString(), dataSource: 'MANUAL_API_INGESTION' as const } };
  }
}
