import {solveJob,type Job,type WorkerReply} from './jobs';
const context=self as unknown as {onmessage:(message:MessageEvent<Job>)=>void;postMessage:(reply:WorkerReply,transfer?:Transferable[])=>void};
context.onmessage=({data})=>{
  try{
    let last=-1;
    const value=solveJob(data,{onProgress:fraction=>{
      if(fraction-last>=.02||fraction===1){last=fraction;context.postMessage({type:'progress',fraction});}
    }});
    const transfer:Transferable[]=value.results.flatMap(result=>[result.packed.buffer,result.groundDisplacement.buffer]);
    if(value.groundVelocity)transfer.push(value.groundVelocity.buffer);
    context.postMessage({type:'done',value},transfer);
  }catch(error){context.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
};
