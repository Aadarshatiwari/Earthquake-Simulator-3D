import {assembleModel,runSimulation,type Model} from '../engine';
import {finite} from '../engine/matrix';
import {makeMotion,type MotionSettings,type Recording} from '../seismic/motion';
import {buildVariant,type Dashpot,type Variant} from './model';

export const energyKinds=['Structural','Isolation','Tuned mass','Viscous'] as const;
export type EnergyKind=typeof energyKinds[number];
export type Experiment={version:1;variants:Variant[];settings:MotionSettings;recording?:Recording;notes:string};
export type RunControls={cancelled?:()=>boolean;onProgress?:(value:number)=>void};

export function responseChange(baseline:number,modified:number){
  return Math.abs(baseline)<1e-10?null:100*(baseline-modified)/baseline;
}

export function harmonicAmplitude(structure:ReturnType<typeof assembleModel>,hz:number){
  const omega=2*Math.PI*finite(hz,'Frequency',.001,40);
  const {mass,K,C,influence,structuralCount}=structure;
  const n=mass.length,size=n*2,stride=size+1;
  const matrix=new Float64Array(size*stride);
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      const real=K[i*n+j]-(i===j?omega**2*mass[i]:0),imag=omega*C[i*n+j];
      matrix[i*stride+j]=real;matrix[i*stride+n+j]=-imag;
      matrix[(i+n)*stride+j]=imag;matrix[(i+n)*stride+n+j]=real;
    }
    matrix[i*stride+size]=-mass[i]*influence[i];
  }
  for(let i=0;i<size;i++){
    let pivot=i;
    for(let j=i+1;j<size;j++)if(Math.abs(matrix[j*stride+i])>Math.abs(matrix[pivot*stride+i]))pivot=j;
    const coefficient=matrix[pivot*stride+i];
    if(Math.abs(coefficient)<1e-8)return null;
    if(pivot!==i)for(let k=i;k<=size;k++){
      const a=i*stride+k,b=pivot*stride+k,tmp=matrix[a];
      matrix[a]=matrix[b];matrix[b]=tmp;
    }
    for(let j=i+1;j<size;j++){
      const factor=matrix[j*stride+i]/coefficient;
      for(let k=i+1;k<=size;k++)matrix[j*stride+k]-=factor*matrix[i*stride+k];
    }
  }
  const result=new Float64Array(size);
  for(let i=size-1;i>=0;i--){
    let load=matrix[i*stride+size];
    for(let j=i+1;j<size;j++)load-=matrix[i*stride+j]*result[j];
    result[i]=load/matrix[i*stride+i];
  }
  return Math.hypot(result[structuralCount-1],result[structuralCount-1+n]);
}
export function harmonicSweep(model:Model,controls:RunControls={},maxHz=10){
  const structure=assembleModel(model);
  const frequencies=new Set(Array.from({length:101},(_,i)=>.05+i*(maxHz-.05)/100));
  for(const mode of structure.modes){
    if(mode.hz>maxHz||mode.hz<.05)continue;
    for(const scale of [.96,.98,.99,1,1.01,1.02,1.04]){
      const point=mode.hz*scale;
      if(point>=.05&&point<=maxHz)frequencies.add(point);
    }
  }
  return [...frequencies].sort((a,b)=>a-b).map(hz=>{
    if(controls.cancelled?.())throw Error('Simulation cancelled.');
    return [hz,harmonicAmplitude(structure,hz)] as const;
  });
}

type Run=ReturnType<typeof runSimulation>;
function relative(row:Float64Array,n:number,step:number,link:Dashpot){
  const index=step*n;
  return row[index+link.to]-(link.from<0?0:row[index+link.from]);
}
function describe(run:Run,links:Dashpot[]){
  const n=run.structure.mass.length,last=run.time.length-1;
  const interval=run.time[1]-run.time[0];
  const keep=Array.from({length:Math.ceil(last/Math.max(1,Math.ceil(last/1400)))+1},(_,i)=>Math.min(last,i*Math.max(1,Math.ceil(last/1400))));
  const energies=Object.fromEntries(energyKinds.map(kind=>[kind,new Float64Array(keep.length)])) as Record<EnergyKind,Float64Array>;
  const running={Structural:0,Isolation:0,'Tuned mass':0,Viscous:0};
  const devices=links.filter(link=>link.kind!=='Structural').map(link=>({
    kind:link.kind,peakMovement:0,peakForce:0,peakVelocity:0,axialCoefficient:link.axialC,equivalentCoefficient:link.c,count:link.count,
    peakAbsoluteMovement:0,
  }));
  let next=0;
  const previous=new Float64Array(links.length);
  for(let i=0;i<=last;i++){
    let device=0;
    links.forEach((link,j)=>{
      const v=relative(run.traces.velocity,n,i,link);
      if(i)running[link.kind]+=interval*link.c*((previous[j]+v)/2)**2;
      previous[j]=v;
      if(link.kind==='Structural')return;
      const record=devices[device++];
      record.peakMovement=Math.max(record.peakMovement,Math.abs(relative(run.traces.displacement,n,i,link)));
      record.peakAbsoluteMovement=Math.max(record.peakAbsoluteMovement,Math.abs(run.traces.displacement[i*n+link.to]));
      record.peakVelocity=Math.max(record.peakVelocity,Math.abs(v*link.cosine));
      record.peakForce=Math.max(record.peakForce,Math.abs(link.axialC*v*link.cosine));
    });
    if(i===keep[next]){
      for(const kind of energyKinds)energies[kind][next]=running[kind];
      next++;
    }
  }
  const series=(values:Float64Array)=>Float64Array.from(keep,i=>values[i]);
  function sampleRows(values:Float64Array){
    const result=new Float64Array(keep.length*n);
    keep.forEach((sample,i)=>result.set(values.subarray(sample*n,(sample+1)*n),i*n));
    return result;
  }
  const modes=run.structure.modes.map(({hz,period,effectiveMassRatio})=>({hz,period,effectiveMassRatio}));
  const {M,K,C,parent,structuralCount,isolated}=run.structure;
  return {time:series(run.time),ground:series(run.ground),displacements:sampleRows(run.traces.displacement),
    drifts:sampleRows(run.traces.drift),accelerations:sampleRows(run.traces.absoluteAcceleration),shear:series(run.baseShear),
    energy:{kinetic:series(run.energy.kinetic),strain:series(run.energy.strain),input:series(run.energy.work),dissipation:series(run.energy.dissipation),balance:series(run.energy.residual),...energies},
    initialEnergy:run.energy.initialEnergy,devices,peaks:run.peak,steps:run.diagnostics.steps,warnings:run.warnings,
    modes,n,M,K,C,parent,structuralCount,isolated,pga:run.diagnostics.pga,dt:interval};
}
export function solveProtection(experiment:Experiment,controls:RunControls={}){
  const {variants,settings,recording}=experiment;
  if(!Array.isArray(variants)||variants.length<1||variants.length>4)throw Error('Compare one to four buildings.');
  const {motion}=makeMotion(settings,recording);
  const start=performance.now();
  const configurations=variants.map(buildVariant);
  const comparison=configurations.map((setup,index)=>{
    const run=runSimulation(setup.model,motion,{maxSteps:18001,maxOutputBytes:32*1024*1024,cancelled:controls.cancelled,onProgress:value=>controls.onProgress?.((index+value*.9)/variants.length)});
    return {...describe(run,setup.links),bearingPeriod:setup.bearingPeriod,braceStiffness:setup.braces,wallStiffness:setup.wallSprings,
      sweep:harmonicSweep(setup.model,controls)};
  });
  controls.onProgress?.(1);
  return {comparison,label:motion.label,provenance:motion.provenance,elapsed:performance.now()-start};
}
export type LabResult=ReturnType<typeof solveProtection>;
export type CaseResult=LabResult['comparison'][number];

export function sampleOffsets(result:CaseResult|undefined,sample:number,scale:number,levels:number){
  const baseIndex=(result?.n??0)*sample;
  const shift=(index:number)=>scale*(result?.displacements[baseIndex+index]??0);
  const modelOffset=Number(result?.isolated);
  return {base:result?.isolated?shift(0):0,floors:Array.from({length:levels},(_,i)=>shift(i+modelOffset)),
    damper:result&&result.n>result.structuralCount?shift(result.n-1):null};
}
