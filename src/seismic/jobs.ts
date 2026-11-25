import {runSimulation, type Controls} from '../engine';
import {toModel,type Project} from '../constructor/model';
import type {ConstructorResult} from '../constructor/analysis';
import {groundDisplacement,groundVelocity,makeMotion,type MotionSettings,type Recording} from './motion';
export type Job={buildings:Project[];settings:MotionSettings;recording?:Recording};
export type Output={results:ConstructorResult[];label:string;provenance?:string;hasGroundDisplacement:boolean;groundVelocity:Float64Array|null;dt:number;offsets:number[];elapsedMs:number};
export function solveJob(job:Job,controls:Pick<Controls,'cancelled'|'onProgress'>={}):Output{
  if(job.buildings.length<1||job.buildings.length>2)throw Error('Choose one or two buildings.');
  const started=performance.now();
  const {motion,hasGroundDisplacement}=makeMotion(job.settings,job.recording);
  const results=job.buildings.map((building,i)=>{
    const result=runSimulation(toModel(building.config),motion,{maxSteps:18001,maxOutputBytes:32*1024*1024,onProgress:f=>controls.onProgress?.((f+i)/job.buildings.length),cancelled:controls.cancelled});
    return {...result,groundDisplacement:hasGroundDisplacement?groundDisplacement(motion,result.time):new Float64Array(result.time.length)};
  });
  return {results,label:motion.label,provenance:motion.provenance,hasGroundDisplacement,groundVelocity:hasGroundDisplacement?groundVelocity(motion):null,dt:motion.dt,offsets:job.buildings.map(x=>Number(x.config.isolation)),elapsedMs:performance.now()-started};
}
export type WorkerReply={type:'done';value:Output}|{type:'progress';fraction:number}|{type:'error';message:string};
