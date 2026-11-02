// data/agora_master.xlsx (원본) → src/data/*.json (게임용) 변환
// 엑셀만 고치고 `npm run data` (dev/build 시 자동 실행)
import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

const wb = XLSX.readFile('data/agora_master.xlsx');
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });

const philosophers = rows('Philosophers').map((r) => ({
  id: r.phil_id, name: r.name_kr, tier: Number(r.tier), era: r.era, school: r.school,
  quote: r.atk_quote, skill: r.skill_name, skillDesc: r.skill_desc, lore: r.lore_humor,
  hidden: r.hidden === 'Y',
}));
const recipes = rows('Recipes').map((r) => ({
  id: r.recipe_id, result: r.result_phil_id,
  materials: [r.mat_1_id, r.mat_2_id, r.mat_3_id].filter(Boolean),
  catalyst: r.catalyst_id === 'NONE' ? null : r.catalyst_id, logic: r.synthesis_logic,
}));
const catalysts = rows('Catalysts').map((r) => ({
  id: r.catalyst_id, name: r.name, concept: r.concept, effect: r.effect, drop: r.drop_source,
}));
const errors = [];
const combat = rows('Combat').map((r) => ({
  id: r.phil_id, type: r.attack_type, range: Number(r.range_cells), speed: Number(r.attacks_per_sec),
  power: Number(r.power_mult), target: r.target, note: r.role_note,
}));
for (const c of combat) {
  if (!['단일', '광역', '연쇄', '제어', '지원', '저격'].includes(c.type)) errors.push(`${c.id}: 공격유형 오류 ${c.type}`);
  if (!['선두', '강한 적', '약한 적', '보스'].includes(c.target)) errors.push(`${c.id}: 대상 오류 ${c.target}`);
}
const rates = rows('Rates').map((r) => ({ tier: Number(r.tier), rate: Number(r.summon_rate) }));
const stages = rows('Stages').map((r) => ({
  id: r.stage_id, era: r.era, name: r.name, unlockAfter: r.unlock_after || null,
  enemyEarly: r.enemy_early, enemyLate: r.enemy_late, boss10: r.boss_10, boss20: r.boss_20,
  counter: r.counter_phil, story: r.story,
}));

// 검증 (combat 검증은 위에서 errors에 쌓임)
const byId = new Map(philosophers.map((p) => [p.id, p]));
for (const r of recipes) {
  const res = byId.get(r.result);
  if (!res) errors.push(`${r.id}: 없는 결과 ${r.result}`);
  for (const m of r.materials) {
    const p = byId.get(m);
    if (!p) errors.push(`${r.id}: 없는 재료 ${m}`);
    else if (res && p.tier > res.tier) errors.push(`${r.id}: 재료 ${p.name}(${p.tier}성)가 결과 ${res.name}(${res.tier}성)보다 높음`);
  }
}
for (const s of stages) if (!byId.get(s.counter)) errors.push(`${s.id}: 없는 카운터 ${s.counter}`);
for (let t = 1; t <= 4; t++)
  if (!philosophers.some((p) => p.tier === t && !p.hidden)) errors.push(`${t}성이 비어 있음 (합성 사다리 끊김)`);
const total = rates.reduce((a, r) => a + r.rate, 0);
if (Math.abs(total - 1) > 0.001) errors.push(`소환 확률 합이 100%가 아님: ${(total * 100).toFixed(1)}%`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

mkdirSync('src/data', { recursive: true });
for (const [n, d] of Object.entries({ philosophers, recipes, catalysts, stages, rates, combat }))
  writeFileSync(`src/data/${n}.json`, JSON.stringify(d, null, 2));
console.log(`✓ 철학자 ${philosophers.length} · 조합식 ${recipes.length} · 촉매 ${catalysts.length} · 스테이지 ${stages.length} · 확률 ${rates.map((r) => r.tier + '성 ' + Math.round(r.rate * 100) + '%').join(' ')}`);
