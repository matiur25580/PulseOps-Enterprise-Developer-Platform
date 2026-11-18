import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TeamsService } from './teams.service';
describe('TeamsService tenant isolation', () => {
 const prisma = { team: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() } };
 const audit = { record: jest.fn().mockResolvedValue({}) };
 let service: TeamsService;
 beforeEach(() => { jest.clearAllMocks(); service = new TeamsService(prisma as never, audit as never); });
 it('lists only teams belonging to the authenticated tenant', async () => { prisma.team.findMany.mockResolvedValue([]); await service.list('tenant-a'); expect(prisma.team.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' } })); });
 it('creates a team with caller tenant scope and normalized email', async () => { prisma.team.create.mockResolvedValue({ id: 'team-1', tenantId: 'tenant-a', name: 'Platform' }); await service.create('tenant-a', 'actor-a', { name: ' Platform ', email: 'OPS@EXAMPLE.COM' }); expect(prisma.team.create).toHaveBeenCalledWith(expect.objectContaining({ data: { tenantId: 'tenant-a', name: 'Platform', email: 'ops@example.com' } })); });
 it('rejects update of a team owned by another tenant', async () => { prisma.team.findFirst.mockResolvedValue(null); await expect(service.update('tenant-a', 'actor-a', 'team-from-b', { name: 'Hijack' })).rejects.toBeInstanceOf(NotFoundException); expect(prisma.team.update).not.toHaveBeenCalled(); });
 it('rejects deletion of a team owned by another tenant', async () => { prisma.team.findFirst.mockResolvedValue(null); await expect(service.remove('tenant-a', 'actor-a', 'team-from-b')).rejects.toBeInstanceOf(NotFoundException); expect(prisma.team.delete).not.toHaveBeenCalled(); });
 it('returns conflict for duplicate team names', async () => { prisma.team.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' })); await expect(service.create('tenant-a', { name: 'Platform' })).rejects.toBeInstanceOf(ConflictException); });
});
