import {arch,cpus,release} from 'node:os';
import {defaults} from '../src/seismic/motion';
import {solveJob,type Job} from '../src/seismic/jobs';
import {presetConfig,resize,type Project} from '../src/constructor/model';
console.log(process.version,arch(),release(),cpus()[0]?.model);
const building=(id:string,floors:number):Project=>({version:1,id,name:'Benchmark',config:resize(presetConfig('Concrete residence'),floors)});
for(const job of [
  {buildings:[building('a',5)],settings:defaults},
  {buildings:[building('a',20),building('b',20)],settings:{...defaults,duration:60,dt:.005}},
] satisfies Job[]){
  for(let i=0;i<3;i++)solveJob(job);
  const results=Array.from({length:9},()=>solveJob(job)).sort((a,b)=>a.elapsedMs-b.elapsedMs);
  const median=results[4];
  console.log(JSON.stringify({models:job.buildings.map(b=>b.config.levels.length),steps:median.results[0].diagnostics.steps,
    packedBytes:median.results.reduce((sum,r)=>sum+r.packed.byteLength,0),medianMs:+median.elapsedMs.toFixed(2),
    minMs:+results[0].elapsedMs.toFixed(2),maxMs:+results[8].elapsedMs.toFixed(2),
    finalGroundM:median.results[0].groundDisplacement.at(-1)}));
}
