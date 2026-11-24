import {runSimulation,waveform,type Model} from '../engine';
import {groundDisplacement} from './analysis';
const context=self as unknown as {onmessage:(e:MessageEvent<Model>)=>void;postMessage:(data:unknown,resources?:Transferable[])=>void};
context.onmessage=({data})=>{
  try{
    const motion=waveform({kind:'envelope',dt:.005,seconds:16,frequencyHz:1.45,amplitude:.28,unit:'g'});
    const result=runSimulation(data,motion);
    const drift=groundDisplacement(motion,result.time);
    context.postMessage({result:{...result,groundDisplacement:drift}},[result.packed.buffer,drift.buffer]);
  }catch(error){context.postMessage({error:error instanceof Error?error.message:String(error)});}
};
