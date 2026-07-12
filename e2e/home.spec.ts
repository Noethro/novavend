import { expect, test } from '@playwright/test';

test('switches and persists dashboard languages across routes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Merchant overview' }),
  ).toBeVisible();

  await page.getByRole('combobox', { name: 'Language' }).selectOption('tr');
  await expect(
    page.getByRole('heading', { name: 'Satıcı genel bakışı' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Satıcı genel bakışı' }),
  ).toBeVisible();

  await page.getByRole('combobox', { name: 'Dil' }).selectOption('ja');
  await expect(
    page.getByRole('heading', { name: 'マーチャント概要' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'システム状態' }).click();
  await expect(page).toHaveURL(/\/status\/?$/);
  await expect(
    page.getByRole('heading', { name: 'システム状態' }),
  ).toBeVisible();
  await expect(page.getByText('未接続')).toHaveCount(5);
});

test('keeps mobile navigation accessible at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(
    page.getByRole('link', { name: 'System status' }).last(),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
