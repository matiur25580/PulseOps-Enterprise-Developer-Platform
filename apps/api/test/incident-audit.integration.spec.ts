import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Incident management and audit trail (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `incident-${suffix}@pulseops.test`;
  const password = 'Incident-Integration-Password-2026!';
  let token = '';
  let tenantId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email } });
    await app?.close();
  });

  it('creates, acknowledges and resolves a tenant-scoped incident with immutable timeline and audit events', async () => {
    const registered = await request(app.getHttpServer()).post('/api/v1/auth/register')
      .send({ name: 'Incident Owner', email, password, tenantName: `Incident Workspace ${suffix}` }).expect(201);
    token = registered.body.accessToken;
    tenantId = registered.body.tenant.id;

    const created = await request(app.getHttpServer()).post('/api/v1/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Elevated API latency', description: 'p95 latency exceeded the SLO', severity: 'HIGH' }).expect(201);
    expect(created.body.status).toBe('OPEN');
    expect(created.body.events).toHaveLength(1);

    await request(app.getHttpServer()).get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`).expect(200)
      .expect(response => expect(response.body.some((row: { action: string }) => row.action === 'INCIDENT_CREATED')).toBe(true));

    await request(app.getHttpServer()).post(`/api/v1/incidents/${created.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/incidents/${created.body.id}/resolve`)
      .set('Authorization', `Bearer ${token}`).send({ message: 'Rollback completed; latency recovered' }).expect(201);

    const listed = await request(app.getHttpServer()).get('/api/v1/incidents')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(listed.body[0].status).toBe('RESOLVED');
    expect(listed.body[0].events.map((event: { eventType: string }) => event.eventType)).toEqual(['CREATED', 'ACKNOWLEDGED', 'RESOLVED']);

    const audit = await prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    expect(audit.map(row => row.action)).toEqual(['INCIDENT_CREATED', 'INCIDENT_ACKNOWLEDGED', 'INCIDENT_RESOLVED']);
    await request(app.getHttpServer()).get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`).expect(200);
  });
});
