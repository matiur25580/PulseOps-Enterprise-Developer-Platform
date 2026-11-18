import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';
@Global()
@Module({ controllers: [MetricsController], providers: [MetricsService, HttpObservabilityInterceptor], exports: [MetricsService, HttpObservabilityInterceptor] })
export class ObservabilityModule {}
