import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'pulseops-api' };
  }

  @Get('ready')
  async getReadiness(): Promise<{ status: string; checks: { database: string } }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', checks: { database: 'ok' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'unavailable' },
      });
    }
  }
}
