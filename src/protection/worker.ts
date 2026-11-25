import {solveProtection,type Experiment,type LabResult} from './analysis';
export type Reply={type:'progress';value:number}|{type:'result';result:LabResult}|{type:'error';message:string};
const host=self as unknown as {onmessage:(event:MessageEvent<Experiment>)=>void;postMessage:(reply:Reply,transfer?:Transferable[])=>void};
host.onmessage=({data})=>{
  try{
    const result=solveProtection(data,{onProgress:value=>host.postMessage({type:'progress',value})});
    const transfer=result.comparison.flatMap(item=>[
      item.time,item.ground,item.displacements,item.drifts,item.accelerations,item.shear,item.parent,item.M,item.C,item.K,...Object.values(item.energy),
    ].map(value=>value.buffer as ArrayBuffer));
    host.postMessage({type:'result',result},transfer);
  }catch(error){
    host.postMessage({type:'error',message:error instanceof Error?error.message:'Calculation failed.'});
  }
};
