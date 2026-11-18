import { expect, test } from '@playwright/test';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

test('deployed browser origin can call the API health endpoint with credentialed CORS', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async (url) => {
    try {
      const response = await fetch(`${url}/api/v1/health`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      return {
        ok: response.ok,
        status: response.status,
        allowOrigin: response.headers.get('access-control-allow-origin'),
        allowCredentials: response.headers.get('access-control-allow-credentials'),
        body: await response.json(),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, apiBaseUrl);

  expect(result, 'The browser must be able to read the API response (not just reach the server)').toMatchObject({
    ok: true,
    status: 200,
    allowOrigin: new URL(page.url()).origin,
    allowCredentials: 'true',
    body: { status: 'ok', service: 'pulseops-api' },
  });
});
