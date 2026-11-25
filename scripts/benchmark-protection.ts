import {readFileSync} from 'node:fs';
import {arch,cpus} from 'node:os';
import {assembleModel,runSimulation} from '../src/engine';
import {resize} from '../src/constructor/model';
import {parseArrayRecord} from '../src/archive/waveform';
import type {RecordingMeta} from '../src/archive/catalog';
import {buildVariant,presetVariant} from '../src/protection/model';
import {solveProtection,type Experiment} from '../src/protection/analysis';
import {defaults} from '../src/seismic/motion';

const root=new URL('../public/archive/',import.meta.url);
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');
function recorded(manifest:string,match:(record:RecordingMeta)=>boolean){
  const metadata=(JSON.parse(read(manifest)) as RecordingMeta[]).find(match);
  if(!metadata)throw Error('Missing benchmark source.');
  const trace=parseArrayRecord(read(metadata.asset),metadata);
  return {label:metadata.event+' '+metadata.station+' NS',dt:trace.dt,provenance:metadata.sha256,samples:Array.from(trace.components.NS)};
}
const basic=[presetVariant('Ordinary reinforced concrete'),presetVariant('Isolated institutional'),presetVariant('Braced concrete'),presetVariant('Shear-wall residence')];
basic[3].devices.tmd=true;
const tall=structuredClone(basic[1]);
tall.building=resize(tall.building,20);
Object.assign(tall.devices,{tmd:true,tmdFloor:20,viscous:true});
const gorkha=recorded('gorkha-mainshock.json',r=>r.station==='KTP');
const dolakha=recorded('recordings.json',r=>r.station==='KTP'&&r.event==='us20002ejl');
const settings={...defaults};
const analytical=assembleModel({storeys:[{massKg:1000,heightM:3,stiffnessNPerM:80000}],damping:{kind:'none'},
  foundation:{kind:'isolation',bearing:{massKg:200,heightM:.45,stiffnessNPerM:12000,damperNsPerM:140}}});
console.log(JSON.stringify({node:process.version,architecture:arch(),cpu:cpus()[0].model,isolatedPeriods:analytical.modes.map(m=>m.period)}));
const omega=Math.sqrt(80),exact=.04*Math.cos(omega*1.2);
const convergence=[.04,.02,.01,.005].map(dt=>{
  const results=runSimulation({storeys:[{massKg:1000,heightM:3,stiffnessNPerM:80000,initialDisplacementM:.04}],damping:{kind:'none'}},
    {acceleration:new Float64Array(Math.round(1.2/dt)+1),dt,label:'Free response'});
  return {dt,error:Math.abs(results.traces.displacement.at(-1)!-exact)};
});
console.log(JSON.stringify({convergence}));
const fixtures:Record<string,Experiment>={
  '1 baseline':{version:1,notes:'',variants:basic.slice(0,1),settings},
  '2 protected comparison':{version:1,notes:'',variants:basic.slice(0,2),settings},
  '4 Gorkha cases':{version:1,notes:'',variants:basic,settings:{...settings,form:'Imported CSV'},recording:gorkha},
  '20 storeys + isolation + TMD, Dolakha':{version:1,notes:'',variants:[tall],settings:{...settings,form:'Imported CSV'},recording:dolakha},
};
for(const [name,scenario] of Object.entries(fixtures)){
  for(let i=0;i<3;i++)solveProtection(scenario);
  const values=Array.from({length:9},()=>solveProtection(scenario));
  const times=values.map(r=>r.elapsed).sort((a,b)=>a-b);
  const latest=values.at(-1)!;
  const assembled=buildVariant(scenario.variants[0]);
  console.log(JSON.stringify({name,steps:latest.comparison[0].steps,dofs:latest.comparison.map(r=>r.n),
    medianMs:+times[4].toFixed(2),p89Ms:+times[7].toFixed(2),size:latest.comparison.map(r=>r.time.length),
    peakResidualJ:Math.max(...latest.comparison.map(r=>r.peaks.energyResidual)),totalFloorKg:assembled.total,
    peakRoofMm:latest.comparison.map(r=>r.peaks.roofDisplacement*1000)}));
}
