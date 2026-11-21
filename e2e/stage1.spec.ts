import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// A1·A3 (시나리오 설계서 1단계). QA 경로는 VITE_QA_ROUTES=1 빌드(개발)에서만 열린다.

// 확률표의 원본(src/meta.ts CARD_RATES)에서 기대값을 읽는다
const expectedRates = (): string[] => {
  const src = fs.readFileSync('src/meta.ts', 'utf8');
  const block = src.slice(src.indexOf('export const CARD_RATES'), src.indexOf('];', src.indexOf('export const CARD_RATES')));
  return [...block.matchAll(/rate\s*:\s*([0-9.]+)/g)].map((m) => (Number(m[1]) * 100).toFixed(2) + '%');
};

test('A1 뽑기 화면의 확률 표시가 확률표와 같다', async ({ page }) => {
  await page.goto('/?qa-screen=gacha');
  await page.locator('[data-ginfo=c]').click();
  const shown = (await page.locator('.rates-line .tier-chip').allTextContents()).map((t) => t.trim().split(' ').pop()!);
  const expected = expectedRates();
  expect(shown).toEqual(expected);
  const sum = shown.reduce((a, s) => a + Number(s.replace('%', '')), 0);
  expect(Math.abs(sum - 100)).toBeLessThan(0.001);
});

const snap = (page: Page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('agora_progress_v3:qa-preview') || '{}');
  return { gonoe: s.gonoe as number, gems: s.gems as number, cards: Object.values(s.cards || {}).reduce((a: number, b) => a + (b as number), 0) };
});

test('A3 뽑기 직후 새로고침·새 탭에서도 카드와 재화가 복원된다', async ({ page, context }) => {
  test.setTimeout(180_000);
  page.on('dialog', (d) => d.accept());
  await page.goto('/?qa-screen=gacha');
  let checks = 0;
  for (let round = 0; round < 15; round++) {
    await page.locator('[data-pull=c1]').click({ force: true });
    await expect.poll(async () => (await snap(page)).cards).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    const before = await snap(page);

    // 1) 새로고침
    await page.reload();
    await expect(page.locator('#home')).toBeVisible();
    const afterReload = await snap(page);
    expect(afterReload.cards, `라운드 ${round} 새로고침: 카드 수`).toBe(before.cards);
    expect(afterReload.gems, `라운드 ${round} 새로고침: 지혜석`).toBe(before.gems);
    // 고뇌는 시간이 지나면 조금씩 자연 증가한다 → 줄어들면 안 되고, 크게 늘어도 안 된다
    expect(afterReload.gonoe).toBeGreaterThanOrEqual(before.gonoe);
    expect(afterReload.gonoe - before.gonoe).toBeLessThan(50);
    checks++;

    // 2) 탭을 닫고 새 탭으로 다시 열기
    const p2 = await context.newPage();
    await p2.goto('/?qa-screen=gacha');
    await expect(p2.locator('#home')).toBeVisible();
    const afterTab = await snap(p2);
    expect(afterTab.cards, `라운드 ${round} 새 탭: 카드 수`).toBe(before.cards);
    expect(afterTab.gems).toBe(before.gems);
    checks++;
    await page.close();
    page = p2;
    page.on('dialog', (d) => d.accept());
  }
  expect(checks).toBe(30);
});
