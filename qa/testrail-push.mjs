// 철랜디 자동 검사 + Playwright E2E 결과를 TestRail Run 하나에 기록한다.
// 사용: TESTRAIL_URL=https://○○.testrail.io TESTRAIL_USER=로그인이메일 TESTRAIL_KEY=API키 TESTRAIL_PROJECT=철랜디 node qa/testrail-push.mjs
// E2E 를 stage 미리보기에서 돌리려면 E2E_BASE_URL=https://…/stage/ 를 함께 넣는다. (없으면 로컬 개발 서버)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const E2E_JSON = path.join(process.env.PW_OUT || path.join(os.tmpdir(), 'agora-e2e'), 'e2e-results.json');

const { TESTRAIL_URL, TESTRAIL_USER, TESTRAIL_KEY } = process.env;
const PROJECT = process.env.TESTRAIL_PROJECT || '철랜디';
if (!TESTRAIL_URL || !TESTRAIL_USER || !TESTRAIL_KEY) {
  console.error('TESTRAIL_URL, TESTRAIL_USER, TESTRAIL_KEY 환경 변수를 넣어 주세요.'); process.exit(2);
}
const auth = 'Basic ' + Buffer.from(`${TESTRAIL_USER}:${TESTRAIL_KEY}`).toString('base64');
async function api(method, path, body) {
  const r = await fetch(`${TESTRAIL_URL}/index.php?/api/v2/${path}`, {
    method, headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
const list = (x, k) => Array.isArray(x) ? x : (x[k] || []);
const STATUS = { passed: 1, blocked: 2, failed: 5 };

// ── 1) 데이터·규칙 검사 ─────────────────────────────
const checks = {
  roster: 'node scripts/check-roster-v3.mjs',
  story: 'node scripts/check-modern-story.mjs',
  mechanics: 'node qa/check-current-mechanics.cjs',
  gacha: 'node qa/check-gacha-rates.mjs',
};
const out = {};
for (const [k, cmd] of Object.entries(checks)) {
  try { out[k] = { status: 'passed', log: execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim().split('\n').pop() }; }
  catch (e) {
    const all = `${e.stdout || ''}\n${e.stderr || ''}`;
    // 기준에 걸려 떨어진 것(failed)과 검사 자체가 못 돈 것(blocked)을 구분
    const assertion = /AssertionError|FAIL:/.test(all);
    const line = all.split('\n').find((l) => /Error|ERR_/.test(l)) || all.trim().split('\n')[0];
    out[k] = { status: assertion ? 'failed' : 'blocked', log: line.trim().slice(0, 300) };
  }
  console.log(`${out[k].status.toUpperCase()} ${k}: ${out[k].log}`);
}
const checkMap = [
  ['첫 뽑기는 정해진 시작 카드 풀에서만 나온다', 'roster'],
  ['등급별 뽑기 확률이 설계 구간 안에 있다', 'gacha'],
  ['조합 시 재료가 정확한 수량만큼 소모된다', 'roster'],
  ['모든 조합 결과 카드가 실제로 존재한다', 'roster'],
  ['모든 스토리 보상이 실제 아이템으로 지급된다', 'story'],
  ['같은 시드로 돌리면 같은 결과가 나온다(재현성)', 'mechanics'],
  ['보스 웨이브는 10의 배수 웨이브에 등장한다', 'mechanics'],
  ['영입 단계별 등급이 4/5/6성 규칙을 따른다', 'mechanics'],
  ['보드가 가득 차면 영입이 무료 처리 규칙을 따른다', 'mechanics'],
  ['강화 결과가 일반/희귀/고급 확률 구간을 따른다', 'mechanics'],
];
const results = checkMap.map(([title, k]) => ({ title, status: out[k].status, comment: `[${k}] ${out[k].log}` }));

// ── 2) Playwright E2E (desktop + mobile) ─────────────
if (process.env.SKIP_E2E !== '1') {
  try { fs.rmSync(E2E_JSON, { force: true }); } catch {} // 지난 결과가 섞이지 않게
  try { execSync('npx playwright test', { stdio: 'inherit' }); } catch { /* 실패도 결과 파일로 판정 */ }
  if (fs.existsSync(E2E_JSON)) {
    const rep = JSON.parse(fs.readFileSync(E2E_JSON, 'utf8'));
    const specs = [];
    const walk = (s) => { for (const sp of s.specs || []) specs.push(sp); for (const c of s.suites || []) walk(c); };
    rep.suites.forEach(walk);
    for (const sp of specs) {
      const per = sp.tests.map((t) => `${t.projectName}: ${t.results.at(-1)?.status ?? 'none'}`).join(', ');
      // 브라우저를 못 띄우거나(설치 문제) 중단된 경우는 기준 실패가 아니라 '시험 불가'(blocked)
      const envErr = (t) => (t.results.at(-1)?.errors || []).some((e) => /browserType\.launch|Executable doesn't exist|ECONNREFUSED|webServer/.test(e.message || ''));
      const errored = sp.tests.some((t) => ['timedOut', 'interrupted'].includes(t.results.at(-1)?.status) || envErr(t));
      results.push({ title: sp.title, status: sp.ok ? 'passed' : errored ? 'blocked' : 'failed',
        comment: `[Playwright E2E · ${process.env.E2E_BASE_URL || '로컬 개발 서버'}] ${per}`, e2e: true });
    }
  } else {
    // 결과 파일이 없다 = 시험 자체가 돌지 못했다(서버 기동 실패 등) → 모든 E2E 를 Blocked 로 남긴다
    console.warn('E2E 결과 파일이 없어 모든 E2E 를 Blocked 로 기록합니다.');
    const titles = [...fs.readFileSync('e2e/smoke.spec.ts', 'utf8').matchAll(/test\('([^']+)'/g)].map((m) => m[1]);
    for (const title of titles) results.push({ title, status: 'blocked', e2e: true,
      comment: '[Playwright E2E] 시험 실행 불가: 결과 파일 없음 (웹서버 기동 실패 등). 터미널 로그 확인' });
  }
}

// ── 3) TestRail: 프로젝트·섹션·케이스 준비 ─────────
const projects = list(await api('GET', 'get_projects'), 'projects');
const project = projects.find((p) => p.name === PROJECT) || projects[0];
let cases = list(await api('GET', `get_cases/${project.id}`), 'cases');
if (results.some((r) => r.e2e && !cases.find((c) => c.title === r.title))) {
  const sections = list(await api('GET', `get_sections/${project.id}`), 'sections');
  const sec = sections.find((s) => s.name === 'E2E (Playwright)') || await api('POST', `add_section/${project.id}`, { name: 'E2E (Playwright)' });
  for (const r of results.filter((x) => x.e2e && !cases.find((c) => c.title === x.title))) {
    await api('POST', `add_case/${sec.id}`, { title: r.title, refs: 'e2e/smoke.spec.ts' });
    console.log('TC 추가:', r.title);
  }
  cases = list(await api('GET', `get_cases/${project.id}`), 'cases');
}

// ── 4) Run 만들고 결과 기록 ─────────────────────────
const rows = results.map((r) => {
  const c = cases.find((x) => x.title === r.title);
  if (!c) { console.warn('TC 없음:', r.title); return null; }
  return { case_id: c.id, status_id: STATUS[r.status], comment: r.comment };
}).filter(Boolean);
const runName = `자동 검사 + E2E ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
const run = await api('POST', `add_run/${project.id}`, { name: runName, include_all: false, case_ids: rows.map((r) => r.case_id),
  description: '데이터·규칙 검사 + Playwright E2E(desktop·mobile)를 실행해 자동 기록 (qa/testrail-push.mjs)' });
await api('POST', `add_results_for_cases/${run.id}`, { results: rows });
const n = (s) => rows.filter((r) => r.status_id === STATUS[s]).length;
console.log(`\nTestRail 기록 완료: ${TESTRAIL_URL}/index.php?/runs/view/${run.id}  (통과 ${n('passed')} · 실패 ${n('failed')} · 막힘 ${n('blocked')})`);
