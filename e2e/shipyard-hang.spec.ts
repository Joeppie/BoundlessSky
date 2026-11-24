import { test, expect } from '@playwright/test';

// The reported phone bug: the shipyard stock fetch can stall (slow/dead
// connection). The screen must never hang on "Loading" — it must show an
// error state with a Retry button, and Retry must really refetch.

test('the shipyard shows an error + Retry when the stock fetch stalls', async ({ page }) => {
  // Swallow the content responses — the fetch never settles.
  const handler = async () => {};
  await page.route('**/content/data/human/sales.txt', handler);
  await page.route('**/content/data/human/ships.txt', handler);

  await page.goto('/');
  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 30_000 });
  await page.locator('.menu-screen .menu-button--primary').click();
  await expect(page.locator('.startconditions-screen')).toBeVisible();
  await page.locator('.startconditions-row').first().click();
  await page.locator('.startconditions-button--start').click();

  await expect(page.locator('.conversation-name-input').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-name-input').first().fill('Elena');
  await page.locator('.conversation-name-input').nth(1).fill('Voss');
  await page.locator('.conversation-name-confirm').click();
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-done').click();
  await expect(page.locator('.arrival-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.arrival-continue').click();

  // The planet menu opens (its own data loads fine — only sales/ships stall).
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston', { timeout: 15_000 });
  await page.locator('.planet-menu-shipyard').click();

  await expect(page.locator('.shipyard-screen')).toBeVisible({ timeout: 15_000 });
  // The fetch never resolves — after the bounded timeout the error state shows.
  await expect(page.locator('.shipyard-error')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.shipyard-retry')).toBeVisible();
  // Buy stays unavailable; Leave is still there.
  await expect(page.locator('.shipyard-buy')).toBeDisabled();
  await expect(page.locator('.shipyard-leave')).toBeVisible();

  // Let the requests through and Retry — the stock loads for real.
  await page.unroute('**/content/data/human/sales.txt', handler);
  await page.unroute('**/content/data/human/ships.txt', handler);
  await page.locator('.shipyard-retry').click();
  await expect(page.locator('.shipyard-card')).toHaveCount(3, { timeout: 15_000 });
});
