import { expect, test } from '@playwright/test';

test('workspace owner can manage services and members while invited members get read-only access', async ({ page, browser }) => {
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

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto('/accept-invitation');
  await memberPage.getByLabel('Your name').fill('Browser Invited Member');
  await memberPage.getByLabel('Invited email').fill(memberEmail);
  await memberPage.getByLabel(/Password/).fill('Member-Browser-Password-2026!');
  await memberPage.getByLabel('One-time invitation token').fill(acceptanceToken);
  await memberPage.getByRole('button', { name: /Accept invitation/ }).click();
  await expect(memberPage.getByRole('heading', { name: /You're in/ })).toBeVisible();
  await memberPage.getByRole('link', { name: /Continue to sign in/ }).click();
  // Accepting an invitation establishes a refresh-cookie session; the home page restores it automatically.
  await expect(memberPage.getByRole('heading', { name: 'Workspace members' })).toBeVisible();
  await expect(memberPage.getByRole('heading', { name: 'Delivery & FinOps' })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'Create budget' })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: 'Add reference' })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: /Create team/ })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: /Register service/ })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: /Create invitation/ })).toHaveCount(0);
  await memberPage.close();
  await memberContext.close();

  await page.getByLabel('Service name').fill('Browser Payments API');
  await page.getByLabel('Owning team').selectOption({ label: 'Browser Platform Team' });
  await page.getByLabel('Slug').fill(`browser-payments-${suffix}`);
  await page.getByLabel('Description', { exact: true }).fill('Created by a real browser test');
  await page.getByRole('button', { name: /Register service/ }).click();
  await expect(page.getByRole('heading', { name: 'Browser Payments API' })).toBeVisible();
  await expect(page.getByText('Owner: Browser Platform Team')).toBeVisible();

  const serviceRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser Payments API' }) });
  await serviceRow.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Service name').fill('Browser Payments API Updated');
  await page.getByRole('button', { name: /Save changes/ }).click();
  await expect(page.getByRole('heading', { name: 'Browser Payments API Updated' })).toBeVisible();

  await page.getByLabel('Service name').fill('Browser Notifications API');
  await page.getByLabel('Slug').fill(`browser-notifications-${suffix}`);
  await page.getByRole('button', { name: /Register service/ }).click();
  await expect(page.getByRole('heading', { name: 'Browser Notifications API' })).toBeVisible();

  await page.getByLabel('Upstream service').selectOption({ label: 'Browser Payments API Updated' });
  await page.getByLabel('Downstream service').selectOption({ label: 'Browser Notifications API' });
  await page.getByRole('button', { name: 'Add edge' }).click();
  await expect(page.locator('.dependency-edge')).toContainText('Browser Payments API Updated');
  await expect(page.locator('.dependency-edge')).toContainText('Browser Notifications API');

  await page.locator('.slo-form').getByLabel('Service').selectOption({ label: 'Browser Payments API Updated' });
  await page.getByLabel('SLO name').fill('Browser API availability');
  await page.getByRole('button', { name: 'Create SLO' }).click();
  await expect(page.locator('.slo-card')).toContainText('Browser API availability');
  await page.locator('.sample-form').getByLabel('SLO').selectOption({ label: 'Browser API availability' });
  await page.getByLabel('Outcome').selectOption('true');
  await page.getByRole('button', { name: 'Record SLI sample' }).click();
  await expect(page.locator('.slo-card')).toContainText('100.000%');


  await expect(page.getByRole('heading', { name: 'Delivery & FinOps' })).toBeVisible();
  await page.getByLabel('Budget name').fill('Browser monthly cloud budget');
  await page.getByLabel('Amount').fill('10');
  await page.getByLabel('Currency').fill('USD');
  await page.getByLabel('Alert threshold %').fill('80');
  await page.getByRole('button', { name: 'Create budget' }).click();
  await expect(page.locator('.budget-row')).toContainText('Browser monthly cloud budget');

  const billingMonth = new Date().toISOString().slice(0, 7);
  const costPayload = {
    records: [{
      provider: 'AWS',
      sourceRecordId: 'browser-cost-' + suffix,
      resourceId: 'i-browser-' + suffix,
      billingPeriodStart: billingMonth + '-01T00:00:00.000Z',
      costAmount: 12.5,
      currency: 'USD',
      tags: { environment: 'test' },
    }],
  };
  await page.getByLabel('JSON payload').fill(JSON.stringify(costPayload));
  await page.getByRole('button', { name: /Import up to 500 records/ }).click();
  await expect(page.locator('.finops-summary')).toContainText('1 cost line item');
  await page.getByRole('button', { name: 'Evaluate thresholds' }).click();
  await expect(page.getByText(/1 threshold\(s\) reached/)).toBeVisible();

  await page.locator('.operations-panel').getByLabel('SERVICE').selectOption({ label: 'Browser Payments API Updated' });
  await page.getByLabel('Reference title').fill('Payments recovery runbook');
  await page.locator('.runbook-form').getByLabel('URL').fill('https://docs.example.com/payments/recovery');
  await page.getByLabel('Category').selectOption('RUNBOOK');
  await page.getByLabel('Set as primary').check();
  await page.getByRole('button', { name: 'Add reference' }).click();
  await expect(page.locator('.runbook-row')).toContainText('Payments recovery runbook');
  await page.getByLabel('Primary contact').fill('primary-oncall@pulseops.test');
  await page.getByLabel('Secondary contact').fill('secondary-oncall@pulseops.test');
  await page.getByLabel('Escalate after (minutes)').fill('15');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.getByText(/Primary: primary-oncall@pulseops.test/)).toBeVisible();

  await page.getByLabel('Incident title').fill('Browser API latency');
  await page.getByLabel('Incident description').fill('Latency increased after a deployment');
  await page.locator('.workspace-members .team-form').getByLabel('Service').selectOption({ label: 'Browser Payments API Updated' });
  await page.getByLabel('Severity').selectOption('HIGH');
  await page.getByRole('button', { name: /Create incident/ }).click();
  const incidentRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser API latency' }) });
  await expect(incidentRow).toContainText('HIGH · OPEN');
  await expect(incidentRow).toContainText('Service: Browser Payments API Updated');
  await incidentRow.getByRole('button', { name: 'Escalate' }).click();
  await expect(incidentRow).toContainText('Escalation L1');
  await incidentRow.getByRole('button', { name: 'Escalate' }).click();
  await expect(incidentRow).toContainText('Escalation L2');
  await incidentRow.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(incidentRow).toContainText('ACKNOWLEDGED');
  await incidentRow.getByRole('button', { name: 'Resolve' }).click();
  await expect(incidentRow).toContainText('RESOLVED');
  await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
  await expect(page.getByText('INCIDENT_RESOLVED')).toBeVisible();

  const updatedRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser Payments API Updated' }) });
  page.once('dialog', dialog => dialog.accept());
  await updatedRow.getByRole('button', { name: 'Delete' }).click();
  const notificationsRow = page.locator('.service-row').filter({ has: page.getByRole('heading', { name: 'Browser Notifications API' }) });
  page.once('dialog', dialog => dialog.accept());
  await notificationsRow.getByRole('button', { name: 'Delete' }).click();
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
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Workspace name or slug').fill(tenantSlug);
  await page.getByRole('button', { name: /Sign in/ }).last().click();
  await expect(page.getByRole('heading', { name: 'Your workspace.' })).toBeVisible();
  await expect(page.getByText('Signed in successfully.')).toBeVisible();
});
