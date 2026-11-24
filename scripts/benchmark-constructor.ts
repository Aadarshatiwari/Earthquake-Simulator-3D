import {arch,cpus,release} from 'node:os';
import {generate} from '../src/constructor/geometry';
import {presetConfig,resize,toModel} from '../src/constructor/model';
import {runSimulation,waveform} from '../src/engine';
const motion=waveform({kind:'envelope',dt:.005,seconds:16,frequencyHz:1.45,amplitude:.28,unit:'g'});
const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)].toFixed(3);
console.log(process.version,arch(),release(),cpus()[0]?.model);
for(const count of [1,5,10,20]){
  const config=resize(presetConfig('Modern apartment'),count);
  for(let i=0;i<3;i++){generate(config);runSimulation(toModel(config),motion);}
  const frames=Array.from({length:11},()=>{
    const start=performance.now();
    const geometry=generate(config);
    return {parts:geometry.parts.length,geometryMs:performance.now()-start,solveMs:runSimulation(toModel(config),motion).diagnostics.elapsedMs};
  });
  console.log(JSON.stringify({storeys:count,parts:frames[0].parts,medianGeometryMs:median(frames.map(f=>f.geometryMs)),medianSolverMs:median(frames.map(f=>f.solveMs))}));
}
