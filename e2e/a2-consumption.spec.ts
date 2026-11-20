import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// QA-A2 조합·강화 소모 규칙 전수 시험 (briefs/017). 개발 빌드(VITE_QA_ROUTES=1)의 ?qa-a2=1 경로에서만 돈다.
// 기대값은 qa/rules/a2-rules.json(데이터에서 계산, 게임 코드 import 없음)만 쓴다. 판 상태 읽기·주입만 전투 객체를 쓴다.
// 판정: Passed / Failed / Blocked(시험 환경·규칙 근거 문제, 사유 필수). 결과는 A2_OUT(기본 ../../../results/QA-A2)에 JSON 으로 남긴다.

type Counts = Record<string, number>;
type Rule = { id: string; result: string; resultName: string; materials: string[]; catalyst: string | null; expect: { consume: Counts; produce: Counts; goldDelta: number; resultLevel: number } };
const RULES = JSON.parse(fs.readFileSync('qa/rules/a2-rules.json', 'utf8'));
const RECIPES: Rule[] = RULES.recipes;
const ROSTER = JSON.parse(fs.readFileSync('data/roster-v3.json', 'utf8'));
// 화면 표시 이름(오마주 이름) 표: 소모 규칙이 아니라 고르는 창에서 결과를 찾는 데만 쓴다 (src/data.ts HOMAGE 를 글로 읽음)
const HOMAGE: Record<string, string> = Object.fromEntries([...fs.readFileSync('src/data.ts', 'utf8').matchAll(/'([^']+)':\s*\['([^']+)',\s*'[^']+'\]/g)].map((m) => [m[1], m[2]]));
const shownName = (r: Rule) => HOMAGE[r.resultName] ?? r.resultName;
const OUT = process.env.A2_OUT || path.resolve('../../../results/QA-A2');
const STAMP = process.env.A2_STAMP || new Date().toISOString().replace(/[:.]/g, '-');
const save = (name: string, data: unknown) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `raw-${STAMP}-${name}.json`), JSON.stringify(data, null, 1)); };

const sameCounts = (a: Counts, b: Counts) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false; return true; };
const add = (a: Counts, b: Counts, sign: number) => { const o: Counts = { ...a }; for (const [k, v] of Object.entries(b)) { o[k] = (o[k] ?? 0) + sign * v; if (!o[k]) delete o[k]; } return o; };
const countOf = (ids: string[]) => ids.reduce<Counts>((m, id) => ((m[id] = (m[id] ?? 0) + 1), m), {});

async function openBattle(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/?qa-a2=1');
  await expect.poll(() => page.evaluate(() => !!(window as any).__qaA2?.game()), { timeout: 15_000 }).toBe(true);
}

/** 시작 상태 주입: 판을 비우고 재료를 전장(앞 칸부터)·대기석에 놓는다. 잠금·촉매·골드를 고정한다. */
async function seed(page: Page, ids: string[], opt: { levels?: number[]; bench?: boolean[]; gold?: number } = {}) {
  return page.evaluate(({ ids, levels, bench, gold }) => {
    const g = (window as any).__qaA2.game();
    g.towers = []; g.locked.clear(); g.lockedRecipes.clear();
    for (const k of Object.keys(g.catalysts)) g.catalysts[k] = 0;
    g.gold = gold;
    let GRIDY = 0; while (!g.isBench({ cy: GRIDY }) && GRIDY < 50) GRIDY++;   // 대기석 줄 = isBench 가 참이 되는 첫 y
    let uid = 880000;
    ids.forEach((philId: string, i: number) => {
      const onBench = bench?.[i];
      const cell = onBench ? [g.benchSlots()[0], GRIDY] : g.emptyCells()[0];
      if (!cell || cell[0] === undefined) throw new Error('칸 부족');
      g.towers.push({ uid: uid++, philId, cx: cell[0], cy: cell[1], cd: 0, level: levels?.[i] ?? 0 });
    });
    return true;
  }, { ids, levels: opt.levels ?? null, bench: opt.bench ?? null, gold: opt.gold ?? 5000 }).catch((e) => String(e));
}

async function board(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__qaA2.game();
    const counts: Record<string, number> = {};
    for (const t of g.towers) counts[t.philId] = (counts[t.philId] ?? 0) + 1;
    return { counts, gold: g.gold as number, catalysts: { ...g.catalysts } as Record<string, number>, towers: g.towers.map((t: any) => ({ philId: t.philId, level: t.level, bench: g.isBench(t) })), running: !!g.running, over: g.over ?? null };
  });
}

/** 저장(qa-preview 계정)의 경제 항목만 */
const saved = (page: Page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('agora_progress_v3:qa-preview') || '{}');
  return { cards: s.cards ?? {}, items: s.items ?? {}, gems: s.gems, gonoe: s.gonoe, tickets: s.tickets, seen: (s.seen ?? []).length, merges: s.daily?.count?.merges ?? 0 };
});
type Saved = Awaited<ReturnType<typeof saved>>;
const sameSave = (a: Saved, b: Saved) => JSON.stringify(a.cards) === JSON.stringify(b.cards) && JSON.stringify(a.items) === JSON.stringify(b.items)
  && a.gems === b.gems && a.tickets === b.tickets && a.seen === b.seen && a.merges === b.merges
  && b.gonoe - a.gonoe >= 0 && b.gonoe - a.gonoe < 50;   // 고뇌는 시간에 따라 조금 늘 수 있다(A3 와 같은 허용)

/** 화면의 합성 버튼으로 조합. 고르는 창이 뜨면 결과 이름으로 고른다. 반환: 'ok' 또는 Blocked 사유 */
async function mergeViaUI(page: Page, r: Rule): Promise<string> {
  await page.locator('#merge').dispatchEvent('click');
  const ov = page.locator('.merge-ov');
  if (await ov.count()) {
    const rows = ov.locator('.mrow');
    const n = await rows.count();
    const names = await rows.locator('b').allTextContents();
    let idx = names.findIndex((t) => t.trim() === shownName(r));
    if (idx < 0 && names.filter((t) => t.trim() === '???').length === 1) idx = names.findIndex((t) => t.trim() === '???');
    if (idx < 0 || names.filter((t) => t.trim() === shownName(r)).length > 1) { await ov.evaluate((e) => e.remove()); return `고르는 창에서 결과를 특정 못 함(${n}개: ${names.join('/')})`; }
    await rows.nth(idx).click();
  }
  return 'ok';
}

type Verdict = 'Passed' | 'Failed' | 'Blocked';

test('A2-1 조합 60개 레시피 전수: 조합 전·후 수량이 규칙표와 같다', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '데스크톱 전수, 모바일은 A2-4 표본');
  test.setTimeout(300_000);
  await openBattle(page);
  const rows: any[] = [];
  for (const r of RECIPES) {
    const row: any = { id: r.id, result: r.result, materials: r.materials.length };
    const s = await seed(page, r.materials);
    const pre = await board(page);
    if (s !== true || !sameCounts(pre.counts, countOf(r.materials))) { rows.push({ ...row, verdict: 'Blocked', why: `사전 검증 실패: ${s !== true ? s : JSON.stringify(pre.counts)}` }); continue; }
    const m = await mergeViaUI(page, r);
    if (m !== 'ok') { rows.push({ ...row, verdict: 'Blocked', why: m }); continue; }
    const post = await board(page);
    const want = add(add(pre.counts, r.expect.consume, -1), r.expect.produce, 1);
    const resLv = post.towers.filter((t) => t.philId === r.result).map((t) => t.level);
    const ok = sameCounts(post.counts, want) && post.gold - pre.gold === r.expect.goldDelta && resLv.every((l) => l === r.expect.resultLevel);
    rows.push({ ...row, verdict: (ok ? 'Passed' : 'Failed') as Verdict, pre: pre.counts, post: post.counts, want, goldDelta: post.gold - pre.gold, resultLevels: resLv });
  }
  save('combine60', rows);
  const failed = rows.filter((x) => x.verdict === 'Failed');
  expect(failed, JSON.stringify(failed.slice(0, 3))).toEqual([]);
});

// 레시피 10개(재료 수가 고르게 섞이도록) × 새로고침 간격 10가지
const SAMPLE10 = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54].map((i) => RECIPES[i]);
const DELAYS = [0, 0, 50, 50, 100, 200, 200, 500, 1000, 2000];

test('A2-2 조합 직후 새로고침 100회: 이중 지급·이중 소모 0회', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '데스크톱만');
  test.setTimeout(900_000);
  const rows: any[] = [];
  for (const r of SAMPLE10) for (const delay of DELAYS) {
    await openBattle(page);
    const s = await seed(page, r.materials);
    const pre = await board(page);
    if (s !== true || !sameCounts(pre.counts, countOf(r.materials))) { rows.push({ id: r.id, delay, cls: 'Blocked', why: '사전 검증 실패' }); continue; }
    const s0 = await saved(page);
    const m = await mergeViaUI(page, r);
    if (m !== 'ok') { rows.push({ id: r.id, delay, cls: 'Blocked', why: m }); continue; }
    const s1 = await saved(page);                       // 조합 직후 저장(읽는 데 수 ms)
    const boardAfterMerge = await board(page);
    if (delay) await page.waitForTimeout(delay);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!(window as any).__qaA2?.game()), { timeout: 15_000 }).toBe(true);
    const s2 = await saved(page);
    const boardAfterReload = await board(page);
    const mergeSaved = !sameSave(s0, s1);                // 조합이 저장에 무엇이든 남겼나
    const cls = sameSave(s1, s2) ? (mergeSaved ? '가 정상 반영' : '가 정상(조합이 저장에 남기는 것 없음)') : sameSave(s0, s2) ? '나 미반영' : '다 이상';
    rows.push({ id: r.id, delay, cls, s0, s1, s2, resultOnBoardBeforeReload: boardAfterMerge.counts[r.result] ?? 0, boardTowersAfterReload: boardAfterReload.towers.length });
  }
  save('refresh100', rows);
  const weird = rows.filter((x) => x.cls === '다 이상');
  expect(weird, JSON.stringify(weird.slice(0, 2))).toEqual([]);
});

// 강화: 구간 × plus 여부 × 현재 레벨 0~5, + 대기석 제외 + 여러 명 합산. 기대값은 규칙표(a2-rules.json ← data/upgrade-bands.json)만 쓴다.
type UpRule = { maxLevel: number; plusCostMult: number; bands: { id: string; minTier: number; maxTier: number; baseCost: number }[]; failureRule: string; decisionLock: { ok: boolean; errors: string[] } };
const UP: UpRule = RULES.upgrade;
const pickPhil = (min: number, max: number, plus: boolean) => ROSTER.philosophers.find((p: any) => p.tier >= min && p.tier <= max && !!p.plus === plus && !p.hidden)?.id as string | undefined;

test('A2-3 강화: 소모 골드·레벨 변화가 규칙표(data/upgrade-bands.json)와 같다', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '데스크톱만');
  test.setTimeout(300_000);
  await openBattle(page);
  const rows: any[] = [];
  const run = async (name: string, band: string, ids: string[], levels: number[], benchFlags: boolean[], plusFlags: boolean[]) => {
    const s = await seed(page, ids, { levels, bench: benchFlags, gold: 100000 });
    const pre = await board(page);
    if (s !== true || pre.towers.length !== ids.length || pre.towers.some((t, i) => t.bench !== !!benchFlags[i] || t.level !== levels[i])) { rows.push({ name, verdict: 'Blocked', why: '사전 검증 실패' }); return; }
    await page.locator(`[data-upgrade-band=${band}]`).dispatchEvent('click');
    const post = await board(page);
    const spent = pre.gold - post.gold;
    const base = UP.bands.find((x) => x.id === band)!.baseCost;
    const eligible = ids.map((_, i) => i).filter((i) => !benchFlags[i] && levels[i] < UP.maxLevel);
    const want = eligible.reduce((a, i) => a + Math.round(base * (plusFlags[i] ? UP.plusCostMult : 1) * (levels[i] + 1)), 0);
    const wantLevels = levels.map((l, i) => l + (eligible.includes(i) ? 1 : 0));
    const gotLevels = post.towers.map((t) => t.level);
    const ok = spent === want && JSON.stringify(gotLevels) === JSON.stringify(wantLevels);
    rows.push({ name, band, spent, want, levelsBefore: levels, levelsAfter: gotLevels, wantLevels, verdict: ok ? 'Passed' : 'Failed', why: ok ? '' : `소모 ${spent}≠${want} 또는 레벨 ${gotLevels}≠${wantLevels}` });
  };
  for (const b of UP.bands) for (const plus of [false, true]) {
    const id = pickPhil(b.minTier, b.maxTier, plus);
    if (!id) { rows.push({ name: `${b.id} plus=${plus}`, verdict: 'Blocked', why: '해당 등급 철학자 없음(데이터)' }); continue; }
    for (let lv = 0; lv <= UP.maxLevel; lv++) await run(`${b.id} plus=${plus} Lv${lv}`, b.id, [id], [lv], [false], [plus]);
    await run(`${b.id} plus=${plus} 대기석 제외`, b.id, [id, id], [0, 0], [false, true], [plus, plus]);
  }
  const c = pickPhil(1, 3, false)!, cp = pickPhil(1, 3, true);
  if (cp) await run('common 여러 명 합산(Lv0·Lv2·plus Lv1·Lv5)', 'common', [c, c, cp, c], [0, 2, 1, 5], [false, false, false, false], [false, false, true, false]);
  rows.push({ name: '강화 실패 시 소모(전 구간)', verdict: '해당 없음', why: UP.failureRule });
  save('upgrade', { decisionLock: UP.decisionLock, rows });
  expect(UP.decisionLock.ok, `결정 고정 검사: ${UP.decisionLock.errors.join('; ')}`).toBe(true);
  const failed = rows.filter((x) => x.verdict === 'Failed');
  expect(failed, JSON.stringify(failed.slice(0, 3))).toEqual([]);
});

test('A2-4 모바일 표본: 레시피 10개 조합 결과가 데스크톱과 같다', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', '모바일만');
  test.setTimeout(180_000);
  await openBattle(page);
  const rows: any[] = [];
  for (const r of SAMPLE10) {
    const s = await seed(page, r.materials);
    const pre = await board(page);
    if (s !== true || !sameCounts(pre.counts, countOf(r.materials))) { rows.push({ id: r.id, verdict: 'Blocked', why: '사전 검증 실패' }); continue; }
    const m = await mergeViaUI(page, r);
    if (m !== 'ok') { rows.push({ id: r.id, verdict: 'Blocked', why: m }); continue; }
    const post = await board(page);
    const want = add(add(pre.counts, r.expect.consume, -1), r.expect.produce, 1);
    rows.push({ id: r.id, verdict: sameCounts(post.counts, want) && post.gold === pre.gold ? 'Passed' : 'Failed', post: post.counts, want });
  }
  save('mobile10', rows);
  expect(rows.filter((x) => x.verdict === 'Failed')).toEqual([]);
});
