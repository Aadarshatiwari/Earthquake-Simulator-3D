import {useEffect,useMemo,useRef,useState} from 'react';
import Plotly from 'plotly.js-basic-dist-min';
import {extremaIndices} from '../charts/sample';
import {G} from '../engine';
import {sources,type Event,type RecordingMeta} from './catalog';
import {components,horizontal,sampleAt,spectrum,type Component,type Trace} from './waveform';
import {loadTrace} from './loadTrace';
import {originDistance,secondsBetween} from './presentation';
import type {Recording} from '../seismic/motion';

type Props={event:Event;stationPick:string;stations:RecordingMeta[];onTransfer:(recording:Recording,direction:number)=>void};
type Chart='Acceleration'|'Spectrum'|'Horizontal acceleration orbit';
const plotly=Plotly as typeof Plotly&{relayout(node:HTMLElement,layout:object):Promise<unknown>};
export default function RecordLab({event,stationPick,stations,onTransfer}:Props){
  const select=useRef<HTMLDivElement>(null),plot=useRef<HTMLDivElement>(null);
  const [stationId,setStation]=useState(stations[0]?.id??'');
  const [comparison,setComparison]=useState('');
  const [otherTrace,setOtherTrace]=useState<Trace|null>(null);
  const [comparisonError,setComparisonError]=useState('');
  const [vector,setVector]=useState(false);
  const meta=stations.find(item=>item.id===stationId)??stations[0];
  const other=stations.find(item=>item.id===comparison&&item.id!==meta?.id);
  const timeOffset=meta&&other?secondsBetween(other.start,meta.start):0;
  useEffect(()=>{const item=stations.find(s=>s.station===stationPick);if(item)setStation(item.id);},[stationPick,stations]);
  const [trace,setTrace]=useState<Trace|null>(null);
  const [component,setComponent]=useState<Component>('NS');
  const [chart,setChart]=useState<Chart>('Acceleration');
  const [status,setStatus]=useState('Loading verified station file…');
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
  const cursor=useRef(0),rendered=useRef(false);
  useEffect(()=>{
    if(!meta)return;
    const controller=new AbortController();
    setTrace(null);setPlaying(false);setTime(0);cursor.current=0;setStatus('Loading and checking '+meta.station+'…');
    loadTrace(meta,controller.signal).then(value=>{
      if(!controller.signal.aborted){setTrace(value);setStatus('SHA-256 verified · source samples preserved');}
    }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'Could not load the recording.');});
    return ()=>controller.abort();
  },[meta]);
  useEffect(()=>{
    setOtherTrace(null);setComparisonError('');
    if(!other)return;
    const controller=new AbortController();
    loadTrace(other,controller.signal).then(value=>{if(!controller.signal.aborted)setOtherTrace(value);})
      .catch(()=>{if(!controller.signal.aborted)setComparisonError('The comparison station could not be verified.');});
    return ()=>controller.abort();
  },[other]);
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
    function draw(record:Trace,offset:number){
      const signal=record.components[component];
      if(chart==='Spectrum'){
        const {frequency,amplitude}=spectrum(signal,record.dt);
        const keep=extremaIndices(amplitude.length,i=>amplitude[i]);
        return {x:keep.map(i=>frequency[i]),y:keep.map(i=>amplitude[i]),xLabel:'Frequency (Hz)',yLabel:'Single-sided amplitude (m/s²)'};
      }
      if(chart==='Horizontal acceleration orbit'){
        const keep=extremaIndices(signal.length,i=>Math.hypot(record.components.NS[i],record.components.EW[i]));
        return {x:keep.map(i=>record.components.EW[i]),y:keep.map(i=>record.components.NS[i]),xLabel:'East–west acceleration (m/s²)',yLabel:'North–south acceleration (m/s²)'};
      }
      const keep=extremaIndices(signal.length,i=>signal[i]);
      return {x:keep.map(i=>offset+i*record.dt),y:keep.map(i=>signal[i]),xLabel:'Seconds from start of primary station record',yLabel:component+' acceleration (m/s²)'};
    }
    return {main:draw(trace,0),comparison:otherTrace?draw(otherTrace,timeOffset):null};
  },[trace,component,chart,otherTrace,timeOffset]);
  const activeTime=useRef(time);activeTime.current=time;
  useEffect(()=>{
    const node=plot.current;if(!node||!series)return;
    let disposed=false;
    rendered.current=false;
    void Plotly.react(node,[{type:'scatter',mode:'lines',x:series.main.x,y:series.main.y,name:meta?.station,line:{color:'#72e7f8',width:1.45}},...(series.comparison?[{type:'scatter' as const,mode:'lines' as const,x:series.comparison.x,y:series.comparison.y,name:other?.station,line:{color:'#ffb788',width:1.25}}]:[])],{
      paper_bgcolor:'transparent',plot_bgcolor:'transparent',margin:{l:65,r:21,t:19,b:55},font:{color:'#d3e7f0',size:11},
      xaxis:{title:{text:series.main.xLabel},gridcolor:'#29495c',automargin:true},yaxis:{title:{text:series.main.yLabel},gridcolor:'#29495c',automargin:true},
      shapes:chart==='Acceleration'?[{type:'line',x0:activeTime.current,x1:activeTime.current,y0:0,y1:1,yref:'paper',line:{color:'#ffc490',dash:'dot'}}]:[],
    },{responsive:true,displaylogo:false}).then(()=>{
      if(!disposed)rendered.current=true;
    }).catch(()=>{if(!disposed)setStatus('The waveform chart could not be rendered.');});
    const observer=new ResizeObserver(()=>{if(rendered.current&&node.clientWidth)void Plotly.Plots.resize(node).catch(()=>{});});
    observer.observe(node);
    return ()=>{disposed=true;rendered.current=false;observer.disconnect();Plotly.purge(node);};
  },[series,chart,meta,other]);
  useEffect(()=>{
    if(chart==='Acceleration'&&rendered.current&&plot.current)void plotly.relayout(plot.current,{'shapes[0].x0':time,'shapes[0].x1':time}).catch(()=>{});
  },[time,chart]);
  function seek(t:number){setPlaying(false);cursor.current=t;setTime(t);}
  if(!meta)return null;
  const distance=(station:RecordingMeta)=>event.lat!==null&&event.lon!==null?originDistance(event.lat,event.lon,station.latitude,station.longitude).toFixed(1)+' km':'Unavailable';
  const site=(station:RecordingMeta)=>station.station==='KTP'?'rock':['PTN','THM','TVU'].includes(station.station)?'sedimentary site':'classification unavailable';
  const current=trace?sampleAt(trace.components[component],trace.dt,time):0;
  return <section className="archive-card archive-record" ref={select} aria-label="Measured station recording">
    <div className="archive-section-head"><div><h2>Station replay</h2><p>Recorded acceleration · {event.name}</p></div>
      <span className="archive-status" role="status">{status}</span></div>
    <div className="archive-tools">
      <label>Station<select value={meta.id} onChange={e=>setStation(e.target.value)}>{stations.map(item=><option value={item.id} key={item.id}>{item.station}</option>)}</select></label>
      {stations.length>1&&<label>Compare station<select value={other?.id??''} onChange={e=>setComparison(e.target.value)}><option value="">Off</option>{stations.filter(item=>item.id!==meta.id).map(item=><option value={item.id} key={item.id}>{item.station}</option>)}</select></label>}
      <label>Component<select value={component} onChange={e=>setComponent(e.target.value as Component)}><option value="NS">North–south (NS)</option><option value="EW">East–west (EW)</option><option value="UD">Vertical (UD)</option></select></label>
      <label>Analysis<select value={chart} onChange={e=>setChart(e.target.value as Chart)}>{['Acceleration','Spectrum','Horizontal acceleration orbit'].map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <p className="archive-note">{meta.latitude.toFixed(5)}° N · {meta.longitude.toFixed(5)}° E · {meta.elevation} m elevation · {meta.hz} Hz. Recording start {meta.start.replace('T',' ').replace('Z',' UTC')}.</p>
    <p className="archive-note">{meta.format==='Takai2016'?'Original publisher acceleration. The source recommends sensor-response correction before engineering use.':'Published orientation-corrected acceleration, without sensor-response correction.'} Velocity and displacement are unavailable in these files. The orbit plots acceleration components.</p>
    {other&&<div className="archive-note"><strong>Station comparison laboratory</strong><p>{meta.station} {distance(meta)} · {other.station} {distance(other)} from epicentre. The comparison starts {Math.abs(timeOffset).toFixed(2)} s {timeOffset<0?'earlier':'later or at the same time'} on the published UTC clocks. Distance, source and local conditions can shape the recordings.</p><p>{meta.station} · {site(meta)}. {other.station} · {site(other)}. <a href="https://doi.org/10.1186/s40623-016-0383-7">Published site descriptions</a></p>{otherTrace&&<p>{other.station} · {other.latitude.toFixed(5)}° N, {other.longitude.toFixed(5)}° E · {(otherTrace.pga[component]/G).toFixed(4)} g {component} PGA</p>}{comparisonError&&<p role="status">{comparisonError}</p>}</div>}
    {trace&&<>
      <div className="archive-readings"><div><span>Selected acceleration</span><strong>{current.toFixed(4)} m/s²</strong></div><div><span>Station component PGA</span><strong>{(trace.pga[component]/G).toFixed(4)} g</strong></div><div><span>Record length</span><strong>{trace.duration.toFixed(2)} s</strong></div></div>
      <div className="archive-plot" ref={plot}/>
      <label className="archive-check"><input type="checkbox" checked={vector} onChange={e=>setVector(e.target.checked)}/>Show measured horizontal acceleration vector</label>
      {vector&&<svg viewBox="0 0 220 120" width="220" height="120" role="img" aria-label="Measured east and north acceleration vector">
        <path d="M20 60H200M110 10V110" stroke="#527789"/>
        <text x="201" y="64" fill="#c4e3ec">E</text><text x="116" y="18" fill="#c4e3ec">N</text>
        <line x1="110" y1="60" x2={110+45*sampleAt(trace.components.EW,trace.dt,time)/Math.max(.01,trace.pga.EW,trace.pga.NS)} y2={60-45*sampleAt(trace.components.NS,trace.dt,time)/Math.max(.01,trace.pga.EW,trace.pga.NS)} stroke="#ffd196" strokeWidth="4"/>
      </svg>}
      <div className="archive-tools">
        <button className="archive-primary" onClick={()=>{if(cursor.current>=trace.duration)seek(0);setPlaying(!playing);}}>{playing?'Pause recording':time?'Resume recording':'Play recording'}</button>
        <button onClick={()=>{seek(0);setPlaying(true);}}>Restart recording</button>
        <label className="archive-timeline">Recording time {time.toFixed(2)} / {trace.duration.toFixed(2)} s<input type="range" min={0} max={trace.duration} step={trace.dt} value={time} onChange={e=>seek(+e.target.value)}/></label>
        <label>Playback speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.25,.5,1,2,4].map(v=><option value={v} key={v}>{v}×</option>)}</select></label>
      </div>
      <div className="archive-tools">
        <button disabled={!horizontal(component)} className="archive-primary" onClick={()=>{
          if(!horizontal(component))return;
          onTransfer({label:'Recorded · '+event.name+' · '+meta.station+' · '+component,provenance:(meta.source??sources.figshare)+' · '+meta.path+' · SHA-256 '+meta.sha256,dt:trace.dt,samples:Array.from(trace.components[component])},component==='NS'?90:0);
        }}>Simulate on my building</button>
        {!horizontal(component)&&<span className="archive-note">Choose a horizontal component for the one-axis solver.</span>}
      </div>
    </>}
    <p className="archive-note">This trace describes motion at one station. <a href={meta.format==='Takai2016'?'https://doi.org/10.1186/s40623-016-0383-7':sources.paper}>Scientific paper</a> · <a href={meta.source??sources.figshare}>Data and CC BY 4.0 license</a></p>
  </section>;
}
