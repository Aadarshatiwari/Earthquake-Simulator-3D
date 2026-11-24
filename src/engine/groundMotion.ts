import {finite} from './matrix';
import type {GroundMotion} from './types';

export const G=9.80665;
export const toSI=(value:number,unit:'g'|'m/s²')=>unit==='g'?value*G:value;
export const duration=(motion:GroundMotion)=>(motion.acceleration.length-1)*motion.dt;
export const pga=(motion:GroundMotion)=>motion.acceleration.reduce((peak,value)=>Math.max(peak,Math.abs(value)),0);
export function sampleCount(dt:number,seconds:number,maxSteps=200001){
  finite(dt,'Time step',1e-5,1);
  finite(seconds,'Duration',dt,3600);
  const steps=Math.round(seconds/dt)+1;
  if(steps>maxSteps)throw new Error('Time history exceeds the configured sample limit.');
  return steps;
}
export function waveform(options:{dt:number;seconds:number;frequencyHz:number;amplitude:number;unit:'g'|'m/s²';kind:'sine'|'envelope'|'seeded';seed?:number}):GroundMotion{
  const {dt,seconds,frequencyHz,kind}=options;
  const n=sampleCount(dt,seconds);
  const bandLimitHz=frequencyHz*(kind==='seeded'?2.2:kind==='envelope'?1.72:1);
  finite(frequencyHz,'Frequency',.001,.499/dt/(bandLimitHz/frequencyHz));
  const amplitude=toSI(finite(options.amplitude,'Amplitude',0,1000),options.unit);
  let state=finite(options.seed??17,'Seed',0,0xffffffff)>>>0;
  const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/2**32;};
  const components=Array.from({length:9},(_,i)=>({frequency:frequencyHz*(.45+i*.215),phase:2*Math.PI*random()}));
  const acceleration=Float64Array.from({length:n},(_,i)=>{
    const t=i*dt,p=i/(n-1);
    const main=Math.sin(2*Math.PI*frequencyHz*t);
    if(kind==='sine')return main*amplitude;
    const taper=Math.sin(Math.PI*p)**2;
    return taper*(kind==='seeded'?components.reduce((sum,k)=>sum+Math.sin(2*Math.PI*k.frequency*t+k.phase),0):main+.27*Math.sin(2*Math.PI*frequencyHz*1.72*t));
  });
  if(kind!=='sine'){
    const maximum=pga({dt,acceleration,label:''});
    if(maximum>0)for(let i=0;i<n;i++)acceleration[i]*=amplitude/maximum;
  }
  return {dt,acceleration,label:'Synthetic '+kind,bandLimitHz};
}
export function resample(motion:GroundMotion,dt:number,seconds=duration(motion)):GroundMotion{
  finite(motion.dt,'Source time step',1e-5,1);
  const n=sampleCount(dt,seconds);
  const cutoff=Math.min(1,motion.dt/dt);
  const out=Float64Array.from({length:n},(_,i)=>{
    const x=i*dt/motion.dt;
    if(x>motion.acceleration.length-1+1e-9)return 0;
    if(cutoff>=1){
      const j=Math.min(Math.floor(x),motion.acceleration.length-1);
      return motion.acceleration[j]+(x-j)*((motion.acceleration[j+1]??motion.acceleration[j])-motion.acceleration[j]);
    }
    // Hann-windowed sinc low-pass for downsampling.
    const half=Math.min(192,Math.ceil(10/cutoff));
    let sum=0,weight=0;
    for(let j=Math.max(0,Math.ceil(x-half));j<=Math.min(motion.acceleration.length-1,Math.floor(x+half));j++){
      const d=x-j,k=Math.PI*d*cutoff;
      const w=cutoff*(Math.abs(k)<1e-12?1:Math.sin(k)/k)*(.5+.5*Math.cos(Math.PI*d/half));
      sum+=w*motion.acceleration[j];weight+=w;
    }
    return weight?sum/weight:0;
  });
  return {...motion,dt,acceleration:out,bandLimitHz:motion.bandLimitHz===undefined?undefined:Math.min(motion.bandLimitHz,.5/dt)};
}
export function importCsv(csv:string,label:string,provenance:string):GroundMotion{
  if(!provenance.trim())throw new Error('Enter a station or source reference.');
  if(csv.length>16_000_000)throw new Error('CSV exceeds the size limit.');
  const rows=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const heading=rows.shift()?.trim().toLowerCase();
  if(heading!=='time_s,accel_g'&&heading!=='time_s,accel_m_s2')throw new Error('Expected time_s,accel_g or time_s,accel_m_s2.');
  if(rows.length<2||rows.length>200001)throw new Error('Use 2–200,001 samples.');
  let start=0,dt=0;
  const acceleration=Float64Array.from(rows,(row,i)=>{
    const pieces=row.split(',');
    if(pieces.length!==2||pieces.some(x=>!x.trim()))throw new Error('Invalid CSV row '+(i+2)+'.');
    const [time,value]=pieces.map(Number);
    finite(time,'CSV timestamp');
    finite(value,'CSV acceleration',-1e5,1e5);
    if(i===0)start=time;
    if(i===1)dt=finite(time-start,'CSV time step',1e-5,1);
    if(i>1&&Math.abs(time-start-dt*i)>Math.max(1e-8,dt*.001))throw new Error('CSV timestamps must be uniformly spaced.');
    return toSI(value,heading==='time_s,accel_g'?'g':'m/s²');
  });
  return {dt,acceleration,label:'Imported · '+label,provenance:provenance.trim()};
}
