import { expect, test } from '@playwright/test';

test('workspace owner can manage services and members while invited members get read-only access', async ({ page }) => {
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
  await expect(page.locator('.team-row').filter({ hasText: 'Browser Platform Team' })).toBeVisible();
  const memberEmail = `member-browser-${suffix}@pulseops.test`;
  await page.getByLabel('Work email').fill(memberEmail);
  await page.getByRole('button', { name: /Create invitation/ }).click();
  const acceptanceToken = await page.locator('.invite-token code').innerText();
  expect(acceptanceToken).toHaveLength(64);

  const memberPage = await page.context().newPage();
  await memberPage.goto('/accept-invitation');
  await memberPage.getByLabel('Your name').fill('Browser Invited Member');
  await memberPage.getByLabel('Invited email').fill(memberEmail);
  await memberPage.getByLabel(/Password/).fill('Member-Browser-Password-2026!');
  await memberPage.getByLabel('One-time invitation token').fill(acceptanceToken);
  await memberPage.getByRole('button', { name: /Accept invitation/ }).click();
  await expect(memberPage.getByRole('heading', { name: /You're in/ })).toBeVisible();
  await memberPage.getByRole('link', { name: /Continue to sign in/ }).click();
  await memberPage.getByRole('button', { name: 'Sign in' }).click();
  await memberPage.getByLabel('Email address').fill(memberEmail);
  await memberPage.getByLabel('Password').fill('Member-Browser-Password-2026!');
  await memberPage.getByLabel('Workspace slug').fill(tenantSlug);
  await memberPage.getByRole('button', { name: /Sign in/ }).last().click();
  await expect(memberPage.getByRole('heading', { name: 'Workspace members' })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: /Create team/ })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: /Register service/ })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: /Create invitation/ })).toHaveCount(0);
  await memberPage.close();

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

  await page.getByLabel('Incident title').fill('Browser API latency');
  await page.getByLabel('Description', { exact: true }).last().fill('Latency increased after a deployment');
  await page.getByLabel('Severity').selectOption('HIGH');
  await page.getByRole('button', { name: /Create incident/ }).click();
  const incidentRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser API latency' }) });
  await expect(incidentRow).toContainText('HIGH · OPEN');
  await incidentRow.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(incidentRow).toContainText('ACKNOWLEDGED');
  await incidentRow.getByRole('button', { name: 'Resolve' }).click();
  await expect(incidentRow).toContainText('RESOLVED');
  await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
  await expect(page.getByText('INCIDENT_RESOLVED')).toBeVisible();

  const updatedRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser Payments API Updated' }) });
  page.once('dialog', dialog => dialog.accept());
  await updatedRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No services yet')).toBeVisible();

  const teamRow = page.locator('.team-row').filter({ hasText: 'Browser Platform Team' });
  await teamRow.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Team name').fill('Browser Platform Team Updated');
  await page.getByRole('button', { name: /Save team/ }).click();
  await expect(page.locator('.team-row').filter({ hasText: 'Browser Platform Team Updated' })).toBeVisible();
  const updatedTeamRow = page.locator('.team-row').filter({ hasText: 'Browser Platform Team Updated' });
  page.once('dialog', dialog => dialog.accept());
  await updatedTeamRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No teams yet in this workspace.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Workspace slug').fill(tenantSlug);
  await page.getByRole('button', { name: /Sign in/ }).last().click();
  await expect(page.getByRole('heading', { name: 'Your workspace.' })).toBeVisible();
  await expect(page.getByText('Signed in successfully.')).toBeVisible();
});
