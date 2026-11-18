import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string) {
    return this.prisma.service.findMany({
      where: { tenantId }, orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, slug: true, description: true, repository: true, lifecycle: true, teamId: true, createdAt: true, updatedAt: true },
    });
  }

  async create(tenantId: string, actorId: string, input: CreateServiceDto) {
    await this.assertTeamBelongsToTenant(input.teamId, tenantId);
    try {
      const service = await this.prisma.service.create({
        data: { tenantId, name: input.name.trim(), slug: input.slug.trim().toLowerCase(), description: input.description, repository: input.repository, lifecycle: input.lifecycle, teamId: input.teamId },
      });
      await this.audit.record({ tenantId, actorId, action: 'SERVICE_CREATED', entityType: 'SERVICE', entityId: service.id });
      return service;
    } catch (error) { this.handleWriteError(error); }
  }

  async update(tenantId: string, actorId: string, id: string, input: UpdateServiceDto) {
    await this.assertTeamBelongsToTenant(input.teamId, tenantId);
    const existing = await this.prisma.service.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Service not found');
    try {
      const service = await this.prisma.service.update({
        where: { id },
        data: { ...input, name: input.name?.trim(), slug: input.slug?.trim().toLowerCase() },
      });
      await this.audit.record({ tenantId, actorId, action: 'SERVICE_UPDATED', entityType: 'SERVICE', entityId: id });
      return service;
    } catch (error) { this.handleWriteError(error); }
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.service.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Service not found');
    await this.prisma.service.delete({ where: { id } });
    await this.audit.record({ tenantId, actorId, action: 'SERVICE_DELETED', entityType: 'SERVICE', entityId: id });
    return { deleted: true, id };
  }

  private async assertTeamBelongsToTenant(teamId: string | undefined, tenantId: string) {
    if (!teamId) return;
    const team = await this.prisma.team.findFirst({ where: { id: teamId, tenantId }, select: { id: true } });
    if (!team) throw new NotFoundException('Team not found in this workspace');
  }

  private handleWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A service with this slug already exists in this workspace');
    }
    throw error;
  }
}
