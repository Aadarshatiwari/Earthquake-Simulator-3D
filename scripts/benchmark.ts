import {arch,cpus,release} from 'node:os';
import {engineeringPreset,runSimulation,waveform} from '../src/engine';
const preset=engineeringPreset('Soft storey');
const jobs=[
  {floors:1,dt:.005,seconds:30,stride:1},
  {floors:20,dt:.005,seconds:30,stride:7},
  {floors:20,dt:.001,seconds:120,stride:20},
];
console.log(process.version,arch(),release(),cpus()[0]?.model);
for(const job of jobs){
  const model={...preset,storeys:Array.from({length:job.floors},(_,i)=>preset.storeys[i%3])};
  const motion=waveform({dt:job.dt,seconds:job.seconds,frequencyHz:2,amplitude:.3,unit:'g',kind:'seeded'});
  const options={stride:job.stride};
  for(let i=0;i<3;i++)runSimulation(model,motion,options);
  const runs=Array.from({length:9},()=>runSimulation(model,motion,options).diagnostics);
  const sorted=runs.map(run=>run.elapsedMs).sort((a,b)=>a-b);
  console.log(JSON.stringify({...job,steps:runs[0].steps,outputSamples:runs[0].outputSamples,bytes:runs[0].bytes,
    minMs:sorted[0].toFixed(2),medianMs:sorted[4].toFixed(2),maxMs:sorted[8].toFixed(2)}));
}
