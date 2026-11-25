import {useEffect,useMemo,useRef,useState} from 'react';
import Plotly from 'plotly.js-basic-dist-min';
import {extremaIndices} from '../charts/sample';
import {G} from '../engine';
import {archiveAsset,sources,type RecordingMeta} from './catalog';
import {components,horizontal,sampleAt,spectrum,type Component,type Trace} from './waveform';
import type {Recording} from '../seismic/motion';

type Props={stations:RecordingMeta[];onTransfer:(recording:Recording,direction:number)=>void};
type Chart='Acceleration'|'Spectrum'|'Horizontal acceleration orbit';
const plotly=Plotly as typeof Plotly&{relayout(node:HTMLElement,layout:object):Promise<unknown>};
export default function RecordLab({stations,onTransfer}:Props){
  const select=useRef<HTMLDivElement>(null),plot=useRef<HTMLDivElement>(null);
  const [stationId,setStation]=useState(stations[0]?.id??'');
  const meta=stations.find(item=>item.id===stationId)??stations[0];
  const [trace,setTrace]=useState<Trace|null>(null);
  const [component,setComponent]=useState<Component>('NS');
  const [chart,setChart]=useState<Chart>('Acceleration');
  const [status,setStatus]=useState('Loading verified station file…');
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
  const cursor=useRef(0),rendered=useRef(false);
  useEffect(()=>{
    if(!meta)return;
    const controller=new AbortController();
    let worker:Worker|undefined;
    setTrace(null);setPlaying(false);setTime(0);cursor.current=0;setStatus('Loading and checking '+meta.station+'…');
    fetch(archiveAsset(meta.asset),{signal:controller.signal})
      .then(r=>{if(!r.ok)throw Error('Recording asset is unavailable.');return r.arrayBuffer();})
      .then(buffer=>{
        if(controller.signal.aborted)return;
        worker=new Worker(new URL('./recordWorker.ts',import.meta.url),{type:'module'});
        worker.onmessage=({data}:{data:{trace?:Trace;error?:string}})=>{
          if(controller.signal.aborted)return;
          worker?.terminate();worker=undefined;
          setTrace(data.trace??null);setStatus(data.trace?'SHA-256 verified · source samples preserved':data.error??'Invalid recording.');
        };
        worker.onerror=()=>{if(!controller.signal.aborted)setStatus('Recording parser could not finish.');worker?.terminate();worker=undefined;};
        worker.postMessage({buffer,meta},[buffer]);
      }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'Could not load the recording.');});
    return ()=>{controller.abort();worker?.terminate();};
  },[meta]);
  useEffect(()=>{
    if(!playing||!trace)return;
    let handle=0,last=performance.now(),publish=last;
    const frame=(now:number)=>{
      cursor.current=Math.min(trace.duration,cursor.current+Math.min(.12,(now-last)/1000)*speed);last=now;
      if(now-publish>=70||cursor.current>=trace.duration){setTime(cursor.current);publish=now;}
      if(cursor.current>=trace.duration){setPlaying(false);return;}
      handle=requestAnimationFrame(frame);
    };
    handle=requestAnimationFrame(frame);
    return ()=>cancelAnimationFrame(handle);
  },[playing,speed,trace]);
  useEffect(()=>{
    const suspend=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',suspend);
    return ()=>document.removeEventListener('visibilitychange',suspend);
  },[]);
  const series=useMemo(()=>{
    if(!trace)return null;
    const signal=trace.components[component];
    if(chart==='Spectrum'){
      const {frequency,amplitude}=spectrum(signal,trace.dt);
      const keep=extremaIndices(amplitude.length,i=>amplitude[i]);
      return {x:keep.map(i=>frequency[i]),y:keep.map(i=>amplitude[i]),xLabel:'Frequency (Hz)',yLabel:'Single-sided amplitude (m/s²)'};
    }
    if(chart==='Horizontal acceleration orbit'){
      const keep=extremaIndices(signal.length,i=>Math.hypot(trace.components.NS[i],trace.components.EW[i]));
      return {x:keep.map(i=>trace.components.EW[i]),y:keep.map(i=>trace.components.NS[i]),xLabel:'East–west acceleration (m/s²)',yLabel:'North–south acceleration (m/s²)'};
    }
    const keep=extremaIndices(signal.length,i=>signal[i]);
    return {x:keep.map(i=>i*trace.dt),y:keep.map(i=>signal[i]),xLabel:'Seconds from start of station record',yLabel:component+' acceleration (m/s²)'};
  },[trace,component,chart]);
  const activeTime=useRef(time);activeTime.current=time;
  useEffect(()=>{
    const node=plot.current;if(!node||!series)return;
    let disposed=false;
    rendered.current=false;
    void Plotly.react(node,[{type:'scatter',mode:'lines',x:series.x,y:series.y,line:{color:'#72e7f8',width:1.45}}],{
      paper_bgcolor:'transparent',plot_bgcolor:'transparent',margin:{l:65,r:21,t:19,b:55},font:{color:'#d3e7f0',size:11},
      xaxis:{title:{text:series.xLabel},gridcolor:'#29495c',automargin:true},yaxis:{title:{text:series.yLabel},gridcolor:'#29495c',automargin:true},
      shapes:chart==='Acceleration'?[{type:'line',x0:activeTime.current,x1:activeTime.current,y0:0,y1:1,yref:'paper',line:{color:'#ffc490',dash:'dot'}}]:[],
    },{responsive:true,displaylogo:false}).then(()=>{
      if(!disposed)rendered.current=true;
    }).catch(()=>{if(!disposed)setStatus('The waveform chart could not be rendered.');});
    const observer=new ResizeObserver(()=>{if(rendered.current&&node.clientWidth)void Plotly.Plots.resize(node).catch(()=>{});});
    observer.observe(node);
    return ()=>{disposed=true;rendered.current=false;observer.disconnect();Plotly.purge(node);};
  },[series,chart]);
  useEffect(()=>{
    if(chart==='Acceleration'&&rendered.current&&plot.current)void plotly.relayout(plot.current,{'shapes[0].x0':time,'shapes[0].x1':time}).catch(()=>{});
  },[time,chart]);
  function seek(t:number){setPlaying(false);cursor.current=t;setTime(t);}
  if(!meta)return null;
  const current=trace?sampleAt(trace.components[component],trace.dt,time):0;
  return <section className="archive-card archive-record" ref={select} aria-label="Measured station recording">
    <div className="archive-section-head"><div><h2>Station replay</h2><p>Recorded acceleration · Shigefuji et al., Kathmandu Valley array</p></div>
      <span className="archive-status" role="status">{status}</span></div>
    <div className="archive-tools">
      <label>Station<select value={meta.id} onChange={e=>setStation(e.target.value)}>{stations.map(item=><option value={item.id} key={item.id}>{item.station}</option>)}</select></label>
      <label>Component<select value={component} onChange={e=>setComponent(e.target.value as Component)}><option value="NS">North–south (NS)</option><option value="EW">East–west (EW)</option><option value="UD">Vertical (UD)</option></select></label>
      <label>Analysis<select value={chart} onChange={e=>setChart(e.target.value as Chart)}>{['Acceleration','Spectrum','Horizontal acceleration orbit'].map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <p className="archive-note">{meta.latitude.toFixed(5)}° N · {meta.longitude.toFixed(5)}° E · {meta.elevation} m elevation · {meta.hz} Hz. Recording start {meta.start.replace('T',' ').replace('Z',' UTC')}.</p>
    <p className="archive-note">Published orientation-corrected acceleration, without sensor-response correction. Velocity and displacement are unavailable in these files. The orbit plots acceleration components, with no inferred particle displacement.</p>
    {trace&&<>
      <div className="archive-readings"><div><span>Selected acceleration</span><strong>{current.toFixed(4)} m/s²</strong></div><div><span>Station component PGA</span><strong>{(trace.pga[component]/G).toFixed(4)} g</strong></div><div><span>Record length</span><strong>{trace.duration.toFixed(2)} s</strong></div></div>
      <div className="archive-plot" ref={plot}/>
      <div className="archive-tools">
        <button className="archive-primary" onClick={()=>{if(cursor.current>=trace.duration)seek(0);setPlaying(!playing);}}>{playing?'Pause recording':time?'Resume recording':'Play recording'}</button>
        <button onClick={()=>{seek(0);setPlaying(true);}}>Restart recording</button>
        <label className="archive-timeline">Recording time {time.toFixed(2)} / {trace.duration.toFixed(2)} s<input type="range" min={0} max={trace.duration} step={trace.dt} value={time} onChange={e=>seek(+e.target.value)}/></label>
        <label>Playback speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.25,.5,1,2,4].map(v=><option value={v} key={v}>{v}×</option>)}</select></label>
      </div>
      <div className="archive-tools">
        <button disabled={!horizontal(component)} className="archive-primary" onClick={()=>{
          if(!horizontal(component))return;
          onTransfer({label:'Recorded · '+meta.station+' · '+component,provenance:sources.figshare+' · '+meta.path+' · SHA-256 '+meta.sha256,dt:trace.dt,samples:Array.from(trace.components[component])},component==='NS'?90:0);
        }}>Simulate on my building</button>
        {!horizontal(component)&&<span className="archive-note">Choose a horizontal component for the one-axis solver.</span>}
      </div>
    </>}
    <p className="archive-note">This trace describes motion at one station. <a href={sources.paper}>Scientific paper</a> · <a href={sources.figshare}>Data and CC BY 4.0 license</a></p>
  </section>;
}
