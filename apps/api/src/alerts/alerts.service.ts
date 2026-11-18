import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentSeverity } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string) {
    return this.prisma.alertRule.findMany({
      where: { tenantId },
      include: { slo: { include: { service: { select: { id: true, name: true } } } }, events: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, actorId: string, sloId: string, input: CreateAlertRuleDto) {
    const slo = await this.prisma.sloDefinition.findFirst({ where: { id: sloId, tenantId }, select: { id: true } });
    if (!slo) throw new NotFoundException('SLO not found in this workspace');
    const rule = await this.prisma.alertRule.create({
      data: { tenantId, sloId, name: input.name.trim(), thresholdPercent: input.thresholdPercent, cooldownMinutes: input.cooldownMinutes ?? 30 },
      include: { slo: { select: { id: true, name: true, indicator: true } } },
    });
    await this.audit.record({ tenantId, actorId, action: 'ALERT_RULE_CREATED', entityType: 'ALERT_RULE', entityId: rule.id });
    return rule;
  }

  async setEnabled(tenantId: string, actorId: string, id: string, enabled: boolean) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    const updated = await this.prisma.alertRule.update({ where: { id }, data: { enabled } });
    await this.audit.record({ tenantId, actorId, action: enabled ? 'ALERT_RULE_ENABLED' : 'ALERT_RULE_DISABLED', entityType: 'ALERT_RULE', entityId: id });
    return updated;
  }

  async evaluate(tenantId: string, actorId: string) {
    const rules = await this.prisma.alertRule.findMany({
      where: { tenantId, enabled: true },
      include: { slo: { include: { service: { select: { name: true } } } } },
    });
    const outcomes: Array<{ ruleId: string; state: 'NO_DATA' | 'HEALTHY' | 'COOLDOWN' | 'TRIGGERED'; observedPercent: number | null; incidentId?: string }> = [];

    for (const rule of rules) {
      const since = new Date(Date.now() - rule.slo.windowDays * 86400000);
      const where = { sloId: rule.sloId, observedAt: { gte: since } };
      const [total, good] = await Promise.all([
        this.prisma.sliSample.count({ where }),
        this.prisma.sliSample.count({ where: { ...where, success: true, ...(rule.slo.indicator === 'LATENCY' ? { latencyMs: { lte: rule.slo.latencyThresholdMs ?? 0 } } : {}) } }),
      ]);
      if (!total) { outcomes.push({ ruleId: rule.id, state: 'NO_DATA', observedPercent: null }); continue; }
      const observedPercent = (good / total) * 100;
      if (observedPercent > rule.thresholdPercent) { outcomes.push({ ruleId: rule.id, state: 'HEALTHY', observedPercent }); continue; }
      const cooldownEnd = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60000) : null;
      if (cooldownEnd && cooldownEnd > new Date()) { outcomes.push({ ruleId: rule.id, state: 'COOLDOWN', observedPercent }); continue; }

      const message = `SLO alert: ${rule.slo.name} for ${rule.slo.service.name} measured ${observedPercent.toFixed(3)}%, at or below ${rule.thresholdPercent}%.`;
      const created = await this.prisma.$transaction(async tx => {
        const incident = await tx.incident.create({
          data: {
            tenantId, createdByUserId: actorId, title: `SLO breach: ${rule.slo.service.name}`,
            description: message, severity: IncidentSeverity.HIGH,
            events: { create: { actorId, eventType: 'ALERT_TRIGGERED', message } },
          },
          select: { id: true },
        });
        await tx.alertEvent.create({ data: { ruleId: rule.id, incidentId: incident.id, observedPercent, thresholdPercent: rule.thresholdPercent, message } });
        await tx.alertRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: new Date() } });
        await tx.auditLog.create({ data: { tenantId, actorId, action: 'SLO_ALERT_TRIGGERED', entityType: 'INCIDENT', entityId: incident.id, metadata: { alertRuleId: rule.id, observedPercent, thresholdPercent: rule.thresholdPercent } } });
        return incident;
      });
      outcomes.push({ ruleId: rule.id, state: 'TRIGGERED', observedPercent, incidentId: created.id });
    }
    return { evaluatedAt: new Date().toISOString(), rulesEvaluated: rules.length, outcomes };
  }

  async events(tenantId: string, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id: ruleId, tenantId }, select: { id: true } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    return this.prisma.alertEvent.findMany({ where: { ruleId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
