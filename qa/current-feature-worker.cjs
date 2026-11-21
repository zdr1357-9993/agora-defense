const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},fileName:file}).outputText,file);
const {playOne}=require('./current-feature-sim.ts');
const [jobsFile,outFile]=process.argv.slice(2);
for(const job of JSON.parse(fs.readFileSync(jobsFile,'utf8'))){fs.appendFileSync(outFile,JSON.stringify(playOne(job.condition,job.seed))+'\n');}
