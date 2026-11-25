import {parseArrayRecord} from './waveform';
import type {RecordingMeta} from './catalog';
const worker=self as unknown as {onmessage:(evt:MessageEvent<{buffer:ArrayBuffer;meta:RecordingMeta}>)=>void;postMessage:(data:unknown,transfer?:Transferable[])=>void};
worker.onmessage=async({data})=>{
  try{
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data.buffer)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==data.meta.sha256)throw Error('Recording checksum verification failed.');
    const trace=parseArrayRecord(new TextDecoder().decode(data.buffer),data.meta);
    worker.postMessage({trace},Object.values(trace.components).map(signal=>signal.buffer as ArrayBuffer));
  }catch(error){worker.postMessage({error:error instanceof Error?error.message:String(error)});}
};
