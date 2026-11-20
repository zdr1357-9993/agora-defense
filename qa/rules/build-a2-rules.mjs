// QA-A2 규칙표(오라클) 만들기 — 게임 코드(src/)를 import 하지 않고 데이터 파일만 읽어 기대값을 계산한다.
// 사용: node qa/rules/build-a2-rules.mjs  → qa/rules/a2-rules.json
import fs from 'node:fs';

const SRC = 'data/roster-v3.json';
const roster = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const names = Object.fromEntries(roster.philosophers.map((p) => [p.id, p.name]));

const count = (ids) => ids.reduce((m, id) => ((m[id] = (m[id] ?? 0) + 1), m), {});

// 조합: 재료가 전부 판에 있으면 재료 각 1개씩 사라지고 결과 1개가 생긴다. 촉매가 있으면 1개 소모. 골드·통찰 변화 없음.
const recipes = roster.recipes.map((r) => {
  const consume = count(r.materials);
  return {
    id: r.id, result: r.result, resultName: names[r.result],
    materials: r.materials, catalyst: r.catalyst,
    expect: {
      consume,                       // 판에서 줄어야 할 수량(철학자별)
      produce: { [r.result]: 1 },    // 판에 생겨야 할 수량
      catalystDelta: r.catalyst ? { [r.catalyst]: -1 } : {},
      goldDelta: 0,
      resultLevel: 0,
    },
    source: `${SRC} recipes[id=${r.id}].materials/result/catalyst (version ${roster.version})`,
  };
});

// 강화: data/upgrade-bands.json(손 관리 원본, RD-T055)에서 기대값을 계산한다.
// 한 명 비용 = round(baseCost × (plus ? plusCostMult : 1) × (현재 레벨+1)), 구간 강화 = 전장 배치·Lv<maxLevel 전원 합계·각 +1, 대기석·최대 레벨 제외.
const UP_SRC = 'data/upgrade-bands.json';
const U = JSON.parse(fs.readFileSync(UP_SRC, 'utf8'));
// 결정 고정 검사: 2026-11-20 현배 확정값과 데이터가 같은지. 밸런스를 바꾸면 여기도 의도적으로 갱신한다.
const DECIDED = { baseCost: { common: 60, rare: 300, high: 975 }, perLevel: 0.2625, plusCostMult: 1.5, maxLevel: 5 };
const lockErrors = [];
for (const [id, v] of Object.entries(DECIDED.baseCost)) { const b = U.bands.find((x) => x.id === id); if (!b || b.baseCost !== v) lockErrors.push(`${id}.baseCost=${b?.baseCost} (결정 ${v})`); }
for (const k of ['perLevel', 'plusCostMult', 'maxLevel']) if (U[k] !== DECIDED[k]) lockErrors.push(`${k}=${U[k]} (결정 ${DECIDED[k]})`);
const upgrade = {
  status: '규칙 있음',
  source: `${UP_SRC} (2026-11-20 현배 확정: 코드값을 정답으로)`,
  maxLevel: U.maxLevel, perLevel: U.perLevel, plusCostMult: U.plusCostMult,
  bands: U.bands.map((b) => ({ id: b.id, minTier: b.minTier, maxTier: b.maxTier, baseCost: b.baseCost })),
  costRule: 'round(baseCost × (plus ? plusCostMult : 1) × (현재 레벨+1)); 구간 강화는 전장 배치·Lv<maxLevel 전원 합계, 각 +1; 대기석·최대 레벨은 대상·비용 제외',
  failureRule: '없음(의도, 2026-11-20 현배 확정) — 골드가 있으면 항상 성공. 시험의 실패 쪽은 해당 없음으로 분류',
  decisionLock: { decided: DECIDED, ok: lockErrors.length === 0, errors: lockErrors },
};

const out = { generatedFrom: SRC, rosterVersion: roster.version, recipeCount: recipes.length, recipes, upgrade };
fs.writeFileSync('qa/rules/a2-rules.json', JSON.stringify(out, null, 1));
console.log(`a2-rules.json: 레시피 ${recipes.length}개, 강화=${upgrade.status} (${UP_SRC})`);
console.log(lockErrors.length ? `결정 고정 검사 FAIL: ${lockErrors.join('; ')}` : '결정 고정 검사 OK: 60/300/975G · 레벨당 0.2625 · plus ×1.5 · 최대 Lv.5 = 2026-11-20 확정값');
if (lockErrors.length) process.exitCode = 1;
