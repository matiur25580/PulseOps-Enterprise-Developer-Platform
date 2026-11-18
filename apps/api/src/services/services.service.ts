import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.service.findMany({
      where: { tenantId }, orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, slug: true, description: true, repository: true, lifecycle: true, teamId: true, createdAt: true, updatedAt: true },
    });
  }

  async create(tenantId: string, input: CreateServiceDto) {
    await this.assertTeamBelongsToTenant(input.teamId, tenantId);
    try {
      return await this.prisma.service.create({
        data: { tenantId, name: input.name.trim(), slug: input.slug.trim().toLowerCase(), description: input.description, repository: input.repository, lifecycle: input.lifecycle, teamId: input.teamId },
      });
    } catch (error) { this.handleWriteError(error); }
  }

  async update(tenantId: string, id: string, input: UpdateServiceDto) {
    await this.assertTeamBelongsToTenant(input.teamId, tenantId);
    const existing = await this.prisma.service.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Service not found');
    try {
      return await this.prisma.service.update({
        where: { id },
        data: { ...input, name: input.name?.trim(), slug: input.slug?.trim().toLowerCase() },
      });
    } catch (error) { this.handleWriteError(error); }
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.service.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Service not found');
    await this.prisma.service.delete({ where: { id } });
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
