import { Injectable, Logger } from '@nestjs/common';

type SpanData = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number } }>;
  statusCode: number;
  traceFlags: string;
};

@Injectable()
export class OtlpTraceExporter {
  private readonly logger = new Logger(OtlpTraceExporter.name);

  async export(span: SpanData): Promise<void> {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ?? (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`
        : undefined);
    if (!endpoint) return;

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const configuredHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
    if (configuredHeaders) {
      for (const pair of configuredHeaders.split(',')) {
        const separator = pair.indexOf('=');
        if (separator > 0) {
          const key = pair.slice(0, separator).trim();
          const value = pair.slice(separator + 1).trim();
          if (key && value) headers[key] = value;
        }
      }
    }

    const body = {
      resourceSpans: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: process.env.OTEL_SERVICE_NAME ?? 'pulseops-api' } }] },
        scopeSpans: [{
          scope: { name: 'pulseops.api', version: '1.0.0' },
          spans: [{
            traceId: span.traceId,
            spanId: span.spanId,
            ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
            name: span.name,
            kind: 2,
            flags: parseInt(span.traceFlags, 16),
            startTimeUnixNano: span.startTimeUnixNano,
            endTimeUnixNano: span.endTimeUnixNano,
            attributes: span.attributes,
            status: { code: span.statusCode >= 500 ? 2 : 1 },
          }],
        }],
      }],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    timeout.unref?.();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) this.logger.warn(`OTLP trace export returned HTTP ${response.status}`);
    } catch (error) {
      this.logger.warn(`OTLP trace export failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
