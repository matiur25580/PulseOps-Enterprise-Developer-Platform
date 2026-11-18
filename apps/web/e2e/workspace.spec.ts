import { expect, test } from '@playwright/test';

test('workspace owner can register, create, edit and delete a service, then sign in again', async ({ page }) => {
  const suffix = `${Date.now()}`;
  const email = `browser-${suffix}@pulseops.test`;
  const password = 'Browser-Test-Password-2026!';

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start your workspace' })).toBeVisible();
  await page.getByLabel('Your name').fill('Browser Test Owner');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Workspace name').fill(`Browser Workspace ${suffix}`);
  await page.getByRole('button', { name: /Create workspace/ }).last().click();

  await expect(page.getByRole('heading', { name: 'Your workspace.' })).toBeVisible();
  const workspaceLine = await page.locator('.workspace-head .muted').innerText();
  const tenantSlug = workspaceLine.split(' · ')[0];
  await expect(page.getByText('Workspace created. Your Service Catalog and Team Management are ready.')).toBeVisible();

  await page.getByLabel('Team name').fill('Browser Platform Team');
  await page.getByLabel('Team contact email').fill('platform-browser@pulseops.test');
  await page.getByRole('button', { name: /Create team/ }).click();
  await expect(page.getByText('Browser Platform Team')).toBeVisible();
  await page.getByLabel('Service name').fill('Browser Payments API');
  await page.getByLabel('Owning team').selectOption({ label: 'Browser Platform Team' });
  await page.getByLabel('Slug').fill(`browser-payments-${suffix}`);
  await page.getByLabel('Description').fill('Created by a real browser test');
  await page.getByRole('button', { name: /Register service/ }).click();
  await expect(page.getByRole('heading', { name: 'Browser Payments API' })).toBeVisible();
  await expect(page.getByText('Owner: Browser Platform Team')).toBeVisible();

  const serviceRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser Payments API' }) });
  await serviceRow.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Service name').fill('Browser Payments API Updated');
  await page.getByRole('button', { name: /Save changes/ }).click();
  await expect(page.getByRole('heading', { name: 'Browser Payments API Updated' })).toBeVisible();

  const updatedRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser Payments API Updated' }) });
  page.once('dialog', dialog => dialog.accept());
  await updatedRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No services yet')).toBeVisible();

  const teamRow = page.locator('.team-row').filter({ hasText: 'Browser Platform Team' });
  await teamRow.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Team name').fill('Browser Platform Team Updated');
  await page.getByRole('button', { name: /Save team/ }).click();
  await expect(page.getByText('Browser Platform Team Updated')).toBeVisible();
  const updatedTeamRow = page.locator('.team-row').filter({ hasText: 'Browser Platform Team Updated' });
  page.once('dialog', dialog => dialog.accept());
  await updatedTeamRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No teams yet. Create a team to assign service ownership.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Workspace slug').fill(tenantSlug);
  await page.getByRole('button', { name: /Sign in/ }).last().click();
  await expect(page.getByRole('heading', { name: 'Your workspace.' })).toBeVisible();
  await expect(page.getByText('Signed in successfully.')).toBeVisible();
});
