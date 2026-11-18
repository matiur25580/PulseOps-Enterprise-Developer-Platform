import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication session lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `session-${suffix}@pulseops.test`;
  const password = 'Integration-Test-Password-2026!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, memberships: { select: { tenantId: true } } } });
    if (user) {
      await prisma.tenant.deleteMany({ where: { id: { in: user.memberships.map(m => m.tenantId) } } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
    await app?.close();
  });

  it('rotates refresh tokens, rejects replay, and revokes the whole token family', async () => {
    const registered = await request(app.getHttpServer()).post('/api/v1/auth/register')
      .send({ name: 'Session Owner', email, password, tenantName: `Session Workspace ${suffix}` }).expect(201);
    expect(registered.body.expiresIn).toBe(900);
    const firstCookie = (registered.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect(firstCookie).toContain('pulseops_refresh=');

    const sessions = await request(app.getHttpServer()).get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${registered.body.accessToken}`).expect(200);
    expect(sessions.body).toHaveLength(1);

    const rotated = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', firstCookie).expect(201);
    expect(rotated.body.accessToken).not.toBe(registered.body.accessToken);
    const secondCookie = (rotated.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect(secondCookie).not.toBe(firstCookie);

    await request(app.getHttpServer()).get('/api/v1/teams').set('Authorization', `Bearer ${registered.body.accessToken}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/teams').set('Authorization', `Bearer ${rotated.body.accessToken}`).expect(200);

    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', firstCookie).expect(401);
    await request(app.getHttpServer()).get('/api/v1/teams').set('Authorization', `Bearer ${rotated.body.accessToken}`).expect(401);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const active = await prisma.authSession.findMany({ where: { userId: user!.id, revokedAt: null } });
    expect(active).toHaveLength(0);
  });

  it('allows login with the workspace display name as well as its generated slug', async () => {
    const workspaceName = `Engineering ${suffix}`;
    const workspaceEmail = `workspace-name-${suffix}@pulseops.test`;
    const registered = await request(app.getHttpServer()).post('/api/v1/auth/register')
      .send({ name: 'Workspace Name Login', email: workspaceEmail, password, tenantName: workspaceName }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: workspaceEmail, password, tenantSlug: workspaceName }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: workspaceEmail, password, tenantSlug: registered.body.tenant.slug }).expect(201);
    await prisma.tenant.delete({ where: { id: registered.body.tenant.id } });
    await prisma.user.delete({ where: { email: workspaceEmail } });
  });

  it('rate-limits repeated login attempts for the same IP and account', async () => {
    const throttleEmail = `throttle-${suffix}@pulseops.test`;
    const registered = await request(app.getHttpServer()).post('/api/v1/auth/register')
      .send({ name: 'Throttle Owner', email: throttleEmail, password, tenantName: `Throttle Workspace ${suffix}` }).expect(201);
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app.getHttpServer()).post('/api/v1/auth/login')
        .send({ email: throttleEmail, password: 'Wrong-Password-2026!', tenantSlug: registered.body.tenant.slug }).expect(401);
    }
    await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: throttleEmail, password, tenantSlug: registered.body.tenant.slug }).expect(429);
    await prisma.tenant.delete({ where: { id: registered.body.tenant.id } });
    await prisma.user.delete({ where: { email: throttleEmail } });
  });

  it('blocks password-spraying attempts across different accounts from one IP', async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    for (let attempt = 0; attempt < 30; attempt++) {
      await request(app.getHttpServer()).post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: `spray-${attempt}-${suffix}@pulseops.test`, password: 'Wrong-Password-2026!', tenantSlug: 'unknown-workspace' })
        .expect(401);
    }
    await request(app.getHttpServer()).post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: `spray-final-${suffix}@pulseops.test`, password: 'Wrong-Password-2026!', tenantSlug: 'unknown-workspace' })
      .expect(429);
  });

  it('rate-limits registration attempts for the same normalized email across different IPs', async () => {
    const registrationEmail = `registration-limit-${suffix}@pulseops.test`;
    let tenantId: string | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request(app.getHttpServer()).post('/api/v1/auth/register')
        .set('X-Forwarded-For', `203.0.113.${attempt + 10}`)
        .send({
          name: 'Registration Limit',
          email: attempt === 0 ? registrationEmail : registrationEmail.toUpperCase(),
          password,
          tenantName: `Registration Workspace ${suffix}`,
        });
      if (attempt === 0) {
        expect(response.status).toBe(201);
        tenantId = response.body.tenant.id;
      } else {
        expect(response.status).toBe(409);
      }
    }
    await request(app.getHttpServer()).post('/api/v1/auth/register')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ name: 'Registration Limit', email: registrationEmail, password, tenantName: `Registration Workspace ${suffix}` })
      .expect(429);
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { email: registrationEmail } });
  });
});
