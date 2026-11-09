import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {PHILOSOPHERS,STAGES}=await server.ssrLoadModule('/src/data.ts');
 const {STORY,CHAPTERS}=await server.ssrLoadModule('/src/story.ts');
 const {STAGE_PATHS}=await server.ssrLoadModule('/src/paths.ts');
 const {Game}=await server.ssrLoadModule('/src/game.ts');
 const {homeBonus}=await server.ssrLoadModule('/src/affinity.ts');
 assert.equal(STAGES.length,6);assert.equal(STORY.length,29);assert.equal(CHAPTERS.length,7);
 assert.equal(STAGES.find(s=>s.id==='S5').era,'근현대');
 assert.equal(STAGES.find(s=>s.id==='S6').era,'현대');
 assert.ok(!PHILOSOPHERS.some(p=>p.era==='현대'),'Existing philosophers keep historical era; no invented contemporary roster');
 const unique=new Set(STORY.map(s=>s.id));assert.equal(unique.size,29);
 const modern=STORY.filter(s=>s.chapter===6);assert.deepEqual(modern.map(s=>s.id),['P21','P22','P23','P24']);
 assert.equal(STORY[STORY.indexOf(modern[0])-1].id,'P20','Legacy finale opens new chapter');
 for(const st of STORY){assert.ok(STAGES.some(s=>s.id===st.base));for(const name of st.memories)assert.ok(PHILOSOPHERS.some(p=>p.realName===name),`Unknown reward ${name}`);assert.ok(st.intro.length&&st.outro.length);}
 for(const st of STAGES){const g=new Game(st);assert.ok(STAGE_PATHS[st.id].layoutFor(30).paths.length);g.raid={hp:50000,time:90,name:st.boss20};g.startRaid();g.update(5);assert.ok(g.fx.some(f=>f.type==='bossSkill'),`Missing raid ability ${st.id}`);}
 assert.equal(homeBonus('S5','근현대','카를 마르크스','근현대').mult,1.25);
 assert.equal(homeBonus('S6','현대','카를 마르크스','근현대').mult,1.25);
 console.log('PASS: 6 stages, 29 memories, 7 chapter tabs, P20→P24 continuity, all rewards resolve, six raid abilities and era bonus compatibility');
} finally {await server.close();}
