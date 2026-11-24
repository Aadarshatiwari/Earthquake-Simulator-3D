import type {waveform} from './groundMotion';
import type {EngineeringResult} from './newmark';
import type {Controls,GroundMotion,Model} from './types';
export interface SimulationJob {
  model:Model;
  input:
    | {kind:'recording';motion:GroundMotion;dt:number;seconds:number}
    | {kind:'synthetic';options:Parameters<typeof waveform>[0];zero:boolean};
  controls:Pick<Controls,'stride'|'maxSteps'|'maxOutputBytes'>;
}
export type WorkerMessage=
  | {type:'progress';fraction:number}
  | {type:'result';result:EngineeringResult;label:string}
  | {type:'error';message:string};
