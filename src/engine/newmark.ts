import {assembleModel} from './structure';
import {cholesky,dot,finite,multiply} from './matrix';
import {pga} from './groundMotion';
import type {Controls,GroundMotion,Model} from './types';

export class SimulationCancelled extends Error {
  constructor(){super('Simulation cancelled.');this.name='SimulationCancelled';}
}
export const channels=['displacement','velocity','relativeAcceleration','absoluteAcceleration','interstoreyDisplacement','drift','restoringForce'] as const;

/** Fixed-step Newmark average acceleration. Traces are sample-major, then DOF. */
export function runSimulation(model:Model,motion:GroundMotion,controls:Controls={}){
  const started=performance.now();
  const {dt,acceleration:input}=motion;
  finite(dt,'Time step',1e-5,1);
  const steps=input.length;
  const maxSteps=finite(controls.maxSteps??200001,'Step limit',2,500001);
  if(steps<2||steps>maxSteps)throw new Error('Ground-motion sample count exceeds supported simulation limits.');
  if(input.some(x=>!Number.isFinite(x)||Math.abs(x)>1e5))throw new Error('Ground acceleration contains an invalid sample.');
  const stride=finite(controls.stride??1,'Output stride',1,steps);
  if(!Number.isInteger(stride))throw new Error('Output stride must be an integer.');
  if(controls.cancelled?.())throw new SimulationCancelled();
  const structure=assembleModel(model);
  const {mass,K,C,influence,springs,height,modes}=structure,n=mass.length;
  const count=Math.ceil((steps-1)/stride)+1;
  const bytes=count*(n*channels.length+8)*8;
  if(bytes>finite(controls.maxOutputBytes??32*1024*1024,'Output memory limit',128,128*1024*1024)){
    throw new Error('Output exceeds the memory budget. Increase the output stride or shorten the motion.');
  }
  let packed:Float64Array;
  try{packed=new Float64Array(bytes/8);}catch{throw new Error('Could not allocate result storage. Increase output stride or shorten the run.');}
  const traces=Object.fromEntries(channels.map((key,i)=>[key,packed.subarray(i*n*count,(i+1)*n*count)])) as Record<typeof channels[number],Float64Array>;
  const scalars=packed.subarray(channels.length*n*count);
  const scalar=(i:number)=>scalars.subarray(i*count,(i+1)*count);
  const [time,ground,baseShear,kinetic,strain,dissipation,work,residual]=Array.from({length:8},(_,i)=>scalar(i));
  const peak={roofDisplacement:0,displacement:0,velocity:0,absoluteAcceleration:0,drift:0,baseShear:0,energyResidual:0};
  const warnings:string[]=[];
  const important=modes.filter(m=>m.effectiveMassRatio>=.02);
  const highest=Math.max(modes[0].hz,...important.map(m=>m.hz));
  const resolved=Math.max(highest,motion.bandLimitHz??0);
  if(dt*resolved>.05)warnings.push('Fewer than 20 integration steps per period at an important frequency. Reduce Δt and compare the results.');
  if(stride*dt*resolved>.1)warnings.push('Stored outputs may miss oscillations between samples. Peaks use every integration step.');
  if(motion.bandLimitHz!==undefined&&dt*motion.bandLimitHz>=.5)warnings.push('Ground-motion frequency reaches or exceeds Nyquist.');
  const solve=cholesky(K.map((k,i)=>dt*dt*k/4+dt*C[i]/2+(i%(n+1)===0?mass[i/(n+1)]:0)),n);
  const u=structure.initialDisplacement.slice(),v=structure.initialVelocity.slice();
  const [a,up,vp,ku,cv,rhs,amid,delta]=Array.from({length:8},()=>new Float64Array(n));
  multiply(K,u,ku);
  multiply(C,v,cv);
  const generalizedMass=mass.map((m,i)=>m*influence[i]);
  for(let i=0;i<n;i++)a[i]=(-generalizedMass[i]*input[0]-ku[i]-cv[i])/mass[i];
  let initialEnergy=0,damped=0,external=0,output=0;
  for(let step=0;step<steps;step++){
    if(step%128===0){
      if(controls.cancelled?.())throw new SimulationCancelled();
      controls.onProgress?.(step/(steps-1));
    }
    const ag=input[step];
    if(step){
      for(let i=0;i<n;i++){
        up[i]=u[i]+dt*v[i]+dt*dt*a[i]/4;
        vp[i]=v[i]+dt*a[i]/2;
      }
      multiply(K,up,ku);
      multiply(C,vp,cv);
      for(let i=0;i<n;i++)rhs[i]=-generalizedMass[i]*ag-ku[i]-cv[i];
      solve(rhs,a);
      for(let i=0;i<n;i++){
        const nextV=vp[i]+dt*a[i]/2;
        amid[i]=(nextV+v[i])/2;
        delta[i]=amid[i]*dt;
        u[i]=up[i]+dt*dt*a[i]/4;
        v[i]=nextV;
      }
      multiply(C,amid,cv);
      damped+=dt*dot(amid,cv);
      external-=(input[step-1]+ag)/2*dot(generalizedMass,delta);
    }
    const save=step%stride===0||step===steps-1;
    let ke=0,se=0,shear=0;
    for(let i=0;i<n;i++){
      const absolute=a[i]+influence[i]*ag;
      const relativeStorey=u[i]-(i?u[i-1]:0),drift=relativeStorey/height[i];
      const force=springs[i]*relativeStorey;
      ke+=.5*mass[i]*v[i]**2;
      se+=.5*force*relativeStorey;
      shear-=mass[i]*absolute;
      peak.displacement=Math.max(peak.displacement,Math.abs(u[i]));
      peak.velocity=Math.max(peak.velocity,Math.abs(v[i]));
      peak.absoluteAcceleration=Math.max(peak.absoluteAcceleration,Math.abs(absolute));
      peak.drift=Math.max(peak.drift,Math.abs(drift));
      if(save){
        const j=output*n+i;
        traces.displacement[j]=u[i];traces.velocity[j]=v[i];
        traces.relativeAcceleration[j]=a[i];traces.absoluteAcceleration[j]=absolute;
        traces.interstoreyDisplacement[j]=relativeStorey;traces.drift[j]=drift;traces.restoringForce[j]=force;
      }
    }
    if(step===0)initialEnergy=ke+se;
    const balance=ke+se+damped-external-initialEnergy;
    if(!Number.isFinite(ke+se+damped+Math.abs(external)+Math.abs(shear)))throw new Error('Nonfinite response near t = '+(step*dt).toPrecision(5)+' s. Check the inputs and reduce Δt.');
    peak.energyResidual=Math.max(peak.energyResidual,Math.abs(balance));
    peak.baseShear=Math.max(peak.baseShear,Math.abs(shear));
    peak.roofDisplacement=Math.max(peak.roofDisplacement,Math.abs(u[n-1]));
    if(save){
      time[output]=step*dt;ground[output]=ag;baseShear[output]=shear;
      kinetic[output]=ke;strain[output]=se;dissipation[output]=damped;work[output]=external;residual[output]=balance;
      output++;
    }
  }
  if(controls.cancelled?.())throw new SimulationCancelled();
  controls.onProgress?.(1);
  return {structure,packed,traces,time,ground,baseShear,energy:{kinetic,strain,dissipation,work,residual,initialEnergy},peak,warnings,
    diagnostics:{steps,outputSamples:count,bytes,duration:(steps-1)*dt,importantFrequencyHz:highest,pga:pga(motion),elapsedMs:performance.now()-started}};
}
export type EngineeringResult=ReturnType<typeof runSimulation>;
