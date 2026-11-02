// data/agora_master.xlsx (원본) → src/data/*.json (게임용) 변환
// 엑셀만 고치고 `npm run data` (dev/build 시 자동 실행)
import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

const wb = XLSX.readFile('data/agora_master.xlsx');
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });

const philosophers = rows('Philosophers_50').map((r) => ({
  id: r.phil_id,
  name: r.name_kr,
  tier: Number(r.tier),
  era: r.era,
  school: r.school_synergy,
  quote: r.atk_quote,
  skill: r.skill_name,
  skillDesc: r.skill_desc,
  lore: r.lore_humor,
}));

const recipes = rows('Recipes_40').map((r) => ({
  id: r.recipe_id,
  result: r.result_phil_id,
  materials: [r.mat_1_id, r.mat_2_id].filter(Boolean),
  catalyst: r.catalyst_id === 'NONE' ? null : r.catalyst_id,
  logic: r.synthesis_logic,
}));

const catalysts = rows('Catalysts_5').map((r) => ({
  id: r.catalyst_id, name: r.name, concept: r.concept, effect: r.effect, drop: r.drop_source,
}));

// 간단 검증: 존재하지 않는 ID 참조 차단
const ids = new Set(philosophers.map((p) => p.id));
const catIds = new Set(catalysts.map((c) => c.id));
const errors = [];
for (const r of recipes) {
  for (const id of [r.result, ...r.materials]) if (!ids.has(id)) errors.push(`${r.id}: 없는 철학자 ${id}`);
  if (r.catalyst && !catIds.has(r.catalyst)) errors.push(`${r.id}: 없는 촉매 ${r.catalyst}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/philosophers.json', JSON.stringify(philosophers, null, 2));
writeFileSync('src/data/recipes.json', JSON.stringify(recipes, null, 2));
writeFileSync('src/data/catalysts.json', JSON.stringify(catalysts, null, 2));
console.log(`✓ 철학자 ${philosophers.length} · 조합식 ${recipes.length} · 촉매 ${catalysts.length}`);
