import {archiveAsset,type RecordingMeta} from './catalog';
import type {Trace} from './waveform';

export async function loadTrace(meta:RecordingMeta,signal:AbortSignal):Promise<Trace>{
  const response=await fetch(archiveAsset(meta.asset),{signal});
  if(!response.ok)throw Error('Recording asset is unavailable.');
  const buffer=await response.arrayBuffer();
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./recordWorker.ts',import.meta.url),{type:'module'});
    const finish=()=>{
      signal.removeEventListener('abort',abort);
      worker.terminate();
    };
    const abort=()=>{finish();reject(signal.reason);};
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data}:{data:{trace?:Trace;error?:string}})=>{
      finish();
      if(data.trace)resolve(data.trace);
      else reject(Error(data.error??'Invalid recording.'));
    };
    worker.onerror=()=>{finish();reject(Error('Recording parser could not finish.'));};
    worker.postMessage({buffer,meta},[buffer]);
  });
}
