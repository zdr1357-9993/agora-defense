import { PHIL, RECIPES, gradeRank } from '../src/data';
import type { Game } from '../src/game';

/** Count actual owned copies against the current recipe graph. */
export function targetPlan(g: Game, target: string) {
  const stock = new Map<string, number>();
  for (const t of g.towers) stock.set(t.philId, (stock.get(t.philId) ?? 0) + 1);
  const reserved = new Map<string, number>(), needed = new Map<string, number>(), routesUsed = new Set<string>();
  let missing = 0;
  const visit = (id: string, ancestors: Set<string>): boolean => {
    if (!PHIL.has(id) || ancestors.has(id)) return false;
    const have = stock.get(id) ?? 0;
    if (have > 0) { stock.set(id, have - 1); reserved.set(id, (reserved.get(id) ?? 0) + 1); return true; }
    needed.set(id, (needed.get(id) ?? 0) + 1);
    const routes = RECIPES.filter(r => r.result === id && !g.isLocked(r));
    if (!routes.length) { missing++; return true; }
    const options = routes.map(r => {
      const state = [new Map(stock), new Map(reserved), new Map(needed), new Set(routesUsed), missing] as const;
      const valid = r.materials.every(m => visit(m, new Set(ancestors).add(id)));
      const option = { r, valid, stock: new Map(stock), reserved: new Map(reserved), needed: new Map(needed), routes: new Set(routesUsed), missing };
      stock.clear(); state[0].forEach((v,k)=>stock.set(k,v)); reserved.clear(); state[1].forEach((v,k)=>reserved.set(k,v));
      needed.clear(); state[2].forEach((v,k)=>needed.set(k,v)); routesUsed.clear(); state[3].forEach(v=>routesUsed.add(v)); missing=state[4];
      return option;
    }).filter(x=>x.valid).sort((a,b)=>a.missing-b.missing||a.r.id.localeCompare(b.r.id));
    if (!options.length) return false;
    const best=options[0]; stock.clear();best.stock.forEach((v,k)=>stock.set(k,v));reserved.clear();best.reserved.forEach((v,k)=>reserved.set(k,v));
    needed.clear();best.needed.forEach((v,k)=>needed.set(k,v));routesUsed.clear();best.routes.forEach(v=>routesUsed.add(v));missing=best.missing;
    routesUsed.add(best.r.id); return true;
  };
  const reachable=visit(target,new Set());
  return {reachable,missing,reserved,needed,routesUsed};
}

export function targetChoice(g: Game, target: string, emergency: boolean) {
  const plan=targetPlan(g,target);
  const usable=g.availableRecipes().filter(r=>!g.isLocked(r)&&g.hasCatalyst(r)).sort((a,b)=>gradeRank(PHIL.get(b.result)!)-gradeRank(PHIL.get(a.result)!));
  const route=usable.find(r=>plan.routesUsed.has(r.id)&&(plan.needed.get(r.result)??0)>0&&r.materials.every(id=>(plan.reserved.get(id)??0)>0));
  if(route)return {recipe:route,reason:'target' as const};
  if(emergency&&usable.length)return {recipe:usable[0],reason:'survival' as const};
  return null;
}
