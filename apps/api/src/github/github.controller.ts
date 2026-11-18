import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateGitHubRepositoryDto } from './dto/create-github-repository.dto';
import { DoraQueryDto } from './dto/dora-query.dto';
import { GitHubService } from './github.service';

@Controller('integrations/github')
export class GitHubWebhookController {
  constructor(private readonly github: GitHubService) {}
  @Post('webhook') @HttpCode(202)
  receive(@Headers('x-github-delivery') deliveryId: string, @Headers('x-github-event') eventName: string,
    @Headers('x-hub-signature-256') signature: string, @Req() request: RawBodyRequest<Request>) {
    return this.github.receiveWebhook(deliveryId, eventName, signature, request.rawBody, request.body);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/github/repositories')
export class GitHubRepositoriesController {
  constructor(private readonly github: GitHubService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.github.listRepositories(user.tenantId); }
  @Post() @Roles('ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGitHubRepositoryDto) {
    return this.github.createRepository(user.tenantId, user.sub, body);
  }
  @Delete(':id') @Roles('ADMIN')
  disable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.github.disableRepository(user.tenantId, user.sub, id);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('engineering-metrics')
export class DoraMetricsController {
  constructor(private readonly github: GitHubService) {}
  @Get('dora')
  getDora(@CurrentUser() user: AuthenticatedUser, @Query() query: DoraQueryDto) {
    return this.github.getDoraMetrics(user.tenantId, query.windowDays ?? 30);
  }
}
