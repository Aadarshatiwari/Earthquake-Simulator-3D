import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {assembleModel,runSimulation,SimulationCancelled,type Model,type Storey} from '../../src/engine';
import {readProject,presetConfig,resize} from '../../src/constructor/model';
import {defaults} from '../../src/seismic/motion';
import {axialBrace,buildVariant,equivalentWall,presetVariant,tunedDevice,type Variant} from '../../src/protection/model';
import {energyKinds,harmonicAmplitude,responseChange,sampleOffsets,solveProtection,type Experiment} from '../../src/protection/analysis';
import {readExperiment} from '../../src/protection/projects';
import {parseArrayRecord} from '../../src/archive/waveform';
import type {RecordingMeta} from '../../src/archive/catalog';

const storey:Storey={massKg:1000,heightM:3,stiffnessNPerM:80000};
const fixed:Model={storeys:[storey],damping:{kind:'none'}};
const simple=()=>presetVariant('Ordinary reinforced concrete');
const zero=(dt=.01)=>({acceleration:new Float64Array(Math.round(1.2/dt)+1),dt,label:'Zero'});
const job=(variants:Variant[]):Experiment=>({version:1,notes:'Benchmark',variants,settings:{...defaults,duration:4}});
function eigenvalues(k11:number,k22:number,k12:number,m1:number,m2:number){
  const trace=k11/m1+k22/m2,determinant=(k11*k22-k12*k12)/(m1*m2);
  const discriminant=Math.sqrt(trace**2-4*determinant);
  return [(trace-discriminant)/2,(trace+discriminant)/2];
}

it('matches fixed-base free motion and demonstrates second-order time-step convergence',()=>{
  const model:Model={...fixed,storeys:[{...storey,initialDisplacementM:.04}]};
  const omega=Math.sqrt(storey.stiffnessNPerM/storey.massKg),exact=.04*Math.cos(omega*1.2);
  const errors=[.04,.02,.01,.005].map(dt=>Math.abs(runSimulation(model,zero(dt)).traces.displacement.at(-1)!-exact));
  expect(errors[0]/errors[1]).toBeGreaterThan(3.6);
  expect(errors[1]/errors[2]).toBeGreaterThan(3.8);
  expect(errors[2]/errors[3]).toBeGreaterThan(3.9);
});

it('matches an independent isolated two-DOF characteristic polynomial and dashpot assembly',()=>{
  const bearing:Storey={massKg:200,heightM:.45,stiffnessNPerM:12000,damperNsPerM:140};
  const model:Model={...fixed,foundation:{kind:'isolation',bearing}};
  const s=assembleModel(model);
  expect(Array.from(s.K)).toEqual([92000,-80000,-80000,80000]);
  expect(Array.from(s.C)).toEqual([140,0,0,0]);
  const analytic=eigenvalues(92000,80000,-80000,200,1000);
  for(let i=0;i<2;i++)expect(s.modes[i].period).toBeCloseTo(2*Math.PI/Math.sqrt(analytic[i]),10);
  expect(s.modes[0].period).toBeGreaterThan(2*Math.PI/Math.sqrt(80));
});

it('derives bearing stiffness and damping from the stated total translating mass and target period',()=>{
  const v=presetVariant('Isolated institutional');
  const setup=buildVariant(v),s=assembleModel(setup.model),total=setup.total+v.devices.baseMass;
  const omega=2*Math.PI/v.devices.period;
  expect(s.K[0]+s.K[1]).toBeCloseTo(total*omega**2,7);
  expect(s.C[0]+s.C[1]).toBeCloseTo(2*v.devices.bearingRatio*total*omega,7);
  expect(setup.bearingPeriod).toBeCloseTo(v.devices.period,10);
});

it('projects a known 3–4–5 brace and applies active counts and bay coverage',()=>{
  expect(axialBrace(200e9,.002,4,3).k).toBeCloseTo(51.2e6,5);
  const v=presetVariant('Braced concrete');
  v.devices.braceFirst=2;v.devices.braceLast=3;v.devices.braceBays=2;
  const full=buildVariant(v).braces;
  v.devices.tensionOnly=true;
  const single=buildVariant(v).braces;
  expect(full[0]).toBe(0);expect(full[3]).toBe(0);
  expect(full[1]).toBeCloseTo(2*single[1],5);
  v.devices.braceKind='K · illustration';
  expect(buildVariant(v).braces.every(k=>k===0)).toBe(true);
});

it('matches independent cantilever top compliance through the equivalent wall storey springs',()=>{
  const v=presetVariant('Shear-wall residence');
  const d=v.devices;
  const height=v.building.levels.reduce((total,l)=>total+l.heightM,0);
  const I=d.wallThickness*d.wallLength**3/12,A=d.wallLength*d.wallThickness;
  const compliance=height**3/(3*d.wallE*I)+height/(5/6*(d.wallE/2.4)*A);
  expect(equivalentWall(d.wallE,d.wallLength,d.wallThickness,height,d.wallFactor)).toBeCloseTo(d.wallFactor/compliance,7);
  expect(buildVariant(v).wallSprings.reduce((total,k)=>total+1/k,0)).toBeCloseTo(compliance/d.wallFactor,12);
});

it('assembles a coupled tuned mass with symmetric links and independent modal frequencies',()=>{
  const mass=100,k=8000,c=39;
  const input:Model={...fixed,attachment:{floor:0,massKg:mass,stiffnessNPerM:k,damperNsPerM:c}};
  const s=assembleModel(input),roots=eigenvalues(88000,8000,-8000,1000,mass);
  expect(Array.from(s.mass)).toEqual([1000,100]);
  expect(Array.from(s.K)).toEqual([88000,-8000,-8000,8000]);
  expect(Array.from(s.C)).toEqual([39,-39,-39,39]);
  s.modes.forEach((mode,i)=>expect(mode.omega**2).toBeCloseTo(roots[i],10));
  expect(input.storeys).toHaveLength(1);
  const tuning=tunedDevice(mass,2,.1);
  expect(tuning.k).toBeCloseTo(mass*(4*Math.PI)**2);
  expect(tuning.c).toBeCloseTo(.2*mass*4*Math.PI);
});

it('matches the closed-form SDOF harmonic amplitude and generalized excitation antiresonance',()=>{
  const dashpot=500;
  const s=assembleModel({...fixed,storeys:[{...storey,damperNsPerM:dashpot}]});
  const hz=1,omega=2*Math.PI*hz;
  expect(harmonicAmplitude(s,hz)).toBeCloseTo(1000/Math.hypot(80000-1000*omega**2,omega*dashpot),12);
  // Both masses see base acceleration. At cancellation m1(kd-md ω²)+md kd = 0.
  const tuned:Model={...fixed,attachment:{floor:0,massKg:100,stiffnessNPerM:8000,damperNsPerM:0}};
  const anti=Math.sqrt(80*1.1)/(2*Math.PI);
  const mistuned:Model={...tuned,attachment:{...tuned.attachment!,stiffnessNPerM:15000}};
  expect(harmonicAmplitude(assembleModel(tuned),anti)).toBeCloseTo(0,11);
  expect(harmonicAmplitude(assembleModel(mistuned),anti)).toBeGreaterThan(.001);
});

it('projects per-device axial damping and couples only the selected adjacent DOFs',()=>{
  const v=simple();
  v.devices={...v.devices,viscous:true,viscousStorey:2,viscousCount:2,viscousC:1000,viscousAngle:60};
  const withDevices=assembleModel(buildVariant(v).model);
  v.devices.viscous=false;
  const without=assembleModel(buildVariant(v).model);
  const n=without.mass.length;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const expected=i<2&&j<2?(i===j?500:-500):0;
    expect(withDevices.C[i*n+j]-without.C[i*n+j]).toBeCloseTo(expected,8);
  }
});

it('reconciles dissipated energy across all devices and preserves energy balance',()=>{
  const v=presetVariant('Isolated institutional');
  Object.assign(v.devices,{brace:true,wall:true,tmd:true,viscous:true});
  const r=solveProtection(job([v])).comparison[0];
  const last=r.time.length-1;
  expect(r.n).toBe(7);
  expect(r.peaks.energyResidual).toBeLessThan(1e-7);
  expect(energyKinds.map(kind=>r.energy[kind][last]).every(value=>value>0)).toBe(true);
  for(let i=0;i<=last;i++){
    expect(energyKinds.reduce((total,key)=>total+r.energy[key][i],0)).toBeCloseTo(r.energy.dissipation[i],7);
  }
});

it('preserves zero response and zero-coefficient invariance with combined systems',()=>{
  const v=presetVariant('Isolated institutional');
  Object.assign(v.devices,{tmd:true,viscous:true,brace:true,wall:true});
  const run=runSimulation(buildVariant(v).model,zero());
  expect(run.peak.displacement).toBe(0);expect(run.energy.dissipation.at(-1)).toBe(0);
  const a=simple(),b=structuredClone(a);
  Object.assign(b.devices,{brace:true,braceArea:0,wall:true,wallFactor:0,viscous:true,viscousC:0});
  const result=solveProtection(job([a,b])).comparison;
  expect(result[0].peaks).toEqual(result[1].peaks);
});

it('uses every authentic Gorkha sample and a shared input across four protected configurations',()=>{
  const root=new URL('../../public/archive/',import.meta.url);
  const [meta]=JSON.parse(readFileSync(new URL('gorkha-mainshock.json',root),'utf8')) as RecordingMeta[];
  const original=readFileSync(new URL(meta.asset,root));
  expect(createHash('sha256').update(original).digest('hex')).toBe(meta.sha256);
  const trace=parseArrayRecord(original.toString(),meta);
  const variants=[simple(),presetVariant('Isolated institutional'),presetVariant('Braced concrete'),presetVariant('Shear-wall residence')];
  variants[3].devices.tmd=true;
  const r=solveProtection({...job(variants),settings:{...defaults,form:'Imported CSV'},recording:{
    label:'Gorkha KTP NS',dt:trace.dt,provenance:meta.sha256,samples:Array.from(trace.components.NS),
  }});
  expect(r.provenance).toBe(meta.sha256);
  for(const result of r.comparison){
    expect(result.steps).toBe(10000);expect(result.time.at(-1)).toBeCloseTo(99.99,8);
    expect(result.ground).toEqual(r.comparison[0].ground);
    expect(result.ground[0]).toBeCloseTo(trace.components.NS[0],12);
    expect(result.ground.at(-1)).toBeCloseTo(trace.components.NS.at(-1)!,12);
  }
});

it('rejects invalid inputs and supports cancellation without a partial result',()=>{
  const v=simple();v.devices.tmd=true;v.devices.tmdFloor=9;
  expect(()=>buildVariant(v)).toThrow(/floor/i);
  expect(()=>assembleModel({...fixed,storeys:[{...storey,massKg:-1}]})).toThrow(/Mass/);
  expect(()=>assembleModel({...fixed,storeys:[{...storey,stiffnessNPerM:0}]})).toThrow(/Stiffness/);
  expect(()=>assembleModel({...fixed,storeys:[{...storey,damperNsPerM:-1}]})).toThrow(/damping/);
  expect(()=>solveProtection(job([simple()]),{cancelled:()=>true})).toThrow(SimulationCancelled);
});

it('round-trips protected experiments alongside prior constructor projects',()=>{
  const old={version:1,id:'old-model',name:'Old model',config:presetConfig('Himalayan stone')};
  expect(readProject(JSON.stringify(old))).toEqual(old);
  const exp=job([presetVariant('Isolated institutional')]);
  expect(readExperiment(JSON.stringify(exp))).toEqual(exp);
  expect(()=>readExperiment(JSON.stringify({...exp,version:2}))).toThrow(/version 1/);
});

it('uses actual base, structural floor and tuned-mass sample indices for amplified movement',()=>{
  const v=presetVariant('Isolated institutional');
  v.building=resize(v.building,20);v.devices.tmd=true;v.devices.tmdFloor=20;
  const r=solveProtection(job([v])).comparison[0],sample=35;
  expect(r.n).toBe(22);
  const output=sampleOffsets(r,sample,18,20);
  expect(output.base).toBe(18*r.displacements[sample*r.n]);
  expect(output.floors[19]).toBe(18*r.displacements[sample*r.n+20]);
  expect(output.damper).toBe(18*r.displacements[sample*r.n+21]);
  expect(responseChange(0,2)).toBeNull();expect(responseChange(2,3)).toBe(-50);
});
