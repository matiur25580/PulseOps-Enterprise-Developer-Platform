import { of } from 'rxjs';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';
import { TraceContextService } from './trace-context.service';
import { MetricsService } from './metrics.service';
import { OtlpTraceExporter } from './otlp-trace-exporter';

describe('HttpObservabilityInterceptor tracing', () => {
  const traceId = '0123456789abcdef0123456789abcdef';
  const parentSpanId = '0123456789abcdef';

  afterEach(() => {
    delete process.env.OTEL_TRACES_SAMPLER_ARG;
  });

  it('continues a sampled W3C trace and exports a child server span', () => {
    const metrics = { record: jest.fn() } as unknown as MetricsService;
    const exporter = { export: jest.fn().mockResolvedValue(undefined) } as unknown as OtlpTraceExporter;
    const traceContext = new TraceContextService();
    const interceptor = new HttpObservabilityInterceptor(metrics, traceContext, exporter);
    const response = { statusCode: 200, setHeader: jest.fn() };
    const request = {
      header: (name: string) => name === 'traceparent' ? `00-${traceId}-${parentSpanId}-01` : undefined,
      route: { path: '/services' },
      path: '/services',
      method: 'GET',
      hostname: 'api.example.test',
    };
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as any;
    const next = { handle: () => of('ok') };

    interceptor.intercept(context, next).subscribe();
    expect(response.setHeader).toHaveBeenCalledWith('x-trace-id', traceId);
    const returnedParent = response.setHeader.mock.calls.find((call: unknown[]) => call[0] === 'traceparent')?.[1];
    expect(returnedParent).toMatch(new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`));
    expect(exporter.export).toHaveBeenCalledWith(expect.objectContaining({
      traceId,
      parentSpanId,
      name: 'GET /services',
      statusCode: 200,
    }));
    expect(metrics.record).toHaveBeenCalledWith('GET', '/services', 200, expect.any(Number));
  });

  it('does not export a trace when the incoming parent is unsampled', () => {
    const metrics = { record: jest.fn() } as unknown as MetricsService;
    const exporter = { export: jest.fn() } as unknown as OtlpTraceExporter;
    const interceptor = new HttpObservabilityInterceptor(metrics, new TraceContextService(), exporter);
    const response = { statusCode: 204, setHeader: jest.fn() };
    const request = {
      header: (name: string) => name === 'traceparent' ? `00-${traceId}-${parentSpanId}-00` : undefined,
      route: { path: '/health' }, path: '/health', method: 'GET', hostname: 'api.example.test',
    };
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as any;
    interceptor.intercept(context, { handle: () => of('ok') }).subscribe();
    expect(exporter.export).not.toHaveBeenCalled();
  });
  it('starts a new unsampled trace when the incoming traceparent is invalid', () => {
    process.env.OTEL_TRACES_SAMPLER_ARG = '0';
    const metrics = { record: jest.fn() } as unknown as MetricsService;
    const exporter = { export: jest.fn() } as unknown as OtlpTraceExporter;
    const interceptor = new HttpObservabilityInterceptor(metrics, new TraceContextService(), exporter);
    const response = { statusCode: 200, setHeader: jest.fn() };
    const request = {
      header: (name: string) => name === 'traceparent' ? '00-00000000000000000000000000000000-0000000000000000-01' : undefined,
      route: { path: '/health' }, path: '/health', method: 'GET', hostname: 'api.example.test',
    };
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as any;
    interceptor.intercept(context, { handle: () => of('ok') }).subscribe();
    const generatedTrace = response.setHeader.mock.calls.find((call: unknown[]) => call[0] === 'traceparent')?.[1] as string;
    expect(generatedTrace).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/);
    expect(generatedTrace).not.toContain(traceId);
    expect(exporter.export).not.toHaveBeenCalled();
  });

});
