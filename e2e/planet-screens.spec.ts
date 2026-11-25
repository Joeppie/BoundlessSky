import { test, expect } from '@playwright/test';

// The planet-menu screens: Player Info (tabs, fleet), the outfitter (organized
// grid + detail + ships), and the corner HUD.

test('player info + outfitter, launched from the planet menu', async ({ page }) => {
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
  await expect(page.locator('.planet-menu-title')).toHaveText('New Boston', { timeout: 15_000 });

  // The corner HUD shows the pilot (no ship yet — no glyph).
  await expect(page.locator('.corner-hud-system')).toHaveText('Rutilicus');
  await expect(page.locator('.corner-hud-credits')).toContainText('480,000');

  // Player Info — tabs + Done.
  await page.locator('.planet-menu-playerinfo').click();
  await expect(page.locator('.playerinfo-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.playerinfo-stat-value').first()).toContainText('Elena Voss');
  await page.locator('.playerinfo-tab--ship').click();
  await expect(page.locator('.playerinfo-tab--ship')).toHaveClass(/is-active/);
  await page.locator('.playerinfo-done').click();
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });

  // Outfitter — the category grid loads and the detail pane renders.
  await page.locator('.planet-menu-outfitter').click();
  await expect(page.locator('.outfitter-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.outfitter-section-header').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.outfitter-cell').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.outfitter-detail-name')).toBeVisible({ timeout: 15_000 });
  // Navigate to the next outfit via keyboard.
  const before = await page.locator('.outfitter-detail-name').textContent();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.outfitter-detail-name')).not.toHaveText(before ?? '');
  // Back returns to the planet menu.
  await page.keyboard.press('Escape');
  await expect(page.locator('.planet-menu-screen')).toBeVisible({ timeout: 15_000 });
});
