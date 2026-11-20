import { test, expect } from '@playwright/test';

// 테스트 제목은 TestRail 케이스 제목과 같다. (qa/testrail-push.mjs 가 제목으로 연결)
// QA 경로(?qa-screen, ?boss-preview)는 VITE_QA_ROUTES=1 빌드(개발·스테이지)에서만 열린다. 운영 계정·서버 저장과 무관.

test('E2E-01 첫 화면에 로그인 폼이 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#login-id')).toBeVisible();
  await expect(page.locator('#login-pw')).toBeVisible();
});

test('E2E-02 서버에 닿지 않으면 로그인 실패 안내가 나온다', async ({ page }) => {
  await page.route(/supabase\.co/, (r) => r.abort());
  await page.goto('/');
  await page.fill('#login-id', 'qatester');
  await page.fill('#login-pw', '1234');
  await page.locator('#login-form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.locator('#login-err')).toContainText('서버에 닿지 않아요');
  await expect(page.locator('#login')).toBeVisible();
});

test('E2E-03 QA 미리보기로 홈 화면과 재화가 표시된다', async ({ page }) => {
  await page.goto('/?qa-screen=home');
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#stages')).toBeVisible();
  await expect(page.locator('#wallet')).toContainText(/\d/);
});

test('E2E-04 하단 탭으로 5개 화면을 이동할 수 있다', async ({ page }) => {
  await page.goto('/?qa-screen=home');
  for (const tab of ['room', 'gacha', 'codex', 'shop', 'stages']) {
    await page.locator(`#tabs button[data-tab=${tab}]`).click();
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
});

test('E2E-05 전투 화면에 웨이브·골드·목숨이 표시되고 골드가 오른다', async ({ page }) => {
  await page.goto('/?boss-preview=1');
  await expect(page.locator('#battle')).toBeVisible();
  await expect(page.locator('#wave')).toHaveText(/\d+/);
  await expect(page.locator('#lives')).toHaveText(/\d+/);
  const before = Number((await page.locator('#gold').textContent())!.replace(/\D/g, ''));
  await expect.poll(async () => Number((await page.locator('#gold').textContent())!.replace(/\D/g, '')), { timeout: 10_000 }).toBeGreaterThan(before);
});

test('E2E-06 전투 포기를 확인하면 홈으로 돌아온다', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/?boss-preview=1');
  await expect(page.locator('#battle')).toBeVisible();
  await page.locator('#quit').click();
  await expect(page.locator('#battle')).toBeHidden();
  await expect(page.locator('#home')).toBeVisible();
});
