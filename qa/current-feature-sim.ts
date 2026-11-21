import { Game, RECRUIT_BANDS, type Tower } from '../src/game';
import { COMBAT, PHIL, PHILOSOPHERS, RECIPES, STAGES, gradeRank, type Recipe } from '../src/data';
import { targetChoice, targetPlan } from './target-policy';

export type Variant = 'baseline' | 'upgrade' | 'upgrade_recruit';
export type Growth = 'starter' | 'mid' | 'unlocked';
export type Policy = 'power' | 'target';
export interface Condition { stage:string; diff:string; variant:Variant; growth:Growth; policy:Policy; target?:string }
export interface GameResult { condition:Condition; seed:number; outcome:string; wave:number; lives:number; seconds:number; target?:string; targetWave?:number; targetMissing?:number; firstRank:Record<string,number>; synth:Record<string,number>; philosopherReach:Record<string,number>; recruitedIds:Record<string,number>; upgradesByBand:Record<string,{levels:number;spend:number}>; recruitCount:number; recruitSpend:number; upgradeCount:number; upgradeSpend:number; insightLeft:number; goldLeft:number }

function mulberry32(a:number){return()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rank=(id:string)=>gradeRank(PHIL.get(id)!);
const resultRecipe=new Map<string,Recipe>();for(const r of RECIPES)if(!resultRecipe.has(r.result))resultRecipe.set(r.result,r);

export function playOne(condition:Condition,seed:number):GameResult {
 const random=mulberry32(seed),realRandom=Math.random;Math.random=random;
 try{
  const stage=STAGES.find(s=>s.id===condition.stage)!;
  const g=new Game(stage,{cardMult:()=>condition.growth==='mid'?1.5:1,tool:()=>undefined},condition.diff);
  g.locked=condition.growth==='starter'?new Set(PHILOSOPHERS.filter(p=>p.tier>=6||p.hidden).map(p=>p.id)):condition.growth==='mid'?new Set(PHILOSOPHERS.filter(p=>p.tier>=7||p.hidden).map(p=>p.id)):new Set(PHILOSOPHERS.filter(p=>p.hidden).map(p=>p.id));
  g.lockedRecipes=condition.growth==='starter'||condition.growth==='mid'?new Set(RECIPES.filter(r=>r.logic.startsWith('지름길')).map(r=>r.id)):new Set();
  let target=condition.target;
  if(condition.policy==='target'&&!target){const ps=PHILOSOPHERS.filter(p=>!p.hidden&&p.tier>1&&p.tier<=(condition.growth==='starter'?5:condition.growth==='mid'?6:7)&&resultRecipe.has(p.id)&&!g.locked.has(p.id));target=ps[Math.floor(random()*ps.length)]?.id;}
  const res:GameResult={condition,seed,outcome:'timeout',wave:0,lives:g.lives,seconds:0,target,firstRank:{},synth:{},philosopherReach:{},recruitedIds:{},upgradesByBand:{},recruitCount:0,recruitSpend:0,upgradeCount:0,upgradeSpend:0,insightLeft:0,goldLeft:0};
  const eligible=(r:Recipe)=>!g.isLocked(r)&&g.hasCatalyst(r);
  const markReach=(id:string)=>{res.philosopherReach[id]??=g.wave;if(id===target&&res.targetWave===undefined)res.targetWave=g.wave;};
  const synthesize=(r:Recipe)=>{const t=g.synthesize(r);if(!t)return false;res.synth[r.result]=(res.synth[r.result]??0)+1;markReach(r.result);return true;};
  const fillField=()=>{for(let i=0;i<6;i++){const b=g.towers.filter(t=>g.isBench(t)).sort((a,b)=>rank(b.philId)-rank(a.philId))[0],f=g.fielded().sort((a,b)=>rank(a.philId)-rank(b.philId))[0];if(!b||!f||rank(b.philId)<=rank(f.philId))break;[b.cx,f.cx]=[f.cx,b.cx];[b.cy,f.cy]=[f.cy,b.cy];}};
  const upgrade=()=>{const ordered=['high','rare','common'];for(const band of ordered){const info=g.upgradeBandInfo(band);if(info?.eligible.length&&g.gold>=info.totalCost){const n=info.eligible.length,cost=info.totalCost;if(g.upgradeBand(band)){res.upgradeCount+=n;res.upgradeSpend+=cost;const row=res.upgradesByBand[band]??={levels:0,spend:0};row.levels+=n;row.spend+=cost;}}}return ordered.some(band=>{const info=g.upgradeBandInfo(band);return !!info?.eligible.length&&info.totalCost>g.gold&&info.totalCost-g.gold<=200;});};
  const recruit=()=>{
    if(condition.variant!=='upgrade_recruit')return;
    for(let count=0;count<10;count++){
      const choices=[...RECRUIT_BANDS].reverse().filter(b=>g.canRecruit(b.cost));
      if(!choices.length)break;
      const options=choices.flatMap(b=>PHILOSOPHERS.filter(p=>!p.hidden&&!g.locked.has(p.id)&&p.tier>=b.min&&p.tier<=b.max).map(p=>({p,b})));
      if(!options.length)break;
      const roster=options.filter(x=>x.b.cost===choices[0].cost);
      let chosen=roster[Math.floor(random()*roster.length)];
      if(condition.policy==='target'&&target){const before=targetPlan(g,target).missing;const useful=roster.map(x=>({x,missing:targetPlanWithExtra(g,target,x.p.id)})).filter(x=>x.missing<before).sort((a,b)=>a.missing-b.missing||rank(b.x.p.id)-rank(a.x.p.id));if(useful.length)chosen=useful[0].x;}
      if(!chosen||!g.recruit(chosen.p.id,chosen.b.cost))break;
      markReach(chosen.p.id);
      res.recruitCount++;res.recruitSpend+=chosen.b.cost;
      res.recruitedIds[chosen.p.id]=(res.recruitedIds[chosen.p.id]??0)+1;
    }
  };
  const summon=()=>{let i=0;while(g.canSummon()&&i++<20){const t=g.summon();if(t)markReach(t.philId);}};
  const act=()=>{
   const savingForUpgrade=condition.variant!=='baseline'&&upgrade();
   recruit();if(!savingForUpgrade)summon();
   for(let i=0;i<10;i++){
    const available=g.availableRecipes().filter(eligible);
    const choice=condition.policy==='target'&&target?targetChoice(g,target,g.lives<=Math.ceil(g.diff.lives*.25)&&g.enemies.length>0):null;
    const r=choice?.recipe??(condition.policy==='power'?available.sort((a,b)=>rank(b.result)-rank(a.result))[0]:undefined);
    if(!r||!synthesize(r))break;
   }
   fillField();
  };
  const track=()=>{const max=Math.max(0,...g.towers.map(t=>rank(t.philId)));for(const n of [6,6.5,7])if(max>=n&&res.firstRank[String(n)]===undefined)res.firstRank[String(n)]=g.wave;};
  g.startWave();let tick=0;const dt=.05,maxTicks=80000;
  for(;tick<maxTicks&&!g.over;tick++){if(tick%4===0){act();track();}g.update(dt);g.fx.length=0;if(!g.running&&!g.over&&g.countdown<=0&&g.wave<g.maxWave)g.startWave();}
  res.outcome=g.over??'timeout';res.wave=g.wave;res.lives=g.lives;res.seconds=Math.round(tick*dt);res.insightLeft=g.insight;res.goldLeft=g.gold;if(target)res.targetMissing=targetPlan(g,target).missing;
  return res;
 }finally{Math.random=realRandom;}
}
function targetPlanWithExtra(g:Game,target:string,id:string){const tower:Tower={uid:-999,philId:id,cx:0,cy:0,cd:0,level:0};g.towers.push(tower);try{return targetPlan(g,target).missing;}finally{g.towers.pop();}}
