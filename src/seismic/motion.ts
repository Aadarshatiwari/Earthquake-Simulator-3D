import {G,pga,waveform,type GroundMotion} from '../engine';
import {finite} from '../engine/matrix';
import {groundDisplacement} from '../constructor/analysis';

export const forms=['Sinusoid','Multifrequency','Broadband','Impulse','Long duration','Near-fault-inspired','Seeded stochastic','Imported CSV'] as const;
export type MotionSettings={form:typeof forms[number];dt:number;duration:number;pgaG:number;hz:number;bandwidth:number;envelope:'Tapered'|'Flat'|'Decay';seed:number;direction:number};
export type Recording={label:string;provenance:string;dt:number;samples:number[]};
export const defaults:MotionSettings={form:'Broadband',dt:.01,duration:24,pgaG:.28,hz:1.5,bandwidth:1.4,envelope:'Tapered',seed:41,direction:0};
export const scenarios=[
  {name:'Low amplitude',description:'Compare a gentle input with the same spectrum at higher amplitude.',changes:{pgaG:.06}},
  {name:'Moderate amplitude',description:'A broad, tapered pulse for inspecting floor response.',changes:{}},
  {name:'High amplitude',description:'Scale the input to 0.60 g and observe linear response scaling.',changes:{pgaG:.60}},
  {name:'Short period',description:'Higher-frequency motion emphasizes stiffer structures.',changes:{hz:4,bandwidth:.5}},
  {name:'Long period',description:'Lower-frequency shaking can excite flexible structures.',changes:{hz:.45,bandwidth:.6}},
  {name:'Resonance',description:'Tune a sine input to the current building’s first mode.',changes:{form:'Sinusoid',bandwidth:0,envelope:'Flat'}},
  {name:'Soft storey',description:'Compare a reduced first-storey stiffness against a uniform frame.',changes:{}},
  {name:'High damping',description:'Compare the same structure with two damping ratios.',changes:{}},
  {name:'Custom',description:'Choose a waveform and set your own input parameters.',changes:{}},
] satisfies {name:string;description:string;changes:Partial<MotionSettings>}[];

export function validateMotion(s:MotionSettings){
  if(!forms.includes(s.form)||!['Tapered','Flat','Decay'].includes(s.envelope))throw Error('Invalid waveform or envelope.');
  finite(s.direction,'Direction',0,360);
  if(s.form==='Imported CSV')return;
  finite(s.dt,'Time step',.001,.1);finite(s.duration,'Duration',1,120);
  finite(s.pgaG,'Peak ground acceleration',0,2);finite(s.hz,'Dominant frequency',.1,20);
  finite(s.bandwidth,'Frequency spread',0,2);finite(s.seed,'Seed',0,0xffffffff);
  if(!Number.isInteger(s.seed))throw Error('Seed must be an integer.');
  if(Math.round(s.duration/s.dt)+1>12001)throw Error('Use at most 12,001 samples. Increase the time step or shorten the input.');
  if(s.hz*(s.form==='Sinusoid'?1:1+s.bandwidth)>=.49/s.dt)throw Error('Reduce the frequency or time step to remain below the sampling limit.');
}

function integrate(acceleration:Float64Array,dt:number){
  let velocity=0,displacement=0;
  for(let i=1;i<acceleration.length;i++){
    const next=velocity+dt*(acceleration[i-1]+acceleration[i])/2;
    displacement+=dt*(velocity+next)/2;
    velocity=next;
  }
  return [velocity,displacement] as const;
}

/** Remove an affine acceleration trend so trapezoidal integrations end at rest and zero offset. */
export function baselineCorrect(input:Float64Array,dt:number){
  const n=input.length;
  if(n<3||!Number.isFinite(dt)||dt<=0)throw Error('Baseline correction requires three samples and a positive time step.');
  const one=new Float64Array(n).fill(1),ramp=Float64Array.from(one,(_,i)=>i/(n-1));
  const [v,d]=integrate(input,dt),[v0,d0]=integrate(one,dt),[v1,d1]=integrate(ramp,dt);
  const determinant=v0*d1-v1*d0;
  const a=(v*d1-d*v1)/determinant,b=(v0*d-d0*v)/determinant;
  return input.map((x,i)=>x-a-b*ramp[i]);
}
export function makeMotion(s:MotionSettings,recording?:Recording):{motion:GroundMotion;hasGroundDisplacement:boolean}{
  validateMotion(s);
  if(s.form==='Imported CSV'){
    if(!recording||typeof recording.label!=='string'||typeof recording.provenance!=='string'||!recording.provenance.trim()||!Array.isArray(recording.samples)||recording.samples.length<2||recording.samples.length>12001)throw Error('Import a sourced CSV with 2–12,001 samples.');
    finite(recording.dt,'Recorded sample interval',1e-5,1);
    return {motion:{dt:recording.dt,label:recording.label,provenance:recording.provenance,acceleration:Float64Array.from(recording.samples,x=>finite(x,'Recorded acceleration',-1e5,1e5))} satisfies GroundMotion,hasGroundDisplacement:false};
  }
  const duration=s.duration;
  const n=Math.round(duration/s.dt)+1;
  let state=s.seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
  const frequencies=Array.from({length:18},(_,i)=>({hz:s.hz*Math.max(.15,1+s.bandwidth*(i/17-.55)),phase:2*Math.PI*random(),weight:.4+random()*.6}));
  const phase=(hz:number,t:number)=>2*Math.PI*hz*t;
  const sine=s.form==='Sinusoid'?waveform({kind:'sine',dt:s.dt,seconds:s.duration,frequencyHz:s.hz,amplitude:1,unit:'m/s²'}).acceleration:null;
  const raw=Float64Array.from({length:n},(_,i)=>{
    const t=i*s.dt,p=i/(n-1);
    const env=s.envelope==='Flat'?1:s.envelope==='Decay'?Math.sin(Math.PI*p)**2*Math.exp(-3*p):Math.sin(Math.PI*p)**2;
    const x=(t-duration*.35)*s.hz;
    switch(s.form){
      case 'Sinusoid':return env*sine![i];
      case 'Multifrequency':return env*(Math.sin(phase(s.hz,t))+.44*Math.sin(phase(s.hz*(1+s.bandwidth*.55),t))+.27*Math.sin(phase(s.hz*(1-s.bandwidth*.35),t)));
      case 'Impulse':return env*(1-2*x*x)*Math.exp(-x*x);
      case 'Near-fault-inspired':return env*x*Math.exp(-.5*x*x)*Math.cos(2.4*x);
      case 'Long duration':return env*(.65+.35*Math.sin(phase(.22,t)))*Math.sin(phase(s.hz,t));
      case 'Broadband':return env*frequencies.reduce((sum,f,i)=>sum+Math.cos(phase(f.hz,t)+f.phase)*Math.sin((i+1)*.77),0);
      default:return env*frequencies.reduce((sum,f)=>sum+f.weight*Math.sin(phase(f.hz,t)+f.phase),0);
    }
  });
  const hasGroundDisplacement=s.form!=='Sinusoid'||s.envelope!=='Flat';
  const corrected=hasGroundDisplacement?baselineCorrect(raw,s.dt):raw;
  const max=corrected.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0);
  const acceleration=max?corrected.map(x=>x/max*s.pgaG*G):corrected;
  const motion={dt:s.dt,label:'Synthetic · '+s.form,acceleration,bandLimitHz:s.hz*(s.form==='Sinusoid'?1:1+s.bandwidth)};
  return {motion,hasGroundDisplacement};
}
export {G,pga,groundDisplacement};

export function groundVelocity(motion:GroundMotion){
  let integrated=0;
  return motion.acceleration.map((value,i)=>{
    if(i)integrated+=(value+motion.acceleration[i-1])*motion.dt/2;
    return integrated;
  });
}
