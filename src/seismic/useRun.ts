import {useEffect,useRef,useState} from 'react';
import {ready,transition,type ClockAction} from './controller';
import type {Job,Output,WorkerReply} from './jobs';
import {WorkerSlot} from './workerSlot';
import {Rumble} from './audio';
import {floorDisplacement} from '../constructor/geometry';

export function useRun(active:boolean,speed:number,loop:boolean,volume:number,haptics:boolean){
  const [output,setOutput]=useState<Output|null>(null);
  const [progress,setProgress]=useState<number|null>(null);
  const [notice,setNotice]=useState('Ready to calculate a ground-motion scenario.');
  const [state,setState]=useState(ready);
  const [sound,setSound]=useState(false);
  const clock=useRef(ready),time=useRef(0),worker=useRef(new WorkerSlot<Worker>()),audio=useRef<Rumble|null>(null);
  const duration=output?.results[0].diagnostics.duration??0;
  function publish(next:typeof ready){
    clock.current=next;time.current=next.time;setState(next);
  }
  function send(action:ClockAction){
    if(!output)return;
    publish(transition(clock.current,action,duration));
    if((action.type==='play'||action.type==='restart'||action.type==='stop')&&haptics&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(action.type==='stop'?12:18);
    if(action.type!=='play'&&action.type!=='restart')audio.current?.set(volume,0);
  }
  function toggleSound(){
    if(audio.current){audio.current.dispose();audio.current=null;setSound(false);return;}
    try{audio.current=new Rumble(volume);setSound(true);}
    catch{setNotice('Procedural sound is unavailable in this browser.');}
  }
  function terminate(){
    worker.current.close();setProgress(null);
  }
  function restore(value:Output|null){
    terminate();audio.current?.set(volume,0);setOutput(value);publish(ready);
  }
  function cancel(){terminate();setNotice('Calculation cancelled.');}
  function start(job:Job){
    restore(null);
    try{
      const instance=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      worker.current.take(instance);setProgress(0);setNotice('Calculating structural response…');
      instance.onmessage=({data}:{data:WorkerReply})=>{
        if(!worker.current.owns(instance))return;
        if(data.type==='progress'){setProgress(data.fraction);return;}
        terminate();
        if(data.type==='error'){setNotice(data.message);return;}
        setOutput(data.value);publish(ready);setNotice('Calculation complete. Start playback when ready.');
      };
      instance.onerror=()=>{if(worker.current.owns(instance)){terminate();setNotice('The simulation worker could not finish.');}};
      instance.postMessage(job);
    }catch(e){terminate();setNotice(e instanceof Error?e.message:String(e));}
  }
  useEffect(()=>{
    const suspend=()=>{
      if(!active||document.hidden){
        if(clock.current.status==='playing')publish(transition(clock.current,{type:'pause'},duration));
        audio.current?.set(0,0);
      }
    };
    suspend();document.addEventListener('visibilitychange',suspend);
    return ()=>document.removeEventListener('visibilitychange',suspend);
  },[active,duration]);
  useEffect(()=>{
    if(!active||!output||state.status!=='playing')return;
    let frame=0,last=performance.now(),paint=last;
    const tick=(now:number)=>{
      const next=transition(clock.current,{type:'tick',seconds:Math.min(.1,(now-last)/1000),speed,loop},duration);
      last=now;
      clock.current=next;time.current=next.time;
      if(now-paint>=72||next.status!=='playing'){
        setState(next);paint=now;
        const r=output.results[0];
        audio.current?.set(volume,next.status==='playing'?floorDisplacement(r.ground,r.time,1,0,next.time):0);
      }
      if(next.status==='playing')frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(frame);audio.current?.set(0,0);};
  },[active,output,state.status,speed,loop,duration,volume]);
  useEffect(()=>()=>{worker.current.close();audio.current?.dispose();},[]);
  return {output,progress,notice,setNotice,state,time,duration,start,cancel,send,restore,sound,toggleSound};
}
