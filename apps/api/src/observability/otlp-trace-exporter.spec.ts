import { OtlpTraceExporter } from './otlp-trace-exporter';

describe('OtlpTraceExporter', () => {
  afterEach(() => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.OTEL_SERVICE_NAME;
    jest.restoreAllMocks();
  });

  it('exports OTLP JSON spans to the traces endpoint', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318/';
    process.env.OTEL_SERVICE_NAME = 'pulseops-test';
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'authorization=Bearer test-token';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
    } as Response);
    const exporter = new OtlpTraceExporter();

    await exporter.export({
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      parentSpanId: 'abcdef0123456789',
      name: 'GET /health',
      startTimeUnixNano: '1000000',
      endTimeUnixNano: '2000000',
      statusCode: 200,
      traceFlags: '01',
      attributes: [{ key: 'http.request.method', value: { stringValue: 'GET' } }],
    });

    expect(fetchSpy).toHaveBeenCalledWith('http://collector:4318/v1/traces', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer test-token' }),
    }));
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.resourceSpans[0].resource.attributes).toContainEqual({
      key: 'service.name', value: { stringValue: 'pulseops-test' },
    });
    expect(body.resourceSpans[0].scopeSpans[0].spans[0]).toEqual(expect.objectContaining({
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      parentSpanId: 'abcdef0123456789',
      name: 'GET /health',
      flags: 1,
    }));
  });

  it('does nothing when no OTLP endpoint is configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await new OtlpTraceExporter().export({
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      name: 'GET /health',
      startTimeUnixNano: '1000000',
      endTimeUnixNano: '2000000',
      statusCode: 200,
      attributes: [],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
