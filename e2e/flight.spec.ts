import { test, expect, type Page } from '@playwright/test';

// The flight view — Depart opens it, landing and warp both work, and the real
// destination systems are used. Driving the whole flow reuses the same start
// steps as the full-flow test.

async function startPilotAndBuyShip(page: Page) {
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
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });

  // Buy a Shuttle.
  await page.locator('.planet-menu-shipyard').click();
  await expect(page.locator('.shipyard-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.shipyard-card')).toHaveCount(3, { timeout: 15_000 });
  await page.locator('.shipyard-card').first().click();
  await page.locator('.shipyard-buy').click();
  await expect(page.locator('.shipyard-name-input')).toBeVisible();
  await page.locator('.shipyard-name-input').fill('Watchful');
  await page.locator('.shipyard-name-confirm').click();

  // Accept the first quest — walk the choices in order.
  await expect(page.locator('.conversation-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-choice').first().click();
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-choice').first().click();
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-choice').first().click();
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-done').click();

  await expect(page.locator('.arrival-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.arrival-continue').click();
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston');
}

test('fly the system: momentum, then land', async ({ page }) => {
  test.setTimeout(180_000);
  await startPilotAndBuyShip(page);

  await page.locator('.planet-menu-depart').click();
  await expect(page.locator('.flight-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.flight-controls')).toBeVisible({ timeout: 20_000 });

  // The ship spawns stopped, over the planet — Land is enabled at once.
  await expect(page.locator('.flight-button--land')).toBeEnabled({ timeout: 15_000 });

  // Thrust — the ship accelerates (the flight view runs at 0.25× time, so
  // the ship needs a moment to reach speed).
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  await expect(page.locator('.flight-status')).not.toHaveText('stopped');

  // Coast — momentum remains; the ship keeps moving after thrust is released.
  await page.waitForTimeout(250);
  const coastSpeed = await page.locator('.flight-speed-value').first().textContent();
  const coastSpeedValue = parseInt(coastSpeed ?? '0', 10);
  expect(coastSpeedValue).toBeGreaterThan(0);

  // Brake until the ship is slow enough to land (speed decays through drag
  // and the brake — momentum remains, never instantly).
  await page.keyboard.down('s');
  await expect(async () => {
    const enabled = await page.locator('.flight-button--land').isEnabled().catch(() => false);
    expect(enabled).toBe(true);
  }).toPass({ timeout: 30_000, intervals: [250] });
  await page.keyboard.up('s');

  // Land — back to the planet menu at New Boston.
  await page.locator('.flight-button--land').click();
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston');
});

test('warp to the next system: real destination from the neighbors', async ({ page }) => {
  test.setTimeout(180_000);
  await startPilotAndBuyShip(page);

  await page.locator('.planet-menu-depart').click();
  await expect(page.locator('.flight-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.flight-controls')).toBeVisible({ timeout: 20_000 });

  // The ship is stopped at spawn — warp opens the picker.
  await expect(page.locator('.flight-button--warp')).toBeEnabled({ timeout: 15_000 });
  await page.locator('.flight-button--warp').click();

  // The picker lists real jump neighbors — Arcturus and Menkent have named planets.
  await expect(page.locator('.flight-warp-button').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.flight-warp-button', { hasText: 'New Greenland' })).toBeVisible();

  // Warp — the flow jumps to Arcturus and lands on New Greenland.
  await page.locator('.flight-warp-button', { hasText: 'New Greenland' }).click();
  await expect(page.locator('.flight-jump-title')).toBeVisible({ timeout: 15_000 });
  // The old screen fades out, then the destiny flight view replaces it.
  await expect(async () => {
    const count = await page.locator('.flight-screen').count();
    const kicker = await page.locator('.flight-kicker').allTextContents();
    if (count !== 1) throw new Error('transition in flight');
    if (kicker[0] !== 'Arcturus — flight') throw new Error('not Arcturus yet');
  }).toPass({ timeout: 30_000, intervals: [250] });

  // The ship spawns at New Greenland, slow — Land it.
  await expect(page.locator('.flight-button--land')).toBeEnabled({ timeout: 20_000 });
  await page.locator('.flight-button--land').click();

  // The planet menu shows New Greenland — the real spec from map planets.txt.
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Greenland');
});
