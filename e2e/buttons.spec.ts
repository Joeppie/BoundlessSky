import { test, expect } from '@playwright/test';

// The general rule: every action is a tappable button, not a keyboard shortcut.
// This test drives the whole new-pilot flow with mouse clicks only.

test('the whole new-pilot flow is drivable with clicks', async ({ page }) => {
  await page.goto('/');

  // Menu — click the New Pilot button.
  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 30_000 });
  await page.locator('.menu-screen .menu-button--primary').click();
  await expect(page.locator('.startconditions-screen')).toBeVisible();

  // Picker — click the first scenario row, then the Start Game button.
  await expect(page.locator('.startconditions-row')).toHaveCount(5);
  await page.locator('.startconditions-row').first().click();
  await expect(page.locator('.startconditions-row.is-selected')).toHaveCount(1);
  await page.locator('.startconditions-button--start').click();

  // Conversation — click the Confirm button on the name panel.
  await expect(page.locator('.conversation-screen')).toBeVisible();
  await expect(page.locator('.conversation-name-input').first()).toBeVisible();
  await page.locator('.conversation-name-input').first().fill('Elena');
  await page.locator('.conversation-name-input').nth(1).fill('Voss');
  await page.locator('.conversation-name-confirm').click();

  // Walk to done — click the [ done ] button, which is a real button.
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-done').click();

  // Splash — click the Continue button (a real button).
  await expect(page.locator('.arrival-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.arrival-continue').click();

  // The planet menu — the player is at New Boston. Click the Shipyard button.
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston', { timeout: 15_000 });
  await expect(page.locator('.planet-menu-description-text').first()).toBeVisible();
  await page.locator('.planet-menu-shipyard').click();

  // Shipyard — click the Shuttle card, the Buy button, then the Name & buy button.
  await expect(page.locator('.shipyard-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.shipyard-card')).toHaveCount(3, { timeout: 15_000 });
  await page.locator('.shipyard-card').first().click();
  await page.locator('.shipyard-buy').click();
  await expect(page.locator('.shipyard-name-input')).toBeVisible();
  await page.locator('.shipyard-name-input').fill('Watchful');
  await page.locator('.shipyard-name-confirm').click();

  // Quest conversation — click the first choice, then the [ done ] button.
  await expect(page.locator('.conversation-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-choice').first().click();
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-choice').first().click();
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-choice').first().click();
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-done').click();

  // Quest accepted — the splash's Continue button navigates onward.
  await expect(page.locator('.arrival-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.arrival-kicker')).toHaveText('Quest accepted');
  await page.locator('.arrival-continue').click();

  // Back at the planet menu — the ship is on file, so Depart is enabled.
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston');
  await expect(page.locator('.planet-menu-depart')).toBeEnabled();

  // Depart back to the menu — the flight view opens, then Menu → menu.
  await page.locator('.planet-menu-depart').click();
  await expect(page.locator('.flight-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.flight-menu-button').click();
  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.menu-pilot-name')).toContainText('Elena Voss');

  const state = await page.evaluate(() => {
    const game = (window as any).__boundlessSky;
    return {
      credits: game.player.account.credits,
      active: game.player.conditions.get('Intro [0]: active'),
      activeMissions: game.player.acceptedMissions.map((m: any) => m.name),
    };
  });
  expect(state.credits).toBe(300000);
  expect(state.active).toBe(1);
  expect(state.activeMissions).toContain('Intro [0]');
});

test('the name prompt confirm button follows the name fields', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 30_000 });
  await page.locator('.menu-screen .menu-button--primary').click();
  await expect(page.locator('.startconditions-screen')).toBeVisible();
  await page.locator('.startconditions-row').first().click();
  await page.locator('.startconditions-button--start').click();

  await expect(page.locator('.conversation-screen')).toBeVisible();
  const confirmButton = page.locator('.conversation-name-confirm');
  await expect(confirmButton).toBeVisible();

  // Empty fields — clicking confirm fails (the panel flickers, no navigation).
  await confirmButton.click();
  await expect(page.locator('.conversation-name-confirm')).toBeVisible();
  await expect(page.locator('.conversation-done')).not.toBeVisible();

  // Fill both fields — confirm advances.
  await page.locator('.conversation-name-input').first().fill('Elena');
  await page.locator('.conversation-name-input').nth(1).fill('Voss');
  await confirmButton.click();
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
});
