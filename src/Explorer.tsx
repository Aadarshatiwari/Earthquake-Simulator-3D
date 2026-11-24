import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
type Event={id:string;name:string;mag:number;lat:number;lon:number;depth:number;date:string;url:string};
const eventPage='https://earthquake.usgs.gov/earthquakes/eventpage/';
const historic:Event[]=[
  {id:'iscgem904745',name:'Nepal–Bihar earthquake',mag:8,lat:27.275,lon:86.941,depth:15,date:'1934-01-15T08:43:25Z',url:eventPage+'iscgem904745/origin'},
  {id:'usp0003k6t',name:'Udayapur earthquake',mag:6.9,lat:26.755,lon:86.616,depth:57.4,date:'1988-08-20T23:09:09Z',url:'https://earthquake.usgs.gov/product/shakemap/usp0003k6t/atlas/1594165907947/download/pga.pdf'},
  {id:'us20002926',name:'Gorkha earthquake',mag:7.8,lat:28.231,lon:84.731,depth:8.2,date:'2015-04-25T06:11:25Z',url:eventPage+'us20002926/shakemap/metadata'},
  {id:'us20002ejl',name:'May 2015 aftershock',mag:7.3,lat:27.809,lon:86.066,depth:15,date:'2015-05-12T07:05:19Z',url:eventPage+'us20002ejl'},
  {id:'us7000l8p5',name:'Jajarkot earthquake',mag:5.7,lat:28.858,lon:82.1531,depth:12,date:'2023-11-03T18:02:53Z',url:eventPage+'us7000l8p5'}
];
const cacheKey='seismonepal-comcat-v1';
function cached():{at:number;events:Event[]}|null{
  try{const raw=localStorage.getItem(cacheKey);return raw?JSON.parse(raw):null}catch{return null}
}
export default function Explorer(){
  const [dataset,setDataset]=useState('Historical');
  const [recent,setRecent]=useState(()=>cached()?.events??[]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<Event|null>(historic[0]);
  const mapNode=useRef<HTMLDivElement>(null);
  const map=useRef<L.Map|null>(null);
  const markers=useRef<L.LayerGroup|null>(null);
  const controller=useRef<AbortController|null>(null);
  const events=dataset==='Historical'?historic:recent;
  useEffect(()=>{
    if(!mapNode.current)return;
    const instance=L.map(mapNode.current,{scrollWheelZoom:false}).fitBounds([[26,79],[31,89]]);
    map.current=instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>setStatus(previous=>previous||'Map tiles unavailable. Earthquake details remain accessible.')).addTo(instance);
    markers.current=L.layerGroup().addTo(instance);
    return ()=>{controller.current?.abort();instance.remove();map.current=null;markers.current=null;};
  },[]);
  useEffect(()=>{
    const group=markers.current;
    if(!group)return;
    group.clearLayers();
    for(const event of events){
      const popup=document.createElement('span');
      popup.textContent=event.name+' · M '+event.mag.toFixed(1);
      L.circleMarker([event.lat,event.lon],{radius:Math.max(5,event.mag*1.65),color:'#133b34',fillColor:'#55daae',weight:2,fillOpacity:.85})
        .bindTooltip(popup).on('click',()=>setSelected(event)).addTo(group);
    }
  },[events]);
  async function load(force=false){
    setDataset('Recent');
    const existing=cached();
    if(!force&&existing&&Date.now()-existing.at<15*60*1000){
      setRecent(existing.events);setSelected(existing.events[0]??null);setStatus('Showing cached USGS data.');return;
    }
    controller.current?.abort();
    const request=new AbortController();
    controller.current=request;
    setBusy(true);setStatus('Loading USGS earthquakes…');setSelected(existing?.events[0]??null);
    try{
      const start=new Date(Date.now()-30*86400000).toISOString();
      const query=new URLSearchParams({format:'geojson',starttime:start,minlatitude:'26',maxlatitude:'31',minlongitude:'79',maxlongitude:'89',minmagnitude:'2.5',limit:'100',orderby:'time'});
      const response=await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?'+query,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(12000)])});
      if(!response.ok)throw Error('USGS request failed');
      const json=await response.json() as {features:{id:string;geometry:{coordinates:number[]};properties:{place:string;mag:number;time:number}}[]};
      const found=json.features.flatMap(({id,geometry,properties}):Event[]=>{
        const [lon,lat,depth]=geometry.coordinates;
        if(![lat,lon,depth,properties.mag,properties.time].every(Number.isFinite))return [];
        return [{id,name:properties.place??'USGS earthquake',lat,lon,depth,mag:properties.mag,date:new Date(properties.time).toISOString(),url:eventPage+encodeURIComponent(id)}];
      });
      if(request.signal.aborted)return;
      setRecent(found);setSelected(found[0]??null);setStatus(found.length?'Updated from USGS ComCat.':'No matching events in the last 30 days.');
      try{localStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),events:found}))}catch{/* storage is optional */}
    }catch{
      if(!request.signal.aborted)setStatus(existing?'USGS unavailable. Showing the last cached events.':'USGS unavailable. Try refreshing, or browse historical events.');
    }finally{if(!request.signal.aborted)setBusy(false);}
  }
  function focus(event:Event){setSelected(event);map.current?.setView([event.lat,event.lon],Math.max(7,map.current.getZoom()));}
  return <><div className="heading"><div><h1>Nepal earthquake explorer</h1><p>Browse cataloged epicenters across Nepal and the surrounding region.</p></div><div className="actions"><button disabled={busy} aria-pressed={dataset==='Historical'} onClick={()=>{setDataset('Historical');setSelected(historic[0]);setStatus('');map.current?.fitBounds([[26,79],[31,89]])}}>Historical</button><button disabled={busy} aria-pressed={dataset==='Recent'} onClick={()=>void load()}>Recent · 30 days</button>{dataset==='Recent'&&<button disabled={busy} onClick={()=>void load(true)}>Refresh</button>}</div></div>
    <div className="explorer"><section className="panel map" ref={mapNode} aria-label="Earthquake epicenter map"/><aside className="panel quake-panel">
      <h2>{dataset==='Historical'?'Historical events':'Recent regional events'}</h2>
      {status&&<p className="muted" role="status">{status}</p>}
      {selected&&<article className="quake-detail"><strong>M {selected.mag.toFixed(1)} · {selected.name}</strong><p>{new Date(selected.date).toLocaleString('en-GB',{timeZone:'Asia/Kathmandu',dateStyle:'medium',timeStyle:'short'})} Nepal time</p><p>{selected.lat.toFixed(3)}° N, {selected.lon.toFixed(3)}° E · {selected.depth.toFixed(1)} km deep</p><a href={selected.url} target="_blank" rel="noreferrer">USGS event source</a></article>}
      <ul className="quake-list">{events.map(event=><li key={event.id}><button aria-pressed={event.id===selected?.id} onClick={()=>focus(event)}><b>{event.mag.toFixed(1)}</b> {event.name}</button></li>)}</ul>
      <p className="muted">Catalog entries provide event metadata. For structural response, import a sourced station recording or choose a synthetic motion.</p>
    </aside></div></>;
}
