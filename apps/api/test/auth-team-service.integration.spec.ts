import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PostgreSQL auth → team → service workflow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `it-${suffix}@pulseops.test`;
  const password = 'Integration-Test-Password-2026!';
  let token = '';
  let tenantSlug = '';
  let teamId = '';
  let serviceId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.tenant.deleteMany({ where: { slug: { startsWith: `integration-${suffix}` } } });
      await prisma.user.deleteMany({ where: { email } });
    }
    await app?.close();
  });

  it('registers, logs in, creates a team and persists a service under the authenticated tenant', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Integration Owner', email, password, tenantName: `Integration ${suffix}` })
      .expect(201);

    token = registered.body.accessToken;
    tenantSlug = registered.body.tenant.slug;
    expect(registered.body.role).toBe('ADMIN');
    expect(token).toBeTruthy();

    const loggedIn = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password, tenantSlug })
      .expect(201);
    token = loggedIn.body.accessToken;

    await request(app.getHttpServer()).get('/api/v1/teams').expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Injected Tenant Team', tenantId: '00000000-0000-4000-8000-000000000001' })
      .expect(400);

    const team = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Platform Engineering', email: 'platform@pulseops.test' })
      .expect(201);
    teamId = team.body.id;

    const service = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Payments API', slug: `payments-${suffix}`, description: 'Integration workflow service', teamId })
      .expect(201);
    serviceId = service.body.id;
    expect(service.body.tenantId).toBe(registered.body.tenant.id);
    expect(service.body.teamId).toBe(teamId);

    const updatedTeam = await request(app.getHttpServer())
      .patch(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Platform Reliability' })
      .expect(200);
    expect(updatedTeam.body.name).toBe('Platform Reliability');

    const persisted = await prisma.service.findUnique({ where: { id: serviceId }, include: { team: true } });
    expect(persisted?.name).toBe('Payments API');
    expect(persisted?.team?.name).toBe('Platform Reliability');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.some((item: { id: string }) => item.id === serviceId)).toBe(true);
  });

  it('rejects cross-tenant team assignment and does not trust a submitted tenantId', async () => {
    const otherEmail = `other-${suffix}@pulseops.test`;
    const other = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Other Owner', email: otherEmail, password, tenantName: `Other ${suffix}` })
      .expect(201);

    try {
      await request(app.getHttpServer())
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${other.body.accessToken}`)
        .send({ name: 'Foreign Team Service', slug: `foreign-${suffix}`, teamId })
        .expect(404);

      const otherServices = await request(app.getHttpServer())
        .get('/api/v1/services')
        .set('Authorization', `Bearer ${other.body.accessToken}`)
        .expect(200);
      expect(otherServices.body).toHaveLength(0);

      const otherTenant = await prisma.tenant.findUnique({ where: { id: other.body.tenant.id } });
      expect(otherTenant).toBeTruthy();
      expect(otherTenant?.id).not.toBe((await prisma.service.findUnique({ where: { id: serviceId } }))?.tenantId);
    } finally {
      await prisma.tenant.delete({ where: { id: other.body.tenant.id } });
      await prisma.user.delete({ where: { email: otherEmail } });
    }
  });

  it('invites a member, enforces live RBAC, and revokes removed member access', async () => {
    const memberEmail = 'member-' + suffix + '@pulseops.test';
    const invitation = await request(app.getHttpServer()).post('/api/v1/members/invitations').set('Authorization', 'Bearer ' + token).send({ email: memberEmail }).expect(201);
    expect(invitation.body.invitation.role).toBe('MEMBER');
    expect(invitation.body.acceptanceToken).toHaveLength(64);
    const accepted = await request(app.getHttpServer()).post('/api/v1/auth/accept-invitation').send({ name: 'Invited Member', email: memberEmail, password, token: invitation.body.acceptanceToken }).expect(201);
    const memberToken = accepted.body.accessToken;
    const members = await request(app.getHttpServer()).get('/api/v1/members').set('Authorization', 'Bearer ' + token).expect(200);
    expect(members.body.find((row: { user: { email: string } }) => row.user.email === memberEmail)?.role).toBe('MEMBER');
    await request(app.getHttpServer()).get('/api/v1/teams').set('Authorization', 'Bearer ' + memberToken).expect(200);
    await request(app.getHttpServer()).post('/api/v1/members/invitations').set('Authorization', 'Bearer ' + memberToken).send({ email: 'blocked-invite-' + suffix + '@pulseops.test' }).expect(403);
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    await request(app.getHttpServer()).patch('/api/v1/members/' + owner?.id + '/role').set('Authorization', 'Bearer ' + token).send({ role: 'MEMBER' }).expect(409);
    await request(app.getHttpServer()).post('/api/v1/teams').set('Authorization', 'Bearer ' + memberToken).send({ name: 'Member Forbidden Team' }).expect(403);
    await request(app.getHttpServer()).patch('/api/v1/members/' + accepted.body.user.id + '/role').set('Authorization', 'Bearer ' + token).send({ role: 'ADMIN' }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/teams').set('Authorization', 'Bearer ' + memberToken).send({ name: 'Delegated Admin Team' }).expect(201);
    await request(app.getHttpServer()).patch('/api/v1/members/' + accepted.body.user.id + '/role').set('Authorization', 'Bearer ' + token).send({ role: 'MEMBER' }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/teams').set('Authorization', 'Bearer ' + memberToken).send({ name: 'Role Downgrade Forbidden Team' }).expect(403);
    await request(app.getHttpServer()).delete('/api/v1/members/' + accepted.body.user.id).set('Authorization', 'Bearer ' + token).expect(200);
    await request(app.getHttpServer()).get('/api/v1/teams').set('Authorization', 'Bearer ' + memberToken).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/accept-invitation').send({ name: 'Invited Member', email: memberEmail, password, token: invitation.body.acceptanceToken }).expect(401);
    const revokeEmail = 'revoked-' + suffix + '@pulseops.test';
    const revoked = await request(app.getHttpServer()).post('/api/v1/members/invitations').set('Authorization', 'Bearer ' + token).send({ email: revokeEmail }).expect(201);
    await request(app.getHttpServer()).delete('/api/v1/members/invitations/' + revoked.body.invitation.id).set('Authorization', 'Bearer ' + token).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/accept-invitation').send({ name: 'Revoked Invite', email: revokeEmail, password, token: revoked.body.acceptanceToken }).expect(401);
    await prisma.user.deleteMany({ where: { email: memberEmail } });
  });

  it('keeps tenant scope on team and service lists', async () => {
    const teams = await request(app.getHttpServer())
      .get('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(teams.body.some((item: { id: string }) => item.id === teamId)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const orphanSafeService = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(orphanSafeService?.teamId).toBeNull();
  });
});
