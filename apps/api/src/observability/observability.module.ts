import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';
import { TraceContextService } from './trace-context.service';
import { OtlpTraceExporter } from './otlp-trace-exporter';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, TraceContextService, OtlpTraceExporter, HttpObservabilityInterceptor],
  exports: [MetricsService, TraceContextService, OtlpTraceExporter, HttpObservabilityInterceptor],
})
export class ObservabilityModule {}
