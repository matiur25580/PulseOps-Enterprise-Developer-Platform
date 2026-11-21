import { ForbiddenException } from '@nestjs/common';
import { assertTrustedOrigin } from './trusted-origin';

describe('assertTrustedOrigin', () => {
  const trustedOrigin = 'https://app.example.com';

  it('accepts the configured frontend origin', () => {
    expect(() => assertTrustedOrigin(
      { headers: { origin: trustedOrigin } } as never,
      trustedOrigin,
      'production',
    )).not.toThrow();
  });

  it('rejects a different origin', () => {
    expect(() => assertTrustedOrigin(
      { headers: { origin: 'https://attacker.example' } } as never,
      trustedOrigin,
      'production',
    )).toThrow(ForbiddenException);
  });

  it('rejects a missing Origin header in production', () => {
    expect(() => assertTrustedOrigin(
      { headers: {} } as never,
      trustedOrigin,
      'production',
    )).toThrow(ForbiddenException);
  });

  it('rejects production configuration without WEB_ORIGIN', () => {
    expect(() => assertTrustedOrigin(
      { headers: { origin: trustedOrigin } } as never,
      undefined,
      'production',
    )).toThrow(ForbiddenException);
  });

  it('allows origin-less non-production clients', () => {
    expect(() => assertTrustedOrigin(
      { headers: {} } as never,
      trustedOrigin,
      'test',
    )).not.toThrow();
  });

  it('continues to allow origin-less development when no origin is configured', () => {
    expect(() => assertTrustedOrigin(
      { headers: {} } as never,
      undefined,
      'development',
    )).not.toThrow();
  });
});
