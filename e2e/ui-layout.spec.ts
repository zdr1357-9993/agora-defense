import { test, expect, type Page, type TestInfo } from '@playwright/test';

// RD-T062: reproducible viewport checks; QA routes only, never a real account.
const sizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
];

async function capture(page: Page, info: TestInfo, name: string) {
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({ path: file });
  await info.attach(name, { path: file, contentType: 'image/png' });
}

async function fitsWidth(page: Page, selector: string) {
  const bounds = await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: window.innerWidth, overflow: el.scrollWidth - el.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.overflow).toBeLessThanOrEqual(1);
}

for (const viewport of sizes) test.describe(`${viewport.width}x${viewport.height}`, () => {
  test.use({ viewport });

  test('login remains scrollable on short screens', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.locator('#login')).toBeVisible();
    await fitsWidth(page, '#login');
    await page.locator('#signup').scrollIntoViewIfNeeded();
    await expect(page.locator('#signup')).toBeInViewport();
    await capture(page, info, 'login');
  });

  test('all hub tabs and settings remain reachable', async ({ page }, info) => {
    await page.goto('/?qa-screen=home');
    await expect(page.locator('#home')).toBeVisible();
    // Skip optional first-visit coaching using its real dismissal button.
    for (const tab of ['room', 'gacha', 'codex', 'shop', 'stages']) {
      await page.locator(`#tabs button[data-tab=${tab}]`).click();
      await page.locator(`#tab-${tab}`).waitFor({ state: 'visible' });
      const skip = page.locator('.tut-skip');
      if (await skip.isVisible()) await skip.click();
      await fitsWidth(page, '#home');
      await capture(page, info, tab);
    }
    await page.locator('#open-settings').click();
    await page.locator('#reset').scrollIntoViewIfNeeded();
    await expect(page.locator('#reset')).toBeInViewport();
    await fitsWidth(page, '.settings-card');
    await capture(page, info, 'settings');
  });

  test('battle HUD and dock fit and panels open', async ({ page }, info) => {
    await page.goto('/?boss-preview=1');
    await expect(page.locator('#battle')).toBeVisible();
    await expect(page.locator('.era-wipe')).toHaveCount(0);
    await fitsWidth(page, '#hud');
    await fitsWidth(page, '#field');
    await page.locator('#summon').scrollIntoViewIfNeeded();
    await expect(page.locator('#summon')).toBeInViewport();
    await page.locator('#upgrade-btn').click();
    await expect(page.locator('#upgrade-panel')).toBeVisible();
    await fitsWidth(page, '#upgrade-panel');
    await capture(page, info, 'battle-upgrade');
    await page.locator('#recruit-btn').click();
    await expect(page.locator('#upgrade-panel')).toBeHidden();
    await expect(page.locator('#recruit-panel')).toBeVisible();
    await fitsWidth(page, '#recruit-panel');
    await capture(page, info, 'battle-recruit');
  });
});
