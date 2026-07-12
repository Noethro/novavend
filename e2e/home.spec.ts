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
  await expect(page.locator('.status-row strong.neutral')).toHaveCount(5);
  await expect(page.locator('.status-row strong.neutral').first()).toHaveText(
    '未接続',
  );
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

test('renders honest authentication preview routes without API requests', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('api.not-hosted.invalid')) {
      apiRequests.push(request.url());
    }
  });

  for (const route of ['/login/', '/register/', '/onboarding/']) {
    await page.goto(route);
    await expect(page.locator('[data-auth-screen]')).toBeVisible();
    await expect(
      page.locator('[data-auth-screen] button[type="submit"]'),
    ).toBeDisabled();
  }

  await page.goto('/login/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('tr');
  await expect(
    page.getByRole('heading', { name: 'NovaVend hesabına giriş yap' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'NovaVend hesabına giriş yap' }),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test('renders a network-free localized avatar pairing preview', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('api.not-hosted.invalid'))
      apiRequests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/avatars/');
  await expect(
    page.locator('[data-avatars-marker="novavend-avatars"]'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create pairing token' }),
  ).toBeDisabled();
  await expect(page.getByText(/no usable token is generated/i)).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('tr');
  await expect(
    page.getByRole('heading', { name: 'Second Life avatarları' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Second Life avatarları' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect(apiRequests).toEqual([]);
});
