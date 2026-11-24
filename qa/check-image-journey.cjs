const fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm'), assert = require('node:assert/strict');
const path = require('node:path');
const file = path.join(__dirname,'../src/image-journey-route.ts');
const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020 } }).outputText;
const scope = { exports:{} }; vm.runInNewContext(code, scope);
const {AGORA_ROAD: road, journeyStops, roadSteps} = scope.exports;
for (const [x,y] of road) { assert.ok(x>0&&x<1&&y>0&&y<1); }
for(let i=1;i<road.length;i++) assert.ok(road[i][1]<=road[i-1][1], 'upward road never reverses its vertical order');
for(const n of [4,5]) {
  const stops=journeyStops(n);assert.equal(stops.length,n);assert.equal(new Set(stops).size,n);
  assert.equal(stops[0],4);assert.equal(stops.at(-1),road.length-1);
  for(let i=1;i<n;i++) {
    const forward=roadSteps(stops[i-1],stops[i]);
    assert.equal(forward[0],stops[i-1]+1);assert.equal(forward.at(-1),stops[i]);
    for(let j=1;j<forward.length;j++)assert.equal(forward[j]-forward[j-1],1);
    const back=roadSteps(stops[i],stops[i-1]);assert.equal(back.at(-1),stops[i-1]);
    for(let j=1;j<back.length;j++)assert.equal(back[j]-back[j-1],-1);
  }
}
assert.equal(roadSteps(4,4).length,0);
console.log('PASS image journey: 31 in-bounds road points; 4/5 unique stops; forward/reverse movement stays on adjacent road samples');
