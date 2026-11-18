import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class DependenciesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  list(tenantId: string) {
    return this.prisma.serviceDependency.findMany({
      where: { tenantId },
      include: { sourceService: { select: { id: true, name: true, slug: true } }, targetService: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
  async create(tenantId: string, actorId: string, sourceServiceId: string, targetServiceId: string) {
    if (sourceServiceId === targetServiceId) throw new BadRequestException('A service cannot depend on itself');
    const ids = await this.prisma.service.findMany({ where: { tenantId, id: { in: [sourceServiceId, targetServiceId] } }, select: { id: true } });
    if (ids.length !== 2) throw new NotFoundException('Both services must belong to this workspace');
    const edges = await this.prisma.serviceDependency.findMany({ where: { tenantId }, select: { sourceServiceId: true, targetServiceId: true } });
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) adjacency.set(edge.sourceServiceId, [...(adjacency.get(edge.sourceServiceId) ?? []), edge.targetServiceId]);
    const pending = [targetServiceId]; const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (current === sourceServiceId) throw new BadRequestException('Dependency would create a cycle');
      if (visited.has(current)) continue;
      visited.add(current); pending.push(...(adjacency.get(current) ?? []));
    }
    try {
      const dependency = await this.prisma.serviceDependency.create({ data: { tenantId, sourceServiceId, targetServiceId }, include: { sourceService: { select: { name: true } }, targetService: { select: { name: true } } } });
      await this.audit.record({ tenantId, actorId, action: 'SERVICE_DEPENDENCY_CREATED', entityType: 'SERVICE_DEPENDENCY', entityId: dependency.id });
      return dependency;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ConflictException('Dependency already exists');
      throw error;
    }
  }
  async remove(tenantId: string, actorId: string, id: string) {
    const row = await this.prisma.serviceDependency.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Dependency not found');
    await this.prisma.serviceDependency.delete({ where: { id } });
    await this.audit.record({ tenantId, actorId, action: 'SERVICE_DEPENDENCY_DELETED', entityType: 'SERVICE_DEPENDENCY', entityId: id });
    return { deleted: true, id };
  }
}
