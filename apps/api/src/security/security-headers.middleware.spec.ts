import { NextFunction, Request, Response } from 'express';
import { securityHeadersMiddleware } from './security-headers.middleware';

describe('securityHeadersMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let response: { setHeader: jest.Mock };

  beforeEach(() => {
    response = { setHeader: jest.fn() };
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('sets restrictive headers for API responses and continues the request', () => {
    process.env.NODE_ENV = 'test';
    const next = jest.fn() as NextFunction;

    securityHeadersMiddleware({} as Request, response as unknown as Response, next);

    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(response.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String),
    );
  });

  it('enables HSTS only in production', () => {
    process.env.NODE_ENV = 'production';
    const next = jest.fn() as NextFunction;

    securityHeadersMiddleware({} as Request, response as unknown as Response, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
