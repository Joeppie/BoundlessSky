import { test, expect, type Page } from '@playwright/test';

// End-to-end: the full new-pilot flow — boot → NEW PILOT → scenario picker →
// intro conversation → landing splash → shipyard → first quest (accept) →
// quest-accepted splash → menu. Asserts the pilot card, the mission
// conditions, the fleet, and the credits.

async function debugPlayer(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).__boundlessSky;
    return {
      pilotName: game.player.pilot?.fullName(),
      credits: game.player.account.credits,
      totalShips: game.player.conditions.get('total ships'),
      ships: [...game.player.ships].map((s: any) => ({ givenName: s.givenName, model: s.model.name })),
      acceptedMissions: game.player.acceptedMissions.map((m: any) => m.name),
      offered: game.player.conditions.get('Intro [0]: offered'),
      active: game.player.conditions.get('Intro [0]: active'),
      declined: game.player.conditions.get('Intro [0]: declined'),
      engaged: game.player.logbook.length,
      logbookTexts: game.player.logbook.map((e: any) => e.paragraphs.join(' ')),
      specialJames: game.player.specialLogs.get('Minor People')?.get('James')?.paragraphs?.[0] ?? null,
    };
  });
}

test('new pilot: start a scenario, buy a ship, accept the first quest', async ({ page }) => {
  await page.goto('/');

  // Loading → menu.
  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.menu-kicker')).toContainText('re-implementation');

  // NEW PILOT → scenario picker.
  await page.locator('.menu-screen .menu-button--primary').click();
  await expect(page.locator('.startconditions-screen')).toBeVisible();
  await expect(page.locator('.startconditions-row')).toHaveCount(5);
  // The default scenario is first (UNLOCKED).
  await expect(page.locator('.startconditions-row').first()).toContainText('Endless Sky');
  await page.keyboard.press('Enter'); // start the default scenario

  // The intro conversation: name prompt.
  await expect(page.locator('.conversation-screen')).toBeVisible();
  await expect(page.locator('.conversation-name-input').first()).toBeVisible();
  await page.locator('.conversation-name-input').first().fill('Elena');
  await page.locator('.conversation-name-input').nth(1).fill('Voss');
  await page.locator('.conversation-name-confirm').click(); // confirm the name

  // Walk the conversation to done and hand off to the landing splash.
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Enter');

  // Landing splash.
  await expect(page.locator('.arrival-screen')).toBeVisible();
  await expect(page.locator('.arrival-title')).toContainText('New Boston');
  await page.keyboard.press('Enter'); // → planet menu

  // The planet menu — the landing at New Boston.
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston', { timeout: 15_000 });
  await expect(page.locator('.planet-menu-description-text').first()).toBeVisible();
  await expect(page.locator('.planet-menu-depart')).toBeDisabled();
  await page.locator('.planet-menu-shipyard').click();

  // The shipyard (stock loads from /content).
  await expect(page.locator('.shipyard-screen')).toBeVisible();
  await expect(page.locator('.shipyard-card')).toHaveCount(3, { timeout: 15_000 });
  await expect(page.locator('.shipyard-card').first()).toContainText('Shuttle');
  await expect(page.locator('.shipyard-card').first()).toContainText('180,000');

  // Buy the Shuttle: Enter → name input → type the ship name → Enter.
  await page.keyboard.press('Enter');
  await expect(page.locator('.shipyard-name-input')).toBeVisible();
  await page.locator('.shipyard-name-input').fill('Watchful');
  await page.keyboard.press('Enter');

  // The first quest (intro mission) conversation.
  await expect(page.locator('.conversation-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.conversation-kicker')).toHaveText('Quest');
  await expect(page.locator('.conversation-text')).toContainText('first starship', { timeout: 15_000 });

  // Accept path: pick the first choice each time ("Yeah, I'm in shock" →
  // "Sure, where are you trying to get to?" → "Sounds good!").
  for (const optionText of ['shock', 'Sure, where', 'Sounds good']) {
    await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.conversation-choice').first()).toContainText(optionText);
    await page.keyboard.press('Enter'); // option 1
  }

  // The final text node ends with "accept" → [done] → Enter.
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Enter');

  // Quest-accepted splash.
  await expect(page.locator('.arrival-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.arrival-kicker')).toHaveText('Quest accepted');
  await expect(page.locator('.arrival-title')).toContainText('Passenger to');
  await expect(page.locator('.arrival-ship')).toContainText('Watchful');
  await page.keyboard.press('Enter'); // → planet menu

  // Back at the planet menu — the pilot is loaded and Depart is enabled.
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston');
  await expect(page.locator('.planet-menu-depart')).toBeEnabled();
  await page.keyboard.press('Escape'); // Depart → flight view
  await expect(page.locator('.flight-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.flight-menu-button').click(); // → menu

  // Back at the menu — the pilot is loaded.
  await expect(page.locator('.menu-screen')).toBeVisible();
  await expect(page.locator('.menu-pilot-name')).toContainText('Elena Voss');
  await expect(page.locator('.menu-button--normal')).toBeEnabled();

  // The mission was actually accepted (conditions + logs + fleet + credits).
  const state = await debugPlayer(page);
  expect(state.pilotName).toBe('Elena Voss');
  expect(state.credits).toBe(300000);
  expect(state.totalShips).toBe(1);
  expect(state.ships).toEqual([{ givenName: 'Watchful', model: 'Shuttle' }]);
  expect(state.acceptedMissions).toContain('Intro [0]');
  expect(state.offered).toBe(1);
  expect(state.active).toBe(1);
  expect(state.declined).toBe(0);
  // Two plain logs: the intro conversation's and the mission's on-accept one.
  expect(state.engaged).toBe(2);
  expect(state.logbookTexts.some((t: string) => t.includes('Finally scraped together'))).toBe(true);
  expect(state.logbookTexts.some((t: string) => t.includes('basic instructions'))).toBe(true);
  expect(state.specialJames).toContain('old man');
});

test('new pilot: decline path keeps the pilot at the menu without a quest', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 30_000 });
  await page.locator('.menu-screen .menu-button--primary').click();
  await expect(page.locator('.startconditions-screen')).toBeVisible();
  await page.keyboard.press('Enter');

  // Intro conversation → name → done.
  await expect(page.locator('.conversation-name-input').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.conversation-name-input').first().fill('Bjorn');
  await page.locator('.conversation-name-input').nth(1).fill('Karlsson');
  await page.locator('.conversation-name-confirm').click();
  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Enter');

  // Landing splash → planet menu → shipyard.
  await expect(page.locator('.arrival-screen')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.planet-menu-shipyard').click();
  await expect(page.locator('.shipyard-screen')).toBeVisible();
  await expect(page.locator('.shipyard-card')).toHaveCount(3, { timeout: 15_000 });

  // Buy the Star Barge (press down once to select it → 190,000).
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.shipyard-name-input')).toBeVisible();
  await page.locator('.shipyard-name-input').fill('Cargo Mule');
  await page.keyboard.press('Enter');

  // The quest conversation — decline it ("Beat it").
  await expect(page.locator('.conversation-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.conversation-text')).toContainText('first starship', { timeout: 15_000 });
  await expect(page.locator('.conversation-choice').first()).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('ArrowDown'); // "Well, I don't plan to get too attached..."
  await page.keyboard.press('ArrowDown'); // "Beat it, old-timer..."
  await page.keyboard.press('Enter');      // decline

  await expect(page.locator('.conversation-done')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Enter');

  // Back at the planet menu — no accepted mission.
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston');
  await page.locator('.planet-menu-depart').click();
  await expect(page.locator('.flight-screen')).toBeVisible({ timeout: 15_000 });
  await page.locator('.flight-menu-button').click();
  await expect(page.locator('.menu-screen')).toBeVisible({ timeout: 15_000 });
  const state = await debugPlayer(page);
  expect(state.pilotName).toBe('Bjorn Karlsson');
  expect(state.totalShips).toBe(1);
  expect(state.ships[0]).toEqual({ givenName: 'Cargo Mule', model: 'Star Barge' });
  expect(state.offered).toBe(1);
  expect(state.active).toBe(0);
  expect(state.declined).toBe(1);
  expect(state.acceptedMissions).toEqual([]);
});
