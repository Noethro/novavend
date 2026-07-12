import { expect, test } from '@playwright/test';

test('shows the repository-bootstrap landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'NovaVend' })).toBeVisible();
});
