import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
describe('ServicesService tenant isolation', () => {
 const prisma = { service: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() }, team: { findFirst: jest.fn() } };
 let service: ServicesService;
 beforeEach(() => { jest.clearAllMocks(); service = new ServicesService(prisma as never); });
 it('lists only services from the authenticated tenant', async () => { prisma.service.findMany.mockResolvedValue([]); await service.list('tenant-a'); expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' } })); });
 it('creates a service with caller tenant scope and normalized slug', async () => { prisma.service.create.mockResolvedValue({ id: 'service-1', tenantId: 'tenant-a' }); await service.create('tenant-a', { name: 'Payments API', slug: 'Payments-API' }); expect(prisma.service.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a', slug: 'payments-api' }) })); });
 it('rejects assigning a team from another tenant', async () => { prisma.team.findFirst.mockResolvedValue(null); await expect(service.create('tenant-a', { name: 'Payments API', slug: 'payments-api', teamId: '00000000-0000-4000-8000-000000000002' })).rejects.toBeInstanceOf(NotFoundException); expect(prisma.service.create).not.toHaveBeenCalled(); });
 it('does not update a service owned by another tenant', async () => { prisma.service.findFirst.mockResolvedValue(null); await expect(service.update('tenant-a', 'service-from-b', { name: 'Changed' })).rejects.toBeInstanceOf(NotFoundException); expect(prisma.service.update).not.toHaveBeenCalled(); });
 it('does not delete a service owned by another tenant', async () => { prisma.service.findFirst.mockResolvedValue(null); await expect(service.remove('tenant-a', 'service-from-b')).rejects.toBeInstanceOf(NotFoundException); expect(prisma.service.delete).not.toHaveBeenCalled(); });
});
