import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGitHubRepositoryDto } from './dto/create-github-repository.dto';

type JsonRecord = Record<string, any>;

@Injectable()
export class GitHubService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async createRepository(tenantId: string, actorId: string, input: CreateGitHubRepositoryDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, tenantId }, select: { id: true, repository: true },
    });
    if (!service) throw new NotFoundException('Service not found in this workspace');
    if (service.repository) {
      const expected = this.repositoryName(service.repository);
      if (expected && expected.toLowerCase() !== input.repositoryFullName.toLowerCase()) {
        throw new BadRequestException('Repository must match the service catalog URL');
      }
    }
    try {
      const integration = await this.prisma.gitHubRepositoryIntegration.create({
        data: { tenantId, serviceId: service.id, repositoryFullName: input.repositoryFullName.toLowerCase() },
        select: { id: true, serviceId: true, repositoryFullName: true, active: true, createdAt: true },
      });
      await this.audit.record({ tenantId, actorId, action: 'GITHUB_REPOSITORY_CONNECTED', entityType: 'GITHUB_REPOSITORY', entityId: integration.id });
      return { ...integration, webhook: { urlPath: '/api/v1/integrations/github/webhook', secretConfigured: Boolean(process.env.GITHUB_WEBHOOK_SECRET) } };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This GitHub repository is already connected');
      }
      throw error;
    }
  }

  listRepositories(tenantId: string) {
    return this.prisma.gitHubRepositoryIntegration.findMany({
      where: { tenantId },
      include: { service: { select: { id: true, name: true, repository: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async disableRepository(tenantId: string, actorId: string, id: string) {
    const integration = await this.prisma.gitHubRepositoryIntegration.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!integration) throw new NotFoundException('GitHub repository integration not found');
    const updated = await this.prisma.gitHubRepositoryIntegration.update({ where: { id }, data: { active: false } });
    await this.audit.record({ tenantId, actorId, action: 'GITHUB_REPOSITORY_DISABLED', entityType: 'GITHUB_REPOSITORY', entityId: id });
    return { id: updated.id, active: updated.active };
  }

  async receiveWebhook(deliveryId: string, eventName: string, signature: string, rawBody: Buffer | undefined, body: unknown) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) throw new InternalServerErrorException('GitHub webhook integration is not configured');
    if (!deliveryId || deliveryId.length > 200 || !eventName || eventName.length > 100 || !rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Missing or invalid GitHub webhook headers or raw body');
    }
    this.verifySignature(secret, signature, rawBody);
    const payload = this.asRecord(body);
    const repository = this.asRecord(payload.repository);
    const repositoryFullName = typeof repository.full_name === 'string' ? repository.full_name.toLowerCase() : '';
    if (!repositoryFullName) throw new BadRequestException('Webhook payload is missing repository.full_name');

    const integration = await this.prisma.gitHubRepositoryIntegration.findFirst({
      where: { repositoryFullName, active: true }, select: { id: true },
    });
    if (!integration) return { accepted: true, ignored: true, reason: 'repository_not_connected' };

    try {
      await this.prisma.$transaction(async tx => {
        await tx.gitHubWebhookDelivery.create({
          data: { deliveryId, integrationId: integration.id, eventName, action: typeof payload.action === 'string' ? payload.action : null },
        });
        if (eventName === 'pull_request') await this.persistPullRequest(tx, integration.id, payload);
        if (eventName === 'deployment_status') await this.persistDeployment(tx, integration.id, payload);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { accepted: true, duplicate: true };
      }
      throw error;
    }
    return { accepted: true, processed: true };
  }

  async getDoraMetrics(tenantId: string, windowDays: number) {
    const since = new Date(Date.now() - windowDays * 86400000);
    const integrations = await this.prisma.gitHubRepositoryIntegration.findMany({
      where: { tenantId, active: true },
      select: { id: true, repositoryFullName: true, service: { select: { id: true, name: true } } },
    });
    const ids = integrations.map(item => item.id);
    if (!ids.length) {
      return {
        windowDays, generatedAt: new Date().toISOString(),
        deploymentFrequencyPerDay: 0, deploymentFrequencyPerWeek: 0,
        leadTimeForChangesHours: null, changeFailureRatePercent: null, meanTimeToRestoreHours: null,
        sampleSizes: { successfulDeployments: 0, failedDeployments: 0, deploymentAttempts: 0, mergedPullRequests: 0, leadTimeSamples: 0, resolvedIncidents: 0 },
        services: [], limitations: ['No active GitHub repositories are connected.'],
      };
    }
    const [deployments, pullRequests, incidents] = await Promise.all([
      this.prisma.deploymentRecord.findMany({
        where: { integrationId: { in: ids }, OR: [
          { state: { in: ['success', 'inactive'] }, deployedAt: { gte: since } },
          { state: { in: ['failure', 'error'] }, statusUpdatedAt: { gte: since } },
        ] },
        select: { integrationId: true, githubDeploymentId: true, sha: true, state: true, deployedAt: true },
      }),
      this.prisma.gitHubPullRequest.findMany({
        where: { integrationId: { in: ids }, mergedAt: { gte: since } },
        select: { integrationId: true, mergeCommitSha: true, mergedAt: true },
      }),
      this.prisma.incident.findMany({
        where: { tenantId, status: 'RESOLVED', resolvedAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);
    const successful = deployments.filter(item => ['success', 'inactive'].includes(item.state) && item.deployedAt);
    const failed = deployments.filter(item => ['failure', 'error'].includes(item.state));
    const mergeBySha = new Map<string, Date>();
    for (const pr of pullRequests) {
      if (pr.mergeCommitSha && pr.mergedAt) mergeBySha.set(pr.integrationId + ':' + pr.mergeCommitSha, pr.mergedAt);
    }
    const leadTimes = successful.flatMap(item => {
      const mergedAt = mergeBySha.get(item.integrationId + ':' + item.sha);
      return mergedAt && item.deployedAt && item.deployedAt >= mergedAt
        ? [(item.deployedAt.getTime() - mergedAt.getTime()) / 3600000] : [];
    }).sort((a, b) => a - b);
    const median = leadTimes.length
      ? (leadTimes.length % 2 ? leadTimes[Math.floor(leadTimes.length / 2)] : (leadTimes[leadTimes.length / 2 - 1] + leadTimes[leadTimes.length / 2]) / 2)
      : null;
    const restoreTimes = incidents.flatMap(item => item.resolvedAt
      ? [(item.resolvedAt.getTime() - item.createdAt.getTime()) / 3600000] : []);
    const mttr = restoreTimes.length ? restoreTimes.reduce((sum, value) => sum + value, 0) / restoreTimes.length : null;
    const attempts = successful.length + failed.length;
    return {
      windowDays, generatedAt: new Date().toISOString(),
      deploymentFrequencyPerDay: Number((successful.length / windowDays).toFixed(3)),
      deploymentFrequencyPerWeek: Number((successful.length / windowDays * 7).toFixed(3)),
      leadTimeForChangesHours: median === null ? null : Number(median.toFixed(2)),
      changeFailureRatePercent: attempts ? Number((failed.length / attempts * 100).toFixed(2)) : null,
      meanTimeToRestoreHours: mttr === null ? null : Number(mttr.toFixed(2)),
      sampleSizes: { successfulDeployments: successful.length, failedDeployments: failed.length, deploymentAttempts: attempts, mergedPullRequests: pullRequests.length, leadTimeSamples: leadTimes.length, resolvedIncidents: incidents.length },
      services: integrations.map(item => ({ serviceId: item.service.id, serviceName: item.service.name, repository: item.repositoryFullName })),
      limitations: [
        'Deployment frequency and change failure rate use GitHub deployment_status webhook records; configure environments consistently.',
        'Lead time is the median interval from merged PR to successful deployment with an exactly matching merge commit SHA; unmatched deployments are excluded.',
        'Change failure rate treats GitHub deployment states failure, error and inactive as failed attempts. It is a webhook-derived proxy, not confirmed incident causality.',
        'MTTR is the mean interval from incident creation to resolution for workspace incidents resolved in the selected window.',
      ],
    };
  }

  private verifySignature(secret: string, signature: string, rawBody: Buffer) {
    if (!/^sha256=[0-9a-f]{64}$/i.test(signature || '')) throw new UnauthorizedException('Invalid GitHub webhook signature');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const actual = Buffer.from(signature.slice(7), 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }
  }

  private async persistPullRequest(tx: Prisma.TransactionClient, integrationId: string, payload: JsonRecord) {
    if (payload.action !== 'closed' || payload.pull_request?.merged !== true) return;
    const pr = this.asRecord(payload.pull_request);
    const number = Number(pr.number);
    const mergedAt = new Date(pr.merged_at);
    const createdAt = new Date(pr.created_at);
    if (!Number.isInteger(number) || number < 1 || Number.isNaN(mergedAt.getTime()) || Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('Invalid merged pull request payload');
    }
    await tx.gitHubPullRequest.upsert({
      where: { integrationId_number: { integrationId, number } },
      create: {
        integrationId, number, title: String(pr.title || '').slice(0, 500), url: String(pr.html_url || ''),
        state: 'merged', mergedAt, mergeCommitSha: typeof pr.merge_commit_sha === 'string' ? pr.merge_commit_sha : null,
        headSha: String(pr.head?.sha || ''), baseRef: String(pr.base?.ref || ''), createdAt,
      },
      update: {
        title: String(pr.title || '').slice(0, 500), state: 'merged', mergedAt,
        mergeCommitSha: typeof pr.merge_commit_sha === 'string' ? pr.merge_commit_sha : null,
        headSha: String(pr.head?.sha || ''), baseRef: String(pr.base?.ref || ''),
      },
    });
  }

  private async persistDeployment(tx: Prisma.TransactionClient, integrationId: string, payload: JsonRecord) {
    const deployment = this.asRecord(payload.deployment);
    const status = this.asRecord(payload.deployment_status);
    const state = typeof status.state === 'string' ? status.state.toLowerCase() : '';
    if (!['success', 'failure', 'error', 'inactive'].includes(state)) return;
    const deploymentId = String(deployment.id || '');
    const statusId = String(status.id || '');
    const updatedAt = new Date(status.created_at);
    if (!deploymentId || !statusId || Number.isNaN(updatedAt.getTime()) || typeof deployment.sha !== 'string') {
      throw new BadRequestException('Invalid deployment status payload');
    }
    const where = { integrationId_githubDeploymentId: { integrationId, githubDeploymentId: deploymentId } };
    const existing = await tx.deploymentRecord.findUnique({ where });
    // GitHub may retry or deliver status updates out of order; never roll a deployment backwards in time.
    if (existing && existing.statusUpdatedAt > updatedAt) return;
    const deployedAt = state === 'success' ? updatedAt : state === 'inactive' ? existing?.deployedAt ?? null : null;
    await tx.deploymentRecord.upsert({
      where,
      create: {
        integrationId, githubDeploymentId: deploymentId, statusId, sha: deployment.sha,
        ref: String(deployment.ref || ''), environment: String(deployment.environment || 'unknown'),
        state, deployedAt, statusUpdatedAt: updatedAt,
      },
      update: {
        statusId, sha: deployment.sha, ref: String(deployment.ref || ''),
        environment: String(deployment.environment || 'unknown'), state, deployedAt, statusUpdatedAt: updatedAt,
      },
    });
  }

  private repositoryName(repositoryUrl: string): string | null {
    try {
      const url = new URL(repositoryUrl);
      if (url.hostname.toLowerCase() !== 'github.com') return null;
      return url.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    } catch { return null; }
  }

  private asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  }
}
