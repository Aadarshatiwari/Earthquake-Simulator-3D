import {useEffect,useMemo,useRef,useState} from 'react';
import Plotly from 'plotly.js-dist-min';
import type {Output} from './jobs';
import {resonanceCurve} from './resonance';
import type {Model} from '../engine';
const plotChoices=['Ground acceleration','Floor displacement','Floor velocity','Absolute acceleration','Interstorey drift','Restoring force','Base shear','Energy response'] as const;
type PlotNode=HTMLDivElement&{on?:(event:string,handler:(event:{points?:{x?:number}[]})=>void)=>void;removeListener?:(event:string,handler:unknown)=>void};
const colors=['#60e6f8','#ffb883','#b9a4ff','#69dbad'];
export type Series={name:string;x:number[];y:(number|null)[]};
type Layout={xLabel:string;yLabel:string;series:Series[];cursor?:number;seek?:(value:number)=>void};
const plotly=Plotly as typeof Plotly&{relayout(node:HTMLElement,layout:object):Promise<unknown>};
function Plot({series,xLabel,yLabel,cursor,seek}:Layout){
  const node=useRef<PlotNode>(null);
  const latest=useRef(cursor);
  const select=useRef(seek);
  const ready=useRef(false);
  const [error,setError]=useState('');
  latest.current=cursor;select.current=seek;
  useEffect(()=>{
    const target=node.current;
    if(!target)return;
    let cancelled=false;
    ready.current=false;
    const shape=(x:number)=>({type:'line',x0:x,x1:x,y0:0,y1:1,yref:'paper',line:{color:'#d6edf0',width:1,dash:'dot'}});
    const click=(event:{points?:{x?:number}[]})=>{
      const time=event.points?.[0]?.x;if(typeof time==='number')select.current?.(time);
    };
    void Plotly.react(target,series.map((s,i)=>({type:'scatter',mode:'lines',name:s.name,x:s.x,y:s.y,line:{color:colors[i%colors.length],width:2}})),{
      autosize:true,showlegend:series.length>1,paper_bgcolor:'transparent',plot_bgcolor:'transparent',
      margin:{l:64,r:20,t:26,b:59},font:{color:'#c5dae5'},xaxis:{title:{text:xLabel},gridcolor:'#28414f'},yaxis:{title:{text:yLabel},gridcolor:'#28414f'},
      legend:{orientation:'h',y:1.10},hovermode:'x unified',uirevision:xLabel+yLabel,shapes:latest.current===undefined?[]:[shape(latest.current)],
    },{responsive:true,displaylogo:false}).then(()=>{
      if(cancelled)return;
      ready.current=true;target.on?.('plotly_click',click);
      if(latest.current!==undefined)void plotly.relayout(target,{shapes:[shape(latest.current)]}).catch(()=>{});
    }).catch(()=>{if(!cancelled)setError('The chart could not be rendered.');});
    const observer=new ResizeObserver(()=>{
      if(ready.current&&target.clientWidth)void Plotly.Plots.resize(target).catch(()=>{});
    });
    observer.observe(target);
    return ()=>{cancelled=true;ready.current=false;observer.disconnect();target.removeListener?.('plotly_click',click);};
  },[series,xLabel,yLabel]);
  useEffect(()=>{
    if(ready.current&&node.current&&cursor!==undefined)void plotly.relayout(node.current,{'shapes[0].x0':cursor,'shapes[0].x1':cursor}).catch(()=>{});
  },[cursor]);
  useEffect(()=>{const target=node.current;return ()=>{if(target)Plotly.purge(target);};},[]);
  return <>{error&&<p role="alert">{error}</p>}<div className="quake-plot" ref={node}/></>;
}
export function ResultsChart({output,floor,time,seek}:{output:Output;floor:number;time:number;seek:(v:number)=>void}){
  const [choice,setChoice]=useState<typeof plotChoices[number]>('Ground acceleration');
  const series=useMemo(()=>{
    const a=output.results[0];
    const every=Math.max(1,Math.ceil(a.time.length/3500));
    const indices=Array.from(a.time.keys()).filter(i=>i%every===0||i===a.time.length-1);
    const x=indices.map(i=>a.time[i]);
    if(choice==='Ground acceleration')return [{name:'Input acceleration',x,y:indices.map(i=>a.ground[i])}];
    if(choice==='Energy response'&&output.results.length===1)return (['kinetic','strain','dissipation','work'] as const).map(name=>({name,x,y:indices.map(i=>a.energy[name][i])}));
    return output.results.map((r,i)=>{
      const n=r.structure.mass.length;
      const offset=output.offsets[i];
      const level=Math.min(floor+offset,n-1);
      const name='Building '+(i===0?'A':'B')+(['Base shear','Energy response'].includes(choice)?'':' · storey '+(level-offset+1));
      const value=(j:number)=>{
        switch(choice){
          case 'Floor displacement':return r.traces.displacement[j*n+level];
          case 'Floor velocity':return r.traces.velocity[j*n+level];
          case 'Absolute acceleration':return r.traces.absoluteAcceleration[j*n+level];
          case 'Interstorey drift':return r.traces.drift[j*n+level]*100;
          case 'Restoring force':return r.traces.restoringForce[j*n+level]/1000;
          case 'Base shear':return r.baseShear[j]/1000;
          default:return r.energy.dissipation[j];
        }
      };
      return {name,x,y:indices.map(value)};
    });
  },[output,choice,floor]);
  const unit=['m/s²','m','m/s','m/s²','%','kN','kN','J'][plotChoices.indexOf(choice)];
  return <section className="quake-card"><div className="quake-card-row"><h2>Response histories</h2><label>Chart<select value={choice} onChange={e=>setChoice(e.target.value as typeof choice)}>{plotChoices.map(v=><option key={v}>{v}</option>)}</select></label></div>
    {choice==='Energy response'&&output.results.length>1&&<p className="quake-sub">Cumulative damping dissipation for each model.</p>}
    <Plot xLabel="Time (s)" yLabel={choice+' ('+unit+')'} series={series} cursor={time} seek={seek}/>
  </section>;
}
export function ResonanceChart({models,hz}:{models:Model[];hz:number}){
  const series=useMemo(()=>{
    const last=Math.max(10,hz*1.2);
    return models.map((model,i)=>{
      const curve=resonanceCurve(model,.05,last);
      return {name:'Building '+(i===0?'A':'B'),x:curve.map(point=>point.hz),y:curve.map(point=>point.amplification)};
    });
  },[models,hz]);
  return <Plot series={series} xLabel="Excitation frequency (Hz)" yLabel="Roof amplification (relative to static)" cursor={hz}/>;
}
