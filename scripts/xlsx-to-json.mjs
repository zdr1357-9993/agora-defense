// data/agora_master.xlsx (원본) → src/data/*.json (게임용) 변환
// 엑셀만 고치고 `npm run data` (dev/build 시 자동 실행)
import XLSX from 'xlsx';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const wb = XLSX.readFile('data/agora_master.xlsx');
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });

let philosophers = rows('Philosophers').map((r) => ({
  id: r.phil_id, name: r.name_kr, tier: Number(r.tier), era: r.era === '현대' ? '근현대' : r.era, school: r.school,
  quote: r.atk_quote, skill: r.skill_name, skillDesc: r.skill_desc, lore: r.lore_humor,
  hidden: r.hidden === 'Y',
}));
let recipes = rows('Recipes').map((r) => ({
  id: r.recipe_id, result: r.result_phil_id,
  materials: [r.mat_1_id, r.mat_2_id, r.mat_3_id].filter(Boolean),
  catalyst: r.catalyst_id === 'NONE' ? null : r.catalyst_id, logic: r.synthesis_logic,
}));
const catalysts = rows('Catalysts').map((r) => ({
  id: r.catalyst_id, name: r.name, concept: r.concept, effect: r.effect, drop: r.drop_source,
}));
const errors = [];
let combat = rows('Combat').map((r) => ({
  id: r.phil_id, type: r.attack_type, range: Number(r.range_cells), speed: Number(r.attacks_per_sec),
  power: Number(r.power_mult), target: r.target, note: r.role_note,
}));
for (const c of combat) {
  if (!['단일', '광역', '연쇄', '제어', '지원', '저격'].includes(c.type)) errors.push(`${c.id}: 공격유형 오류 ${c.type}`);
  if (!['선두', '강한 적', '약한 적', '보스'].includes(c.target)) errors.push(`${c.id}: 대상 오류 ${c.target}`);
}
let rates = rows('Rates').map((r) => ({ tier: Number(r.tier), rate: Number(r.summon_rate) }));
const stages = rows('Stages').map((r) => ({
  id: r.stage_id, era: r.era === '현대' ? '근현대' : r.era, name: r.name, unlockAfter: r.unlock_after || null,
  enemyEarly: r.enemy_early, enemyLate: r.enemy_late, boss10: r.boss_10, boss20: r.boss_20,
  counter: r.counter_phil, story: r.story,
}));

const expansion = JSON.parse(readFileSync('data/modern-expansion.json', 'utf8'));
for (const stage of stages) Object.assign(stage, expansion.overrides[stage.id] ?? {});
stages.push(expansion.stage);

// The reviewed + ladder is canonical for roster/recipes/combat/rates. The workbook
// remains the source for stage and catalyst content; do not silently regenerate v2.
const roster = JSON.parse(readFileSync('data/roster-v3.json', 'utf8'));
({ philosophers, recipes, combat, rates } = roster);
const rank = p => p.tier * 2 + Number(!!p.plus);

// 검증 (combat 검증은 위에서 errors에 쌓임)
const byId = new Map(philosophers.map((p) => [p.id, p]));
for (const r of recipes) {
  const res = byId.get(r.result);
  if (!res) errors.push(`${r.id}: 없는 결과 ${r.result}`);
  for (const m of r.materials) {
    const p = byId.get(m);
    if (!p) errors.push(`${r.id}: 없는 재료 ${m}`);
    else if (res && rank(p) >= rank(res)) errors.push(`${r.id}: 재료 ${p.name}가 결과 ${res.name}보다 낮은 등급이어야 함`);
    else if (res && !res.origin && p.thoughtYear > res.thoughtYear) errors.push(`${r.id}: 미래 사상이 재료임: ${p.name} → ${res.name}`);
  }
}
if (philosophers.length !== 59 || byId.size !== 59) errors.push('활성 카드는 중복 없이 59장이어야 함');
const costs = new Map(philosophers.filter(p=>p.tier===1).map(p=>[p.id,1]));
for (const r of [...recipes].sort((a,b)=>rank(byId.get(a.result))-rank(byId.get(b.result)))) {
  if (!r.materials.length || r.materials.some(id=>!costs.has(id))) { errors.push(`${r.id}: 도달할 수 없는 조합`); continue; }
  const cost = r.materials.reduce((s,id)=>s+costs.get(id),0);
  costs.set(r.result,cost);
  if (byId.get(r.result).materialCost !== cost) errors.push(`${r.id}: 1성 환산값 불일치`);
}
for (const p of philosophers) {
  if (!costs.has(p.id)) errors.push(`${p.name}: 1성에서 도달 불가`);
  if (p.tier < 5 && !recipes.some(r=>r.materials.includes(p.id))) errors.push(`${p.name}: 상위 조합에 쓰이지 않음`);
  if (!combat.some(c=>c.id===p.id)) errors.push(`${p.name}: 전투 프로필 없음`);
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
console.log(`✓ 철학자 ${philosophers.length} · 조합식 ${recipes.length} · 촉매 ${catalysts.length} · 스테이지 ${stages.length} · 확률 ${rates.map((r) => r.tier + '성'+(r.plus?'+':'')+' ' + (r.rate * 100).toFixed(4) + '%').join(' ')}`);
