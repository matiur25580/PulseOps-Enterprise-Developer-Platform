export const JWT_ISSUER = 'pulseops-api';
export const JWT_AUDIENCE = 'pulseops-web';

const DEVELOPMENT_JWT_SECRET = 'local-development-only-change-me';

export interface JwtEnvironment {
  NODE_ENV?: string;
  JWT_SECRET?: string;
}

export function getJwtModuleOptions(env: JwtEnvironment = process.env) {
  const production = env.NODE_ENV === 'production';
  const secret = env.JWT_SECRET ?? (production ? undefined : DEVELOPMENT_JWT_SECRET);

  if (!secret) {
    throw new Error('JWT_SECRET is required in production');
  }

  if (production && (secret.length < 32 || secret === DEVELOPMENT_JWT_SECRET)) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production; generate a unique random secret');
  }

  return {
    secret,
    signOptions: {
      expiresIn: '15m' as const,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
    verifyOptions: {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  };
}
