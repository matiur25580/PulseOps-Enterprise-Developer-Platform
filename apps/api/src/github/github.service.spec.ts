import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { GitHubService } from './github.service';

describe('GitHubService webhook ingestion and DORA metrics', () => {
  const secret = 'test-webhook-secret';
  const raw = Buffer.from('{"repository":{"full_name":"acme/payments"}}');
  const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const audit = { record: jest.fn().mockResolvedValue({}) };
  let prisma: any;
  let service: GitHubService;

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    prisma = {
      gitHubRepositoryIntegration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'integration-1' }),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      gitHubWebhookDelivery: { create: jest.fn() },
      gitHubPullRequest: { upsert: jest.fn(), findMany: jest.fn() },
      deploymentRecord: { upsert: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn() },
      incident: { findMany: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    };
    service = new GitHubService(prisma, audit as never);
    jest.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  afterEach(() => { delete process.env.GITHUB_WEBHOOK_SECRET; });

  it('rejects invalid signatures before looking up a repository', async () => {
    await expect(service.receiveWebhook('delivery-1', 'pull_request', 'sha256=' + '0'.repeat(64), raw, {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.gitHubRepositoryIntegration.findFirst).not.toHaveBeenCalled();
  });

  it('persists a merged pull request and delivery atomically', async () => {
    const createdAt = '2026-11-01T10:00:00.000Z';
    const mergedAt = '2026-11-02T10:00:00.000Z';
    const payload = {
      action: 'closed',
      repository: { full_name: 'acme/payments' },
      pull_request: {
        number: 42, merged: true, title: 'Improve payment retries',
        html_url: 'https://github.com/acme/payments/pull/42',
        created_at: createdAt, merged_at: mergedAt, merge_commit_sha: 'abc123',
        head: { sha: 'head123' }, base: { ref: 'main' },
      },
    };
    const result = await service.receiveWebhook('delivery-42', 'pull_request', signature, raw, payload);
    expect(result).toEqual({ accepted: true, processed: true });
    expect(prisma.gitHubWebhookDelivery.create).toHaveBeenCalledWith({
      data: { deliveryId: 'delivery-42', integrationId: 'integration-1', eventName: 'pull_request', action: 'closed' },
    });
    expect(prisma.gitHubPullRequest.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { integrationId_number: { integrationId: 'integration-1', number: 42 } },
      create: expect.objectContaining({ mergeCommitSha: 'abc123', state: 'merged' }),
    }));
  });

  it('ignores a correctly signed webhook for a repository not connected to PulseOps', async () => {
    prisma.gitHubRepositoryIntegration.findFirst.mockResolvedValue(null);
    const result = await service.receiveWebhook('delivery-2', 'issues', signature, raw, { repository: { full_name: 'acme/payments' } });
    expect(result).toEqual({ accepted: true, ignored: true, reason: 'repository_not_connected' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('calculates deployment frequency, median PR-to-deploy lead time, failure rate and MTTR', async () => {
    const now = Date.now();
    const merge = new Date(now - 72 * 3600000);
    prisma.gitHubRepositoryIntegration.findMany.mockResolvedValue([
      { id: 'integration-1', repositoryFullName: 'acme/payments', service: { id: 'service-1', name: 'Payments' } },
    ]);
    prisma.deploymentRecord.findMany.mockResolvedValue([
      { integrationId: 'integration-1', githubDeploymentId: '1', sha: 'merge-sha', state: 'success', deployedAt: new Date(now - 24 * 3600000) },
      { integrationId: 'integration-1', githubDeploymentId: '2', sha: 'other-sha', state: 'success', deployedAt: new Date(now - 12 * 3600000) },
      { integrationId: 'integration-1', githubDeploymentId: '3', sha: 'failed-sha', state: 'failure', deployedAt: null },
    ]);
    prisma.gitHubPullRequest.findMany.mockResolvedValue([
      { integrationId: 'integration-1', mergeCommitSha: 'merge-sha', mergedAt: merge },
    ]);
    prisma.incident.findMany.mockResolvedValue([
      { createdAt: new Date(now - 5 * 3600000), resolvedAt: new Date(now - 3600000) },
    ]);

    const result = await service.getDoraMetrics('tenant-1', 30);
    expect(result.deploymentFrequencyPerDay).toBe(0.067);
    expect(result.deploymentFrequencyPerWeek).toBe(0.467);
    expect(result.leadTimeForChangesHours).toBe(48);
    expect(result.changeFailureRatePercent).toBe(33.33);
    expect(result.meanTimeToRestoreHours).toBe(4);
    expect(result.sampleSizes).toMatchObject({ successfulDeployments: 2, failedDeployments: 1, deploymentAttempts: 3, leadTimeSamples: 1, resolvedIncidents: 1 });
  });
  it('does not let an older deployment status overwrite a newer status', async () => {
    const newer = new Date('2026-11-18T12:00:00.000Z');
    prisma.deploymentRecord.findUnique.mockResolvedValue({ statusUpdatedAt: newer, deployedAt: null });
    const payload = {
      repository: { full_name: 'acme/payments' },
      deployment: { id: 88, sha: 'abc', ref: 'main', environment: 'production' },
      deployment_status: { id: 99, state: 'success', created_at: '2026-11-18T11:00:00.000Z' },
    };
    const result = await service.receiveWebhook('delivery-old', 'deployment_status', signature, raw, payload);
    expect(result).toEqual({ accepted: true, processed: true });
    expect(prisma.deploymentRecord.upsert).not.toHaveBeenCalled();
  });

});
