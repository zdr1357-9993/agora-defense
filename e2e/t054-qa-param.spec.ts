import { test, expect, type Page } from '@playwright/test';

// RD-T054: 주소 `?qa=1` 이 QA 모드(재화 지급·해금)를 켜는지. 빌드별로 기대가 다르다:
//   운영 설정 빌드(VITE_QA_ROUTES 없음) → 꺼져야 한다 / 개발 빌드(VITE_QA_ROUTES=1) → 켜진다.
// 실행: E2E_BASE_URL=<미리보기 주소> T054_EXPECT=off|on npx playwright test e2e/t054-qa-param.spec.ts --project=desktop
// 운영 서버에 닿지 않도록 Supabase 요청은 브라우저에서 모두 막고, '이 기기에서 마지막으로 쓴 아이디'로 오프라인 로그인한다.
const EXPECT = process.env.T054_EXPECT;   // 'off' | 'on' (없으면 이 시험은 건너뜀: 기본 dev 서버 실행 때 섞이지 않게)
const ID = 'qa-t054-offline';

async function offlineLogin(page: Page, url: string) {
  await page.route(/supabase\.co/, (r) => r.abort());
  await page.addInitScript((id) => { try { localStorage.setItem('agora_last_login', id); } catch { /* 무시 */ } }, ID);
  await page.goto(url);
  await page.fill('#login-id', ID);
  await page.fill('#login-pw', 'x');
  await page.locator('#login-form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.locator('#login')).toBeHidden({ timeout: 15_000 });
}

const saved = (page: Page) => page.evaluate((id) => {
  const s = JSON.parse(localStorage.getItem(`agora_progress_v3:${id}`) || '{}');
  return { qaGrant: (s.purchases ?? []).includes('qa'), gonoe: s.gonoe ?? null, gems: s.gems ?? null, tickets: s.tickets ?? null };
}, ID);

for (const url of ['/?qa=1', '/']) {
  test(`T054 ${url} 로 오프라인 첫 시작: QA 지급이 ${url === '/' ? '없다' : EXPECT === 'on' ? '있다(개발 빌드)' : '없다(운영 빌드)'}`, async ({ page }, info) => {
    test.skip(!EXPECT || info.project.name !== 'desktop', 'T054_EXPECT 가 있을 때 데스크톱만');
    await offlineLogin(page, url);
    await expect.poll(async () => (await saved(page)).gonoe, { timeout: 10_000 }).not.toBeNull();
    const s = await saved(page);
    console.log(`T054 RESULT url=${url} expect=${EXPECT} ${JSON.stringify(s)}`);
    const wantGrant = url !== '/' && EXPECT === 'on';
    expect(s.qaGrant, `purchases 'qa'`).toBe(wantGrant);
    if (wantGrant) { expect(s.gonoe).toBeGreaterThanOrEqual(100000); expect(s.gems).toBeGreaterThanOrEqual(10000); expect(s.tickets).toBeGreaterThanOrEqual(5); }
    else { expect(s.gonoe).toBeLessThan(100000); expect(s.gems).toBeLessThan(10000); }
  });
}
