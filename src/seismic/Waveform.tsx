import {useEffect,useRef} from 'react';
import type {Output} from './jobs';
export default function Waveform({output,time,seek}:{output:Output;time:number;seek:(t:number)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const element=canvas.current!;
    function draw(){
      const ctx=element.getContext('2d');
      if(!ctx)return;
      const {clientWidth:w,clientHeight:h}=element,ratio=Math.min(devicePixelRatio,2);
      element.width=Math.round(w*ratio);element.height=Math.round(h*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.clearRect(0,0,w,h);
      const r=output.results[0],pga=r.diagnostics.pga||1,n=r.ground.length,duration=r.diagnostics.duration;
      ctx.strokeStyle='#375463';
      for(const y of [h*.12,h*.5,h*.88]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      ctx.lineWidth=1.4;ctx.strokeStyle='#60e5f7';ctx.beginPath();
      const stride=Math.max(1,Math.floor(n/(w*2)));
      for(let i=0;i<n;i+=stride){
        const x=w*i/(n-1),y=h*(.5-.38*r.ground[i]/pga);
        if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
      }
      ctx.stroke();ctx.strokeStyle='#ffb984';ctx.beginPath();ctx.moveTo(w*time/duration,0);ctx.lineTo(w*time/duration,h);ctx.stroke();
    }
    draw();const observer=new ResizeObserver(draw);observer.observe(element);
    return ()=>observer.disconnect();
  },[output,time]);
  return <canvas ref={canvas} className="quake-wave" aria-label="Ground acceleration waveform. Use the timeline slider to seek." onClick={e=>{
    const rect=e.currentTarget.getBoundingClientRect();seek((e.clientX-rect.left)/rect.width*output.results[0].diagnostics.duration);
  }}/>;
}
