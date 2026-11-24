import {G} from './engine/groundMotion';
import {chain} from './engine/matrix';
import {modal as solveModes} from './engine/modal';
import {runSimulation} from './engine/newmark';
import type {Damping,Storey} from './engine/types';
export {G};
export type System = 'Ordinary frame' | 'Cross-bracing' | 'Shear walls' | 'Base isolation' | 'Supplemental damping';
export type Building = { floors:number; height:number; width:number; length:number; column:number; beam:number; mass:number; stiffness:number; damping:number; material:string; foundation:string; soil:string; system:System };
export type Motion = { dt:number; acceleration:number[]; label:string; source?:string };
const vector = (n:number) => Array<number>(n).fill(0);
export function assemble(building:Building) {
  const isolated=building.system==='Base isolation';
  const n=building.floors+Number(isolated);
  const mass=vector(n).fill(building.mass*1000);
  const systemFactor=building.system==='Cross-bracing'?1.65:building.system==='Shear walls'?2.2:1;
  const springs=vector(n).fill(building.stiffness*1e6*systemFactor);
  if(isolated) springs[0]*=.045;
  if(building.foundation==='Flexible') springs[0]*=.72;
  const packed=chain(Float64Array.from(springs));
  const K=Array.from({length:n},(_,i)=>Array.from(packed.subarray(i*n,(i+1)*n)));
  return {mass,springs,K,isolated};
}

export function modes(K:number[][],mass:number[]) {
  return solveModes(Float64Array.from(K.flat()),Float64Array.from(mass),new Float64Array(mass.length).fill(1)).map(legacyMode);
}
function legacyMode({omega,hz,shape}:ReturnType<typeof solveModes>[number]){
  const peak=Math.max(...shape.map(Math.abs));
  return {omega,hz,shape:Array.from(shape,x=>x/peak)};
}

export type Sample = {t:number; displacement:number[]; velocity:number[]; acceleration:number[]; drift:number[]; shear:number; isolation:number};
export function simulate(building:Building, motion:Motion, initialDisplacement?:number[]) {
  const {mass,isolated,springs}=assemble(building);
  const n=mass.length;
  const offset=Number(isolated);
  const ratio=(building.damping+(building.system==='Supplemental damping'?12:0))/100;
  const damping:Damping=n===1?{kind:'viscous',ratio}:{kind:'rayleigh',first:{mode:0,ratio},second:{mode:Math.min(2,n-1),ratio}};
  const soil=building.soil==='Soft'?1.35:building.soil==='Dense'?1.12:1;
  const levels=mass.map((massKg,i):Storey=>({massKg,heightM:building.height,stiffnessNPerM:springs[i],initialDisplacementM:initialDisplacement?.[i]}));
  const result=runSimulation({storeys:levels.slice(offset),damping,foundation:isolated?{kind:'isolation',bearing:levels[0]}:undefined},
    {dt:motion.dt,label:motion.label,acceleration:Float64Array.from(motion.acceleration,x=>x*soil)},{maxOutputBytes:64*1024*1024});
  const peaks={displacement:0,acceleration:0,drift:0,shear:result.peak.baseShear};
  const samples=Array.from(result.time,(t,index):Sample=>{
    const read=(channel:keyof typeof result.traces)=>Array.from(result.traces[channel].subarray(index*n+offset,(index+1)*n));
    const displacement=read('displacement'),acceleration=read('absoluteAcceleration'),drift=read('drift');
    peaks.displacement=Math.max(peaks.displacement,...displacement.map(Math.abs));
    peaks.acceleration=Math.max(peaks.acceleration,...acceleration.map(Math.abs));
    peaks.drift=Math.max(peaks.drift,...drift.map(Math.abs));
    return {t,displacement,acceleration,drift,velocity:read('velocity'),shear:result.baseShear[index],isolation:isolated?result.traces.displacement[index*n]:0};
  });
  return {samples,modal:result.structure.modes.map(legacyMode),peaks,soil,springs};
}
export type Result = ReturnType<typeof simulate>;

export function synthetic(pga:number, frequency:number, duration:number):Motion {
  const dt=.01;
  const raw=Array.from({length:Math.round(duration/dt)+1},(_,i)=>{
    const t=i*dt, fraction=t/duration;
    return Math.sin(Math.PI*fraction)**2*(Math.sin(2*Math.PI*frequency*t)+.27*Math.sin(2*Math.PI*frequency*1.72*t));
  });
  const peak=Math.max(...raw.map(Math.abs));
  return {dt,label:'Synthetic · tapered two-frequency pulse',acceleration:raw.map(v=>v/peak*pga*G)};
}
export function parseMotion(csv:string,label:string,source:string):Motion {
  if(!source.trim())throw Error('Enter the recording source or station metadata.');
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const header=lines.shift()?.trim().toLowerCase();
  if(header!=='time_s,accel_m_s2'&&header!=='time_s,accel_g')throw Error('Use time_s,accel_m_s2 or time_s,accel_g as the CSV header.');
  if(lines.length<2||lines.length>30001)throw Error('Import 2 to 30,001 samples.');
  const rows=lines.map(line=>line.split(',').map(value=>value.trim()===''?NaN:Number(value)));
  if(rows.some(row=>row.length!==2||row.some(v=>!Number.isFinite(v))))throw Error('Each data row must contain two finite numbers.');
  const dt=rows[1][0]-rows[0][0];
  if(dt<.001||dt>.2||rows.some((row,i)=>i>0&&Math.abs(row[0]-rows[0][0]-i*dt)>Math.max(1e-6,dt*.001)))throw Error('Use a uniform sample interval between 0.001 and 0.2 seconds.');
  return {dt,label:'Imported · '+label,source:source.trim(),acceleration:rows.map(row=>row[1]*(header==='time_s,accel_g'?G:1))};
}

/** Pseudo-spectral acceleration in g for unit-mass linear oscillators. */
export function responseSpectrum(motion:Motion, damping=.05, amplification=1) {
  const dt=motion.dt;
  const shortest=Math.max(.05,dt*12);
  const longest=Math.max(5,shortest*2);
  return Array.from({length:54},(_,i)=>{
    const period=shortest*(longest/shortest)**(i/53);
    const omega=2*Math.PI/period;
    const k=omega*omega,c=2*damping*omega;
    const effective=1+dt*c/2+dt*dt*k/4;
    let u=0,v=0,a=-amplification*motion.acceleration[0],peak=0;
    for(let j=1;j<motion.acceleration.length;j++){
      const up=u+dt*v+dt*dt/4*a,vp=v+dt/2*a;
      a=(-amplification*motion.acceleration[j]-k*up-c*vp)/effective;
      u=up+dt*dt/4*a;v=vp+dt/2*a;
      peak=Math.max(peak,Math.abs(u));
    }
    return {period,pseudoAcceleration:peak*k/G};
  });
}
