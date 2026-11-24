import type {ConstructorResult} from '../constructor/analysis';
export type Clock={status:'ready'|'playing'|'paused'|'stopped'|'ended';time:number};
export type ClockAction={type:'play'|'pause'|'stop'|'restart'}|{type:'seek';time:number}|{type:'tick';seconds:number;speed:number;loop:boolean};
export const ready:Clock={status:'ready',time:0};
export function transition(clock:Clock,action:ClockAction,duration:number):Clock{
  switch(action.type){
    case 'play':return {status:'playing',time:clock.time>=duration?0:clock.time};
    case 'pause':return {status:'paused',time:clock.time};
    case 'stop':return {status:'stopped',time:0};
    case 'restart':return {status:'playing',time:0};
    case 'seek':return {status:'paused',time:Math.max(0,Math.min(duration,action.time))};
    case 'tick':{
      if(clock.status!=='playing')return clock;
      const next=clock.time+action.seconds*action.speed;
      if(next<duration)return {...clock,time:next};
      return action.loop&&duration>0?{status:'playing',time:next%duration}:{status:'ended',time:duration};
    }
  }
}
export type Heat='None'|'Displacement'|'Acceleration'|'Drift'|'Restoring force'|'Modal displacement';
export const heatChoices=['None','Displacement','Acceleration','Drift','Restoring force','Modal displacement'] as const;
export const heatUnits:Record<Heat,string>={None:'',Displacement:'m',Acceleration:'m/s²',Drift:'%', 'Restoring force':'N','Modal displacement':'normalized'};
export const channels={Displacement:'displacement',Acceleration:'absoluteAcceleration',Drift:'drift','Restoring force':'restoringForce'} as const;
export const heatStops=['#208bdf','#31e2ee','#5ed994','#f8e254','#fb994f','#ff535c'];
export function heatMagnitude(heat:Exclude<Heat,'None'|'Modal displacement'>,sample:number){return Math.abs(sample)*(heat==='Drift'?100:1);}
export function peakAt(result:ConstructorResult,channel:'roof'|'drift',offset=0){
  const n=result.structure.mass.length;
  let best=0,index=0;
  for(let i=0;i<result.time.length;i++){
    const value=channel==='roof'?Math.abs(result.traces.displacement[i*n+n-1]):Math.max(...result.traces.drift.subarray(i*n+offset,(i+1)*n).map(Math.abs));
    if(value>best){best=value;index=i;}
  }
  return {time:result.time[index],value:best};
}
export function scaleFor(results:ConstructorResult[],heat:Heat){
  if(heat==='None'||heat==='Modal displacement')return 1;
  let maximum=0;
  for(const r of results)for(const value of r.traces[channels[heat]])maximum=Math.max(maximum,heatMagnitude(heat,value));
  return maximum||1;
}
export function storeyTransform(previous:number,next:number,height:number,scale:number){
  return {shift:previous*scale,slope:(next-previous)*scale/height};
}
