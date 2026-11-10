import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {PHILOSOPHERS:P,PHIL,RECIPES:R,ARCHIVED_PHILOSOPHERS:A,GRADE_STEPS,gradeRank,statsOf,materialGroups,STAGES,SUMMON_RATES}=await server.ssrLoadModule('/src/data.ts');
 const {Game}=await server.ssrLoadModule('/src/game.ts');
 const {SKILLS}=await server.ssrLoadModule('/src/skills.ts');
 const {signatureProfile}=await server.ssrLoadModule('/src/signature-fx.ts');
 const {STORY,START_POOL}=await server.ssrLoadModule('/src/story.ts');
 const {drawCard,setCardFilter,CARD_RATES}=await server.ssrLoadModule('/src/meta.ts');
 assert.equal(P.length,59);assert.equal(PHIL.size,59);assert.equal(R.length,52);assert.equal(A.length,28);
 assert.deepEqual(GRADE_STEPS.map(t=>P.filter(p=>gradeRank(p)===t).length),[7,8,3,3,10,3,6,5,6,2,6]);
 const costs=new Map(P.filter(p=>p.tier===1).map(p=>[p.id,1]));
 for(const r of [...R].sort((a,b)=>gradeRank(PHIL.get(a.result))-gradeRank(PHIL.get(b.result)))){
  const result=PHIL.get(r.result);assert.equal(r.catalyst,null);
  for(const id of r.materials){const p=PHIL.get(id);assert.ok(p);assert.ok(gradeRank(p)<gradeRank(result),`${p.name} → ${result.name}`);if(!result.origin)assert.ok(p.thoughtYear<=result.thoughtYear);}
  const mass=r.materials.reduce((s,id)=>s+costs.get(id),0);assert.ok(Number.isFinite(mass));assert.equal(mass,result.materialCost);costs.set(result.id,mass);
  const g=new Game(STAGES[0]);g.towers=r.materials.map((id,i)=>({uid:i+1,philId:id,cx:i%5+1,cy:Math.floor(i/5)+1,cd:0,level:0}));
  const sentinel={uid:9999,philId:'T106',cx:5,cy:5,cd:0,level:0};g.towers.push(sentinel);
  const n=g.towers.length,t=g.synthesize(r);assert.equal(t.philId,r.result);assert.equal(g.towers.length,n-r.materials.length+1);assert.ok(g.towers.includes(sentinel));
  if(r.materials.length>1){const miss=new Game(STAGES[0]);miss.towers=r.materials.slice(1).map((id,i)=>({uid:i+1,philId:id,cx:1,cy:1,cd:0,level:0}));assert.equal(miss.synthesize(r),null);}
 }
 for(const p of P){assert.ok(costs.has(p.id));assert.ok(SKILLS[p.realName]);assert.ok(signatureProfile(p.id));assert.ok(Number.isFinite(statsOf(p.id).dmg));if(p.tier<5)assert.ok(R.some(r=>r.materials.includes(p.id)));}
 for(const s of STORY){for(const name of s.memories)assert.ok(P.some(p=>p.realName===name),s.id+name);for(const name of s.pool??[])assert.ok(P.some(p=>p.realName===name&&p.tier===1),s.id+name);}
 for(const name of START_POOL)assert.ok(P.some(p=>p.realName===name&&p.tier===1));
 assert.equal(materialGroups(R.find(r=>r.result==='T705').materials).length,3);
 assert.equal(SUMMON_RATES.reduce((n,r)=>n+r.rate,0).toFixed(8),'1.00000000');assert.equal(CARD_RATES.reduce((n,r)=>n+r.rate,0).toFixed(8),'1.00000000');
 const random=Math.random;try{
  let sum=0;for(const b of CARD_RATES){Math.random=()=>sum+b.rate/2;const p=PHIL.get(drawCard(1,true));assert.equal(gradeRank(p),gradeRank(b));sum+=b.rate;}
  for(const value of [0,.999999999]){const g=new Game(STAGES[0]);g.gold=1e6;g.summonPool=['T106','T701'];Math.random=()=>value;assert.equal(g.summon().philId,value?'T701':'T106');}
  const g=new Game(STAGES[0]);g.gold=1e6;g.summonPool=['T106'];Math.random=()=>.99999;assert.equal(g.summon().philId,'T106');
  setCardFilter(p=>p.tier<=2);Math.random=()=>.99999;assert.ok(PHIL.get(drawCard()).tier<=2);assert.ok(PHIL.get(drawCard(6)).tier>=6,'Early pity still grants a master');
 }finally{Math.random=random;setCardFilter(()=>true);}
 // Exercise both local and cloud adoption, with removed-card favorites and skins.
 const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 const save=await server.ssrLoadModule('/src/save.ts');save.setAccount('regression');
 const previous=JSON.parse(fs.readFileSync('data/roster-v2-archive.json','utf8'));
 const cards=Object.fromEntries(previous.map((p,i)=>[p.id,i+1]));
 const old={cards,seen:previous.map(p=>p.id),favorite:'T101',skinOn:{T101:'night'},skins:['T101:night'],loadout:{T101:'cup'},cardXp:{T101:.9},gonoe:1234,gems:567,cleared:['S1:hard'],idv2:true};
 mem.set('agora_progress_v3:regression',JSON.stringify(old));const loaded=save.loadProgress();assert.deepEqual(loaded.cards,cards);assert.equal(loaded.favorite,'T101');assert.deepEqual(loaded.skinOn,old.skinOn);assert.deepEqual(loaded.cardXp,old.cardXp);
 const adopted=save.adoptProgress({...loaded,cards:{T101:52}});assert.equal(adopted.cards.T101,52);assert.equal(adopted.cards.T106,1);assert.equal(adopted.gems,567);assert.equal(save.loadProgress().cards.T106,1);assert.equal(adopted.favorite,'T101');
 console.log('PASS: 59 cards / 52 recipes; strict + ranks; chronology; recursive costs; every recipe consumes exact quantities; all skills/FX; all tutorial/reward pools; all probability bands; first-pull root; local/cloud archive compatibility');
}finally{await server.close();}
