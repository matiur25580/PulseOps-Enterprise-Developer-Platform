import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Enforce the configured browser origin on endpoints that read or mutate
 * authentication cookies. Production browser requests must carry Origin;
 * non-browser development/test clients may omit it.
 */
export function assertTrustedOrigin(
  request: Pick<Request, 'headers'>,
  webOrigin = process.env.WEB_ORIGIN,
  nodeEnv = process.env.NODE_ENV,
): void {
  const origin = request.headers.origin;

  if (nodeEnv === 'production' && !webOrigin) {
    throw new ForbiddenException('WEB_ORIGIN must be configured for cookie-authenticated requests');
  }
  if (nodeEnv === 'production' && !origin) {
    throw new ForbiddenException('Origin header is required for cookie-authenticated requests');
  }
  if (origin && webOrigin && origin !== webOrigin) {
    throw new ForbiddenException('Untrusted request origin');
  }
}
