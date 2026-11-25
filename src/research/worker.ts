import {analyze,compareInputs,refine,scan,sensitivity,type Axis,type Objective,type Settings,type Study} from './compute';
import {manifest,researchRows} from './export';
import type {GroundMotion} from '../engine';
import type {Variant} from '../protection/model';
export type Payload={motion:GroundMotion;variants:Variant[];settings:Settings};
export type Request=Payload&({job:'study'}|{job:'batch';motions:GroundMotion[]}|{job:'sweep';x:Axis;y:Axis|null;metric:Objective}|{job:'sensitivity';metric:Objective}|{job:'convergence'}|{job:'csv';stride:number}|{job:'json';stride:number});
export type Reply={job:'batch';value:ReturnType<typeof compareInputs>}|{job:'study';value:Study;ms:number}|{job:'sweep';value:ReturnType<typeof scan>}|{job:'sensitivity';value:ReturnType<typeof sensitivity>}|{job:'convergence';value:ReturnType<typeof refine>}|{job:'csv'|'json';value:Blob;metadata:string;ms:number}|{job:'error';value:string};
const host=self as unknown as {onmessage:(ev:MessageEvent<Request>)=>void;postMessage:(r:Reply,t?:Transferable[])=>void};
host.onmessage=({data})=>{
  try{
    const start=performance.now(),{motion,variants,settings}=data;
    if(data.job==='batch'){host.postMessage({job:'batch',value:compareInputs(data.motions,variants)});return;}
    if(data.job==='sweep'){host.postMessage({job:'sweep',value:scan(variants[0],motion,data.x,data.y,data.metric)});return;}
    if(data.job==='sensitivity'){host.postMessage({job:'sensitivity',value:sensitivity(variants[0],motion,data.metric)});return;}
    if(data.job==='convergence'){host.postMessage({job:'convergence',value:refine(variants[0],motion)});return;}
    const value=analyze(motion,variants,settings);
    if(data.job==='csv'||data.job==='json'){
      const metadata=JSON.stringify(manifest(motion,variants,value,data.stride),null,2);
      const chunks:string[]=[];
      let current='',size=0,first=true;
      if(data.job==='json')chunks.push('{"metadata":'+metadata+',"rows":[');
      for(const line of researchRows(value,data.stride)){
        if(data.job==='json'&&line.startsWith('case,'))continue;
        const row=data.job==='json'?(first?'':',')+JSON.stringify(line.trim().split(',').map(x=>x===''?null:Number.isFinite(Number(x))?Number(x):x)):line;
        first=false;current+=row;size+=row.length;
        if(size>150_000_000)throw Error('Export exceeds 150 MB. Reduce cases or use lightweight mode.');
        if(current.length>=65536){chunks.push(current);current='';}
      }
      chunks.push(current,data.job==='json'?']}':'');
      host.postMessage({job:data.job,value:new Blob(chunks,{type:data.job==='csv'?'text/csv':'application/json'}),metadata,ms:performance.now()-start});return;
    }
    const buffers=new Set<ArrayBuffer>();
    function transfer(input:unknown){
      if(ArrayBuffer.isView(input))buffers.add(input.buffer as ArrayBuffer);
      else if(input&&typeof input==='object')Object.values(input).forEach(transfer);
    }
    transfer(value);
    host.postMessage({job:'study',value,ms:performance.now()-start},[...buffers]);
  }catch(e){host.postMessage({job:'error',value:e instanceof Error?e.message:String(e)});}
};
