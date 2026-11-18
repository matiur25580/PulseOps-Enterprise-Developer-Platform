import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
@Injectable()
export class TeamsService {
 constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
 list(tenantId: string) { return this.prisma.team.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, createdAt: true, updatedAt: true } }); }
 async create(tenantId: string, actorId: string, input: CreateTeamDto) { try { const team = await this.prisma.team.create({ data: { tenantId, name: input.name.trim(), email: input.email?.trim().toLowerCase() } }); await this.audit.record({ tenantId, actorId, action: 'TEAM_CREATED', entityType: 'TEAM', entityId: team.id }); return team; } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A team with this name already exists in this workspace'); throw error; } }
 async update(tenantId: string, actorId: string, id: string, input: UpdateTeamDto) { const team = await this.prisma.team.findFirst({ where: { id, tenantId }, select: { id: true } }); if (!team) throw new NotFoundException('Team not found'); try { const updated = await this.prisma.team.update({ where: { id }, data: { name: input.name?.trim(), email: input.email === undefined ? undefined : input.email.trim().toLowerCase() || null } }); await this.audit.record({ tenantId, actorId, action: 'TEAM_UPDATED', entityType: 'TEAM', entityId: id }); return updated; } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A team with this name already exists in this workspace'); throw error; } }
 async remove(tenantId: string, actorId: string, id: string) { const team = await this.prisma.team.findFirst({ where: { id, tenantId }, select: { id: true } }); if (!team) throw new NotFoundException('Team not found'); await this.prisma.team.delete({ where: { id } }); await this.audit.record({ tenantId, actorId, action: 'TEAM_DELETED', entityType: 'TEAM', entityId: id }); return { deleted: true, id }; }
}
