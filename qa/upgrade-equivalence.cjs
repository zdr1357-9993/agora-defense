// 강화 수치 데이터화(019) 전·후 동등성 덤프. 사용: node qa/upgrade-equivalence.cjs > 파일 ; 전·후 파일을 diff 한다.
// 게임 코드를 그대로 불러(시뮬레이터와 같은 CJS 로더) 실제 동작을 표로 뽑는다: 상수, 모든 카드×레벨 비용, 효과 배율, 구간 일괄 강화, 고정 시드 시뮬레이션.
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,resolveJsonModule:true},fileName:file}).outputText,file);
const {Game}=require('../src/game.ts');const {STAGES,PHILOSOPHERS,UPGRADE}=require('../src/data.ts');const {playOne}=require('./current-feature-sim.ts');
const out=[];const log=(...a)=>out.push(a.join(' '));
const {maxLevel,perLevel,provisionalCosts,bands}=UPGRADE;
log('CONST',JSON.stringify({maxLevel,perLevel,provisionalCosts,bands}));
const meta={cardMult:()=>1,tool:()=>undefined};
// 1) 카드 68장 × 레벨 0~5: 한 명 비용(upgradeCost)과 효과 배율(1+perLevel×level)
for(const p of PHILOSOPHERS)for(let lv=0;lv<=maxLevel;lv++){const g=new Game(STAGES[0],meta,'normal');const t={uid:1,philId:p.id,cx:1,cy:1,cd:0,level:lv};g.towers.push(t);log('COST',p.id,`tier=${p.tier}`,`plus=${!!p.plus}`,`lv=${lv}`,`cost=${g.upgradeCost(t)}`,`mult=${1+UPGRADE.perLevel*lv}`);}
// 2) 구간 일괄 강화: 구간마다 해당 카드 전원(Lv0) + 대기석 1명, 골드 충분 → 소모·레벨
for(const b of bands){const g=new Game(STAGES[0],meta,'normal');g.gold=10_000_000;const ids=PHILOSOPHERS.filter(p=>p.tier>=b.minTier&&p.tier<=b.maxTier).map(p=>p.id);
 const cells=g.emptyCells();ids.forEach((id,i)=>{const c=cells[i%cells.length];g.towers.push({uid:100+i,philId:id,cx:c[0],cy:c[1],cd:0,level:i%maxLevel});});
 const info=g.upgradeBandInfo(b.id);const before=g.gold;const ok=g.upgradeBand(b.id);log('BAND',b.id,`n=${ids.length}`,`eligible=${info.eligible.length}`,`total=${info.totalCost}`,`ok=${ok}`,`spent=${before-g.gold}`,`levels=${g.towers.map(t=>t.level).join(',')}`);}
// 3) 고정 시드 시뮬레이션(강화를 쓰는 정책)
for(const variant of ['upgrade_recruit','baseline'])for(const seed of [424242,7,99]){const cond={stage:'S1',diff:'normal',growth:'starter',policy:'power',variant};log('SIM',variant,seed,JSON.stringify(playOne(cond,seed)));}
process.stdout.write(out.join('\n')+'\n');
