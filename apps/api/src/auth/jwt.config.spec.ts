import { getJwtModuleOptions, JWT_AUDIENCE, JWT_ISSUER } from './jwt.config';

describe('getJwtModuleOptions', () => {
  it('uses a development-only fallback outside production', () => {
    const options = getJwtModuleOptions({ NODE_ENV: 'test' });
    expect(options.secret).toBe('local-development-only-change-me');
    expect(options.signOptions.issuer).toBe(JWT_ISSUER);
    expect(options.signOptions.audience).toBe(JWT_AUDIENCE);
    expect(options.verifyOptions).toEqual({ issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
  });

  it('requires a production secret', () => {
    expect(() => getJwtModuleOptions({ NODE_ENV: 'production' })).toThrow(
      'JWT_SECRET is required in production',
    );
  });

  it('rejects short or known development secrets in production', () => {
    expect(() => getJwtModuleOptions({ NODE_ENV: 'production', JWT_SECRET: 'too-short' })).toThrow(
      'JWT_SECRET must contain at least 32 characters in production',
    );
    expect(() =>
      getJwtModuleOptions({
        NODE_ENV: 'production',
        JWT_SECRET: 'local-development-only-change-me',
      }),
    ).toThrow('JWT_SECRET must contain at least 32 characters in production');
  });

  it('accepts a sufficiently long production secret', () => {
    const secret = 'a-random-production-secret-with-more-than-32-characters';
    const options = getJwtModuleOptions({ NODE_ENV: 'production', JWT_SECRET: secret });
    expect(options.secret).toBe(secret);
    expect(options.signOptions.expiresIn).toBe('15m');
  });
});
