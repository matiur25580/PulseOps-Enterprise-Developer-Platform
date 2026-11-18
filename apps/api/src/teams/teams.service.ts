import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
@Injectable()
export class TeamsService {
 constructor(private readonly prisma: PrismaService) {}
 list(tenantId: string) { return this.prisma.team.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, createdAt: true, updatedAt: true } }); }
 async create(tenantId: string, input: CreateTeamDto) { try { return await this.prisma.team.create({ data: { tenantId, name: input.name.trim(), email: input.email?.trim().toLowerCase() } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A team with this name already exists in this workspace'); throw error; } }
 async update(tenantId: string, id: string, input: UpdateTeamDto) { const team = await this.prisma.team.findFirst({ where: { id, tenantId }, select: { id: true } }); if (!team) throw new NotFoundException('Team not found'); try { return await this.prisma.team.update({ where: { id }, data: { name: input.name?.trim(), email: input.email === undefined ? undefined : input.email.trim().toLowerCase() || null } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A team with this name already exists in this workspace'); throw error; } }
 async remove(tenantId: string, id: string) { const team = await this.prisma.team.findFirst({ where: { id, tenantId }, select: { id: true } }); if (!team) throw new NotFoundException('Team not found'); await this.prisma.team.delete({ where: { id } }); return { deleted: true, id }; }
}
