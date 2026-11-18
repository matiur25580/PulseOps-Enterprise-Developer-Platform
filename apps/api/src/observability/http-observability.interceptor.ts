import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';
import { MetricsService } from './metrics.service';
import { TraceContextService } from './trace-context.service';
import { OtlpTraceExporter } from './otlp-trace-exporter';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const nonZeroHex = (value: string) => /[1-9a-f]/i.test(value);

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly traceContext: TraceContextService,
    private readonly exporter: OtlpTraceExporter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = process.hrtime.bigint();
    const startTimeUnixNano = (BigInt(Date.now()) * 1_000_000n).toString();
    const route = (request.route?.path as string | undefined) ?? request.path ?? 'unknown';
    const incoming = TRACEPARENT.exec(request.header('traceparent') ?? '');
    const validParent = incoming && nonZeroHex(incoming[1]) && nonZeroHex(incoming[2]) ? incoming : undefined;
    const traceId = validParent?.[1].toLowerCase() ?? randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');
    const parentSpanId = validParent?.[2].toLowerCase();
    const requestedFlags = validParent ? parseInt(validParent[3], 16) : undefined;
    const sampleRatio = Math.max(0, Math.min(1, Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? 1) || 0));
    const rootSampled = !validParent && parseInt(traceId.slice(0, 8), 16) / 0xffffffff < sampleRatio;
    const sampled = validParent ? Boolean(requestedFlags! & 1) : rootSampled;
    const traceFlags = sampled ? '01' : '00';
    const trace = { traceId, spanId, traceFlags };

    response.setHeader('x-trace-id', traceId);
    response.setHeader('traceparent', `00-${traceId}-${spanId}-${traceFlags}`);

    const stream = next.handle().pipe(finalize(() => {
      const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
      const status = response.statusCode || 500;
      if (route !== '/metrics') this.metrics.record(request.method, route, status, durationSeconds);
      process.stdout.write(JSON.stringify({
        level: status >= 500 ? 'error' : 'info',
        event: 'http.server.request',
        traceId,
        spanId,
        parentSpanId,
        method: request.method,
        route,
        status,
        durationMs: Number((durationSeconds * 1000).toFixed(2)),
      }) + '\\n');

      if (sampled) {
        void this.exporter.export({
          traceId,
          spanId,
          parentSpanId,
          name: `${request.method} ${route}`,
          startTimeUnixNano,
          endTimeUnixNano: (BigInt(Date.now()) * 1_000_000n).toString(),
          statusCode: status,
          attributes: [
            { key: 'http.request.method', value: { stringValue: request.method } },
            { key: 'http.route', value: { stringValue: route } },
            { key: 'http.response.status_code', value: { intValue: String(status) } },
            { key: 'server.address', value: { stringValue: request.hostname } },
          ],
        });
      }
    }));

    return new Observable(subscriber =>
      this.traceContext.run(trace, () => stream.subscribe(subscriber)),
    );
  }
}
