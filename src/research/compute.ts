import {runSimulation,type GroundMotion} from '../engine';
import {resize} from '../constructor/model';
import {buildVariant,type Variant} from '../protection/model';
import {responseChange,energyKinds,harmonicSweep} from '../protection/analysis';
import {elasticSpectrum,fourier,intensity,spectrogram,type WindowName} from './signal';

export const parameters=['Storeys','Floor mass multiplier','Storey stiffness multiplier','Structural damping (%)','Isolation period (s)','Isolation stiffness (N/m)','Isolation damping ratio','Brace area (m²)','Wall stiffness factor','TMD mass ratio','TMD frequency (Hz)','Viscous coefficient (N·s/m)'] as const;
export type Parameter=typeof parameters[number];
export const objectives=['roofDisplacement','superstructureDrift','floorAcceleration','baseShear'] as const;
export type Objective=typeof objectives[number];
export type Axis={parameter:Parameter;min:number;max:number;count:number;log:boolean};
export type Settings={ratios:number[];window:WindowName;demean:boolean;pad:number;frame:number;overlap:number;threshold:number;periodMin?:number;periodMax?:number};
export const analysisDefaults:Settings={ratios:[.02,.05,.1,.15,.2],window:'Hann',demean:true,pad:1,frame:256,overlap:.5,threshold:.4903325};

export function revise(input:Variant,parameter:Parameter,value:number){
  const v=structuredClone(input),d=v.devices,b=v.building;
  switch(parameter){
    case 'Storeys':{
      const n=Math.round(value);v.building=resize(b,n);
      d.braceFirst=Math.min(d.braceFirst,n);d.braceLast=Math.min(d.braceLast,n);
      d.wallFirst=Math.min(d.wallFirst,n);d.wallLast=Math.min(d.wallLast,n);
      d.tmdFloor=Math.min(d.tmdFloor,n);d.viscousStorey=Math.min(d.viscousStorey,n);break;
    }
    case 'Floor mass multiplier':b.levels.forEach(l=>{l.massKg*=value;});break;
    case 'Storey stiffness multiplier':b.levels.forEach(l=>{l.stiffnessNPerM*=value;});break;
    case 'Structural damping (%)':b.damping=value;break;
    case 'Isolation period (s)':d.isolation=true;d.period=value;d.bearingK=0;break;
    case 'Isolation stiffness (N/m)':d.isolation=true;d.bearingK=value;break;
    case 'Isolation damping ratio':d.isolation=true;d.bearingRatio=value;d.bearingC=0;break;
    case 'Brace area (m²)':d.brace=true;d.braceArea=value;break;
    case 'Wall stiffness factor':d.wall=true;d.wallFactor=value;break;
    case 'TMD mass ratio':d.tmd=true;d.tmdMass=value*b.levels.reduce((s,l)=>s+l.massKg,0);break;
    case 'TMD frequency (Hz)':d.tmd=true;d.tmdHz=value;break;
    case 'Viscous coefficient (N·s/m)':d.viscous=true;d.viscousC=value;break;
    default:throw Error('Unknown sweep parameter.');
  }
  return v;
}
export function axisValues(axis:Axis){
  const {min,max,count,log}=axis;
  if(![min,max,count].every(Number.isFinite)||min>=max||count<2||count>16||!Number.isInteger(count)||log&&min<=0)throw Error('Use an increasing range and 2–16 samples per axis. Log ranges must be positive.');
  return Array.from({length:count},(_,i)=>{
    const t=i/(count-1),value=log?min*(max/min)**t:min+(max-min)*t;
    return axis.parameter==='Storeys'?Math.round(value):value;
  }).filter((v,i,all)=>!i||v!==all[i-1]);
}
export function solve(v:Variant,input:GroundMotion){
  return runSimulation(buildVariant(v).model,input,{maxSteps:60001,maxOutputBytes:96*1024*1024});
}
export function scan(v:Variant,motion:GroundMotion,a:Axis,b:Axis|null,metric:Objective){
  if(!objectives.includes(metric)||b?.parameter===a.parameter)throw Error('Select different sweep variables and a supported response.');
  const x=axisValues(a),y=b?axisValues(b):[0];
  if(y.length*x.length>100)throw Error('Use at most 100 combinations per experiment.');
  const model=(v:Variant)=>runSimulation(buildVariant(v).model,motion,{stride:motion.acceleration.length,maxSteps:18001});
  const baseline=model(v).peak[metric];
  const observed=y.map(outer=>x.map(inner=>model(b?revise(revise(v,a.parameter,inner),b.parameter,outer):revise(v,a.parameter,inner)).peak[metric]));
  return {x,y,observed,baseline,min:Math.min(...observed.flat()),max:Math.max(...observed.flat())};
}
export function compareInputs(inputs:GroundMotion[],variants:Variant[]){
  if(inputs.length<2||inputs.length>4||variants.length<1||variants.length>4)throw Error('Compare two to four records and one to four configurations.');
  return inputs.flatMap(input=>{
    const measure=intensity(input.acceleration,input.dt);
    return variants.map(v=>{
      const result=runSimulation(buildVariant(v).model,input,{stride:input.acceleration.length,maxSteps:18001});
      return {input:input.label,provenance:input.provenance??'',duration:measure.duration,dt:input.dt,pga:measure.pga,arias:measure.arias,case:v.name,peak:result.peak};
    });
  });
}
export function sensitivity(v:Variant,motion:GroundMotion,metric:Objective){
  const solvePeak=(candidate:Variant)=>runSimulation(buildVariant(candidate).model,motion,{stride:motion.acceleration.length}).peak[metric];
  const reference=solvePeak(v);
  const variables:Array<[Parameter,number]>=[['Floor mass multiplier',1],['Storey stiffness multiplier',1],['Structural damping (%)',v.building.damping]];
  if(v.devices.isolation)variables.push(['Isolation period (s)',v.devices.period]);
  if(v.devices.tmd)variables.push(['TMD frequency (Hz)',v.devices.tmdHz]);
  if(v.devices.viscous)variables.push(['Viscous coefficient (N·s/m)',v.devices.viscousC]);
  return variables.map(([parameter,value])=>{
    const low=solvePeak(revise(v,parameter,value*.9)),high=solvePeak(revise(v,parameter,value*1.1));
    const absolute=value>0?(high-low)/(.2*value):null;
    const elasticity=Math.abs(reference)>1e-10&&absolute!==null?absolute*value/reference:null;
    return {parameter,low:responseChange(reference,low),high:responseChange(reference,high),absolute,elasticity};
  }).sort((a,b)=>Math.abs(b.elasticity??0)-Math.abs(a.elasticity??0));
}
export function refine(v:Variant,motion:GroundMotion){
  const result=[1,2,3].map(factor=>{
    const samples=Float64Array.from({length:(motion.acceleration.length-1)*factor+1},(_,i)=>{
      const k=Math.floor(i/factor),f=i/factor-k;
      return motion.acceleration[k]*(1-f)+(motion.acceleration[k+1]??motion.acceleration[k])*f;
    });
    const r=runSimulation(buildVariant(v).model,{...motion,dt:motion.dt/factor,acceleration:samples},{stride:factor,maxSteps:60001,maxOutputBytes:32*1024*1024});
    const roof=Float64Array.from(r.time,(_,i)=>r.traces.displacement[i*r.structure.mass.length+r.structure.structuralCount-1]);
    return {factor,dt:motion.dt/factor,peak:r.peak.roofDisplacement,residual:r.peak.energyResidual,ms:r.diagnostics.elapsedMs,roof};
  });
  const fine=result.at(-1)!;
  return result.map(({roof,...value})=>({...value,peakDifference:Math.abs(value.peak-fine.peak),maxHistoryDifference:roof.reduce((max,u,i)=>Math.max(max,Math.abs(u-fine.roof[i])),0)}));
}
export function channelsFor(v:Variant,run:ReturnType<typeof solve>){
  const built=buildVariant(v),n=run.structure.mass.length;
  const split=Object.fromEntries(energyKinds.map(kind=>[kind,new Float64Array(run.time.length)])) as Record<typeof energyKinds[number],Float64Array>;
  const devices=built.links.filter(link=>link.kind!=='Structural').map(link=>({
    kind:link.kind,travel:new Float64Array(run.time.length),force:new Float64Array(run.time.length),
  }));
  for(let i=0;i<run.time.length;i++){
    let index=0;
    if(i)for(const kind of energyKinds)split[kind][i]=split[kind][i-1];
    for(const link of built.links){
      const relative=(channel:Float64Array,j:number)=>channel[j*n+link.to]-(link.from<0?0:channel[j*n+link.from]);
      const v=relative(run.traces.velocity,i);
      if(i)split[link.kind][i]+=(run.time[i]-run.time[i-1])*link.c*((v+relative(run.traces.velocity,i-1))/2)**2;
      if(link.kind!=='Structural'){
        devices[index].travel[i]=relative(run.traces.displacement,i);
        devices[index++].force[i]=link.axialC*link.cosine*v;
      }
    }
  }
  return {split,devices};
}
export function analyze(motion:GroundMotion,variants:Variant[],settings:Settings){
  if(variants.length<1||variants.length>4)throw Error('Select one to four structural configurations.');
  const requested=settings.periodMin??.05,max=settings.periodMax??10;
  if(!Number.isFinite(requested)||requested<=0||!Number.isFinite(max)||max>30||max<=requested)throw Error('Use a valid spectrum interval up to 30 seconds.');
  const min=Math.max(requested,motion.dt*4);
  if(min>=max)throw Error('The motion interval is too coarse for the requested periods.');
  const periods=Array.from({length:75},(_,i)=>min*(max/min)**(i/74));
  const samplingWarning=min>requested?'The minimum period was raised to four recording intervals. Substeps do not recover unobserved ground-motion frequencies.':min<10*motion.dt?'The shortest periods have fewer than ten original samples per cycle. Interpret short-period results with care.':null;
  return {samplingWarning,intensity:intensity(motion.acceleration,motion.dt,settings.threshold),fft:fourier(motion.acceleration,motion.dt,settings.window,settings.demean,settings.pad),
    spectrogram:spectrogram(motion.acceleration,motion.dt,settings.frame,settings.overlap,settings.window),
    spectra:elasticSpectrum(motion,periods,settings.ratios),
    cases:variants.map(variant=>{
      const run=solve(variant,motion),extra=channelsFor(variant,run);
      return {name:variant.name,run,...extra,sweep:variants.some(v=>v.devices.tmd)?harmonicSweep(buildVariant(variant).model):[]};
    })};
}
export type Study=ReturnType<typeof analyze>;
