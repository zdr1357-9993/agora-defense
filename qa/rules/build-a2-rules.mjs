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

// 강화: 데이터 파일(roster-v3.json, agora_master.xlsx)에 강화 비용·실패 규칙이 없다.
// 참고값만 출처와 함께 적고, 판정은 '규칙 근거 없음'으로 분리한다.
const upgrade = {
  status: '규칙 근거 없음',
  reason: 'roster-v3.json 키(version·philosophers·recipes·combat·rates)와 agora_master.xlsx 시트(Philosophers·Combat·Recipes·Catalysts·Rates·Stages·QA_Summary)에 강화 비용·성공/실패 규칙이 없다',
  references: [
    { source: 'docs/UPGRADE_BANDS.md (설계 문서)', baseCost: { common: 40, rare: 200, high: 650 }, perLevelAtk: 0.35, plusMult: 1.5, costRule: 'baseCost × (plus?1.5:1) × (현재 레벨+1), 전장 배치 유닛 전원 +1, 대기석·Lv.5 제외' },
    { source: 'src/data.ts UPGRADE (코드, 비교용·오라클 아님)', note: '시험 결과 표에서 관측값과 대조만 한다' },
  ],
  failureRule: '없음 — 문서·데이터 어디에도 강화 실패·확률 규칙이 없다',
};

const out = { generatedFrom: SRC, rosterVersion: roster.version, recipeCount: recipes.length, recipes, upgrade };
fs.writeFileSync('qa/rules/a2-rules.json', JSON.stringify(out, null, 1));
console.log(`a2-rules.json: 레시피 ${recipes.length}개, 강화=${upgrade.status}`);
