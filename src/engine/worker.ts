import {duration,resample,waveform} from './groundMotion';
import {runSimulation} from './newmark';
import type {SimulationJob,WorkerMessage} from './workerProtocol';

const worker=self as unknown as {
  onmessage:(event:MessageEvent<SimulationJob>)=>void;
  postMessage(message:WorkerMessage,transfer?:Transferable[]):void;
};
worker.onmessage=({data})=>{
  try{
    const input=data.input;
    let motion;
    if(input.kind==='recording'){
      const original=input.motion;
      motion=original.dt===input.dt&&Math.abs(duration(original)-input.seconds)<1e-9
        ?original:resample(original,input.dt,input.seconds);
    }else{
      motion=waveform(input.options);
      if(input.zero)motion={...motion,label:'Zero input · free vibration',bandLimitHz:undefined};
    }
    let last=-1;
    const result=runSimulation(data.model,motion,{...data.controls,onProgress:fraction=>{
      if(fraction===1||fraction-last>=.015){last=fraction;worker.postMessage({type:'progress',fraction});}
    }});
    worker.postMessage({type:'result',result,label:motion.label},[result.packed.buffer]);
  }catch(error){
    worker.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
  }
};
