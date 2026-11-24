import type {EngineeringResult,GroundMotion} from '../engine';
export type ConstructorResult=EngineeringResult&{groundDisplacement:Float64Array};
export function groundDisplacement(motion:GroundMotion,times:Float64Array){
  const out=new Float64Array(times.length);
  let velocity=0,position=0,output=1;
  for(let i=1;i<motion.acceleration.length&&output<times.length;i++){
    const next=velocity+(motion.acceleration[i-1]+motion.acceleration[i])*motion.dt/2;
    position+=(velocity+next)*motion.dt/2;
    velocity=next;
    if(i===Math.round(times[output]/motion.dt))out[output++]=position;
  }
  return out;
}
