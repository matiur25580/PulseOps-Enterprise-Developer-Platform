import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Service graph, SLO and observability (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `sre-${suffix}@pulseops.test`;
  let tenantId = '';
  let token = '';
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init(); prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email } });
    await app?.close();
  });
  it('enforces an acyclic tenant graph and calculates SLO compliance and remaining error budget', async () => {
    const registered = await request(app.getHttpServer()).post('/api/v1/auth/register')
      .send({ name: 'SRE Owner', email, password: 'Sre-Integration-Password-2026!', tenantName: `SRE Workspace ${suffix}` }).expect(201);
    token = registered.body.accessToken; tenantId = registered.body.tenant.id;
    const headers = { Authorization: `Bearer ${token}` };
    const first = await request(app.getHttpServer()).post('/api/v1/services').set(headers)
      .send({ name: 'Web Gateway', slug: `web-gateway-${suffix}` }).expect(201);
    const second = await request(app.getHttpServer()).post('/api/v1/services').set(headers)
      .send({ name: 'Payments Core', slug: `payments-core-${suffix}` }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/service-dependencies').set(headers)
      .send({ sourceServiceId: first.body.id, targetServiceId: second.body.id }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/service-dependencies').set(headers)
      .send({ sourceServiceId: second.body.id, targetServiceId: first.body.id }).expect(400);
    const graph = await request(app.getHttpServer()).get('/api/v1/service-dependencies').set(headers).expect(200);
    expect(graph.body).toHaveLength(1);
    const slo = await request(app.getHttpServer()).post(`/api/v1/slos/services/${first.body.id}`).set(headers)
      .send({ name: 'Gateway availability', indicator: 'AVAILABILITY', targetPercent: 99.9, windowDays: 30 }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/slos/${slo.body.id}/samples`).set(headers)
      .send({ success: true }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/slos/${slo.body.id}/samples`).set(headers)
      .send({ success: false }).expect(201);
    const slos = await request(app.getHttpServer()).get('/api/v1/slos').set(headers).expect(200);
    expect(slos.body[0].measurement.sampleCount).toBe(2);
    expect(slos.body[0].measurement.sliPercent).toBe(50);
    expect(slos.body[0].measurement.errorBudgetRemainingPercent).toBe(0);
    await request(app.getHttpServer()).get('/api/v1/metrics').expect(200)
      .expect(response => expect(response.text).toContain('pulseops_http_requests_total'));
    const audit = await prisma.auditLog.findMany({ where: { tenantId }, select: { action: true } });
    expect(audit.map(row => row.action)).toEqual(expect.arrayContaining(['SERVICE_DEPENDENCY_CREATED', 'SLO_CREATED', 'SLI_SAMPLE_RECORDED']));
  });
});
