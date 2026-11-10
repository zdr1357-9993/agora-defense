import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {Game} = await server.ssrLoadModule('/src/game.ts');
  const {SKILLS,skillMode} = await server.ssrLoadModule('/src/skills.ts');
  const {PHILOSOPHERS,STAGES} = await server.ssrLoadModule('/src/data.ts');
  const {arenaArtName} = await server.ssrLoadModule('/src/pastel-art.ts');
  for(const p of PHILOSOPHERS) assert.ok(SKILLS[p.realName],`Missing skill: ${p.name}`);
  const names=new Set(STAGES.map(s=>arenaArtName(s.era,'greek-01')));
  assert.equal(names.size,STAGES.length,'A saved Greek choice must not replace other eras');
  assert.equal(arenaArtName('동양','greek-03'),'arena-east-v2');
  assert.equal(arenaArtName('동양','era','P7'),'arena-bodhi-v2');
  const originalRandom=Math.random;
  try {
    for(const p of PHILOSOPHERS) {
      const g=new Game(STAGES[0]);
      const t={uid:100,philId:p.id,cx:1,cy:1,cd:0,level:0,shots:0};
      g.towers=[t];
      const enemy={uid:200,hp:1e9,maxHp:1e9,dist:0,speed:0,boss:false,reward:0,name:'test',path:0,kind:'normal'};
      g.enemies=[enemy];
      const skill=SKILLS[p.realName], mode=skillMode(skill.kind);
      Math.random=()=>0;
      if(mode==='onHit') {
        g.onHit(enemy,10,skill,t);
        assert.ok(g.fx.some(f=>f.type==='ability'&&f.uid===100&&f.mode==='onHit'),p.name);
      } else if(mode==='passive') {
        g.update(.01);g.onHit(enemy,10,skill,t);
        assert.ok(!g.fx.some(f=>f.type==='ability'),`Passive must not impersonate cast: ${p.name}`);
      } else if(['stun','execute','gold'].includes(skill.kind)) {
        if(skill.kind==='execute')enemy.hp=enemy.maxHp*skill.v*.5;
        if(skill.kind==='gold')enemy.hp=1;
        g.onHit(enemy,10,skill,t);
        assert.ok(g.fx.some(f=>f.type==='ability'&&f.mode==='trigger'),p.name);
      } else {
        t.cx=.5;t.cy=.5;
        if(skill.kind==='third')t.shots=skill.v-1;
        g.update(.01);
        assert.ok(g.fx.some(f=>f.type==='ability'&&f.mode==='trigger'),p.name);
      }
      // Quoting is presentation only and cannot manufacture an ability event.
      g.fx=[];t.sayCd=0;g.say(t);
      assert.deepEqual(g.fx.map(f=>f.type),['say']);
    }
    // Failed probability and the first non-Nth attack have no cast event.
    for(const kind of ['crit','multi','third','stun','execute','gold']) {
      const p=PHILOSOPHERS.find(p=>SKILLS[p.realName].kind===kind),g=new Game(STAGES[0]);
      const t={uid:100,philId:p.id,cx:.5,cy:.5,cd:0,level:0,shots:0};
      const e={uid:200,hp:1e9,maxHp:1e9,dist:0,speed:0,boss:false,reward:0,name:'test',path:0,kind:'normal'};
      g.towers=[t];g.enemies=[e];Math.random=()=>.99999;
      if(['stun','execute','gold'].includes(kind))g.onHit(e,10,SKILLS[p.realName],t);else g.update(.01);
      assert.ok(!g.fx.some(f=>f.type==='ability'),`Unexpected cast on failure: ${kind}`);
    }
  } finally {Math.random=originalRandom;}
  console.log(`PASS: ${PHILOSOPHERS.length} actual skill definitions; passive/on-hit/trigger events; failed proc and dialogue isolation; era mapping and saved Greek override migration`);
} finally {await server.close();}
