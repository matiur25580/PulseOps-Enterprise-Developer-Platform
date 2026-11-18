import { Controller, Get, Header, UnauthorizedException, Req } from '@nestjs/common';
import { Request } from 'express';
import { MetricsService } from './metrics.service';
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(@Req() request: Request): string {
    const expected = process.env.METRICS_TOKEN;
    if (expected && request.header('authorization') !== `Bearer ${expected}`) throw new UnauthorizedException('Metrics token required');
    return this.metrics.render();
  }
}
