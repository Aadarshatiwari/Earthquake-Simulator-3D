import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useFullscreen} from './ui/useFullscreen';
import {archiveAsset,filterEvents,formatTime,initialFilters,parseCatalog,parseRecent,sources,specialEvents,type Event,type Filters,type RecordingMeta} from './archive/catalog';
import {districtAt,type Bounds} from './archive/geography';
import type {MapMode} from './archive/ArchiveMap';
import type {Recording} from './seismic/motion';
import {markerBands,mergeEvents,type ColourMode} from './archive/presentation';
import Waves from './archive/Waves';
import './archive/archive.css';

const Map=lazy(()=>import('./archive/ArchiveMap'));
const Terrain=lazy(()=>import('./archive/Terrain'));
const RecordLab=lazy(()=>import('./archive/RecordLab'));
const tileModes=['Offline','Standard','Terrain tiles','Dark','Satellite'] as const satisfies readonly MapMode[];
const parameters={mmi:'MMI',pga:'PGA (% g)',pgv:'PGV (cm/s)',psa0p3:'PSA 0.3 s (% g)'} as const;
const archiveDate='25 November 2026';
const canada='https://pubs.usgs.gov/publication/ofr20151142';
const oldMetadata:Record<string,{mechanism?:string;impact?:string;url:string}>={
  us20002926:{mechanism:'Thrust faulting on the Main Himalayan Thrust',impact:'The earthquake sequence triggered thousands of landslides in steep terrain.',url:canada},
  us20002ejl:{mechanism:'Thrust faulting near the Main Himalayan Thrust',url:'https://earthquake.usgs.gov/earthquakes/eventpage/us20002ejl/executive'},
  h1255:{impact:'Historical chronicles describe widespread destruction. The extent is uncertain.',url:sources.isc},
  us7000l8p5:{impact:'Nepal’s disaster report identifies Ramidanda, Jajarkot, as the epicentral area.',url:'https://ndrrma.gov.np/mediafiles/publications/Nepal_Disaster_Report_Final_2024.pdf'},
};
function missing(value:number|null,unit:string,digits=1){return value===null?'Unavailable':value.toFixed(digits)+unit;}
function fallbackMap(label:string){return <div className="archive-map archive-blank" role="status">{label}</div>;}
const cacheKey='seismonepal-comcat-archive-v1';
async function asset<T>(name:string,signal:AbortSignal):Promise<T>{
  const response=await fetch(archiveAsset(name),{signal});
  if(!response.ok)throw Error(name+' could not be loaded.');
  return response.json() as Promise<T>;
}
export default function Explorer({onTransfer,initialEvent}:{initialEvent?:string;onTransfer:(recording?:Recording,direction?:number,eventId?:string)=>void}){
  const [events,setEvents]=useState<Event[]>(specialEvents);
  const [recent,setRecent]=useState<Event[]>([]);
  const [dataset,setDataset]=useState<'Archive'|'Recent'>('Archive');
  const [provinces,setProvinces]=useState<Bounds|null>(null);
  const [districts,setDistricts]=useState<Bounds|null>(null);
  const [recordings,setRecordings]=useState<RecordingMeta[]>([]);
  const [products,setProducts]=useState<Record<string,string>>({});
  const [shakeLegends,setShakeLegends]=useState<Record<string,[number,string][]>>({});
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<string>(initialEvent??'us20002ejl');
  const [mode,setMode]=useState<MapMode>('Offline');
  const [terrain,setTerrain]=useState(false);
  const [section,setSection]=useState(false);
  const [fit,setFit]=useState(0);
  const [focus,setFocus]=useState(false);
  const [colour,setColour]=useState<ColourMode>('Depth');
  const [opacity,setOpacity]=useState(.85);
  const [recentAt,setRecentAt]=useState(0);
  const [intro,setIntro]=useState(false);
  const [cinematic,setCinematic]=useState(true);
  const [stationPick,setStationPick]=useState('');
  const [showDistricts,setShowDistricts]=useState(true);
  const [showStations,setShowStations]=useState(true);
  const [filters,setFilters]=useState(initialFilters);
  const [parameter,setParameter]=useState<keyof typeof parameters|''>('');
  const [chronology,setChronology]=useState<number|null>(null);
  const [timelinePlaying,setTimelinePlaying]=useState(false);
  const [replay,setReplay]=useState(false);
  const map=useRef<HTMLElement>(null),replayNode=useRef<HTMLDivElement>(null);
  const request=useRef<AbortController|null>(null);
  const fullscreen=useFullscreen(map);
  useEffect(()=>{
    const controller=new AbortController();
    const signal=controller.signal;
    const measured=performance.now();
    void Promise.all([asset<unknown>('catalog.json',signal),asset<unknown>('catalog-extension.json',signal).catch(()=>[])]).then(([data,extension])=>{
      if(signal.aborted)return;
      const decoded=parseCatalog(data);setEvents(mergeEvents(specialEvents,decoded,parseCatalog(extension)));
      performance.measure('seismonepal-archive-catalog',{start:measured,end:performance.now()});
    }).catch(e=>{if(!signal.aborted)setStatus(e.message);});
    void asset<Bounds>('provinces.json',signal).then(setProvinces).catch(e=>{if(!signal.aborted)setStatus(e.message);});
    void asset<Bounds>('districts.json',signal).then(setDistricts).catch(e=>{if(!signal.aborted)setStatus(e.message);});
    void Promise.all([asset<RecordingMeta[]>('recordings.json',signal),asset<RecordingMeta[]>('gorkha-mainshock.json',signal).catch(()=>[])]).then(groups=>setRecordings(mergeEvents(...groups))).catch(e=>{if(!signal.aborted)setStatus(e.message);});
    void asset<Record<string,[number,string][]>>('shakemap-legends.json',signal).then(setShakeLegends).catch(()=>{});
    void asset<Record<string,string>>('shakemaps.json',signal).then(setProducts).catch(e=>{if(!signal.aborted)setStatus(e.message);});
    return ()=>{controller.abort();request.current?.abort();};
  },[]);
  const show=dataset==='Archive'?events:recent;
  const stationEvents=useMemo(()=>new Set(recordings.map(item=>item.event)),[recordings]);
  const regions=useMemo(()=>new globalThis.Map(show.map(item=>[item.id,districtAt(districts,item.lon,item.lat)])),[show,districts]);
  const matches=useMemo(()=>filterEvents(show,filters,stationEvents,item=>regions.get(item.id)),[show,filters,stationEvents,regions]);
  const current=matches.find(item=>item.id===selected)??matches.find(item=>item.featured)??matches.at(-1)??null;
  const displayList=useMemo(()=>[...matches].sort((a,b)=>Number(!!b.featured)-Number(!!a.featured)||b.year-a.year||String(b.date).localeCompare(String(a.date))),[matches]);
  const stations=useMemo(()=>[...new globalThis.Map(recordings.map(x=>[x.station,x])).values()],[recordings]);
  const currentStations=useMemo(()=>recordings.filter(x=>x.event===current?.id),[recordings,current?.id]);
  const years=useMemo(()=>[...new Set(matches.map(x=>x.year))].sort((a,b)=>a-b),[matches]);
  const bins=useMemo(()=>{
    const bins=new globalThis.Map<number,{count:number;peak:number;aftershocks:number}>();
    for(const item of matches){
      const decade=Math.floor(item.year/10)*10,bucket=bins.get(decade)??{count:0,peak:0,aftershocks:0};
      bucket.count++;bucket.peak=Math.max(bucket.peak,item.mag??0);bucket.aftershocks+=Number(item.kind==='Aftershock');bins.set(decade,bucket);
    }
    return [...bins].sort((a,b)=>a[0]-b[0]);
  },[matches]);
  const key=current&&parameter?current.id+'-'+parameter:null;
  const shake=key&&products[key]?key:null;
  const info=current?oldMetadata[current.id]:undefined;
  const region=current?regions.get(current.id):undefined;
  useEffect(()=>{
    if(!timelinePlaying||years.length<2)return;
    let index=0;
    setChronology(years[index]);
    const step=setInterval(()=>{
      index++;
      if(index>=years.length){setTimelinePlaying(false);return;}
      setChronology(years[index]);
    },matchMedia('(prefers-reduced-motion: reduce)').matches?1500:550);
    return ()=>clearInterval(step);
  },[years,timelinePlaying]);
  function edit<K extends keyof Filters>(field:K,value:Filters[K]){
    setFilters(old=>({...old,[field]:value,...(field==='province'?{district:''}:{})}));
    setReplay(false);setTimelinePlaying(false);setChronology(null);
  }
  function select(item:Event){setSelected(item.id);setParameter('');setFocus(terrain&&item.lat!==null&&item.lon!==null);setSection(false);setReplay(false);setIntro(false);}
  useEffect(()=>{
    if(!intro)return;
    const handle=setTimeout(()=>{setIntro(false);setFocus(true);},1400);
    return ()=>clearTimeout(handle);
  },[intro]);
  function startReplay(){
    if(!current)return;
    const animate=cinematic&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReplay(true);setTerrain(true);setFocus(!animate);setFit(v=>v+1);setSection(false);setIntro(animate);
    requestAnimationFrame(()=>map.current?.scrollIntoView({block:'start',behavior:animate?'smooth':'instant'}));
  }
  async function loadRecent(force=false){
    setDataset('Recent');setFilters(initialFilters);setReplay(false);setIntro(false);setChronology(null);setTimelinePlaying(false);
    try{
      const saved=JSON.parse(localStorage.getItem(cacheKey)??'null') as {at:number;events:Event[]}|null;
      if(saved?.events){setRecent(saved.events);setRecentAt(saved.at);if(!force&&Date.now()-saved.at<15*60*1000){setStatus('Showing cached USGS events.');return;}}
    }catch{/* storage is optional */}
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    setBusy(true);setStatus('Loading recent USGS events…');
    try{
      const query=new URLSearchParams({format:'geojson',starttime:new Date(Date.now()-30*86400000).toISOString(),minlatitude:'26',maxlatitude:'31',minlongitude:'79',maxlongitude:'89',minmagnitude:'2.5',limit:'100',orderby:'time'});
      const response=await fetch(sources.comcat+'query?'+query,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
      if(!response.ok)throw Error();
      const found=parseRecent(await response.json());
      if(controller.signal.aborted)return;
      setRecent(mergeEvents(found));setRecentAt(Date.now());setStatus(found.length?'Updated from USGS ComCat.':'No matching recent regional events.');
      try{localStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),events:found}));}catch{/* storage is optional */}
    }catch{if(!controller.signal.aborted)setStatus('The USGS recent feed is unavailable. Historical data remain local.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  function showArchive(){
    request.current?.abort();setBusy(false);setDataset('Archive');setFilters(initialFilters);setStatus('');setSelected('us20002ejl');setReplay(false);setChronology(null);
  }
  const filterText=(name:string,field:keyof Omit<Filters,'recorded'>,min?:number,max?:number)=><label>{name}<input type={min===undefined?'search':'number'} min={min} max={max} step={(field==='minimum'||field==='maximum')?.1:1} value={filters[field]} onChange={e=>edit(field,e.target.value)}/></label>;
  return <div className="archive">
    <header className="archive-header"><div><h1>Nepal Earthquake Archive</h1><p>Explore historical earthquakes, measured station records, and published shaking estimates.</p></div>
      <div className="archive-tools"><button aria-pressed={dataset==='Archive'} onClick={showArchive}>Historical archive</button><button aria-pressed={dataset==='Recent'} onClick={()=>void loadRecent()}>Recent USGS</button>{dataset==='Recent'&&<button disabled={busy} onClick={()=>void loadRecent(true)}>Refresh</button>}</div></header>
    <div className="archive-layout">
      <section className={'archive-card archive-stage'+(fullscreen.inline?' viewport-expanded':'')} ref={map} aria-label="Nepal seismic map">
        <div className="archive-section-head"><div><h2>{terrain?'3D seismic terrain':'Nepal seismic map'}</h2><p>{terrain?'Sampled digital elevation model · adjustable relief':'7 provinces · 77 districts · WGS84 source boundaries'}</p></div>
          <div className="archive-tools"><button aria-pressed={!terrain} onClick={()=>setTerrain(false)}>2D map</button><button aria-pressed={terrain} onClick={()=>setTerrain(true)}>3D terrain</button><button onClick={()=>{setFocus(false);setSection(false);setFit(f=>f+1);}}>Fit Nepal</button><button aria-pressed={fullscreen.expanded} onClick={()=>void fullscreen.toggle()}>{fullscreen.expanded?'Exit fullscreen':'Fullscreen'}</button></div></div>
        {terrain?<Suspense fallback={fallbackMap('Loading terrain renderer…')}><Terrain event={current} provinces={provinces} districts={districts} stations={showStations?currentStations:[]} section={section} focus={focus} fit={fit} shake={shake} opacity={opacity} onFallback={()=>setTerrain(false)}/></Suspense>:
          <Suspense fallback={fallbackMap('Loading map…')}><Map events={matches} event={current} provinces={provinces} districts={districts} stations={stations} mode={mode} showDistricts={showDistricts} showStations={showStations} fit={fit} shake={shake} opacity={opacity} colour={colour} chronology={chronology} onSelect={select} onStation={station=>{if(currentStations.some(item=>item.station===station)){setStationPick(station);setReplay(true);requestAnimationFrame(()=>replayNode.current?.scrollIntoView());}}} onDistrict={value=>edit('district',value)} onNotice={setStatus}/></Suspense>}
        <div className="archive-toolbar">
          {!terrain?<><label>Basemap<select value={mode} onChange={e=>setMode(e.target.value as MapMode)}>{tileModes.map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="archive-check"><input type="checkbox" checked={showDistricts} onChange={e=>setShowDistricts(e.target.checked)}/>Districts</label>
            <label className="archive-check"><input type="checkbox" checked={showStations} onChange={e=>setShowStations(e.target.checked)}/>Stations</label>
            <label>Marker colour<select value={colour} onChange={e=>setColour(e.target.value as ColourMode)}><option>Depth</option><option>Magnitude</option></select></label></>:
            <><button disabled={current?.lat==null} onClick={()=>{setFocus(true);setSection(false);}}>Focus epicentre</button><button disabled={current?.depth==null||current.depth<0||current.lat===null} aria-pressed={section} onClick={()=>{setFocus(true);setSection(v=>!v);}}>Depth section</button></>}
            <label>Official ShakeMap<select value={parameter} onChange={e=>setParameter(e.target.value as typeof parameter)}><option value="">Off</option>{Object.entries(parameters).map(([p,label])=><option disabled={!current||!products[current.id+'-'+p]} value={p} key={p}>{label}</option>)}</select></label>{shake&&<label>Overlay opacity<input aria-label="ShakeMap opacity" type="range" min=".15" max="1" step=".05" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label>}
        </div>
        {!terrain&&<div className="terrain-swatches" aria-label="Earthquake marker legend">{markerBands[colour].map(([,hex,label])=><span key={label}><i style={{background:hex}}/>{label}</span>)}<span>Size = magnitude</span><span>Amber = selected</span><span>◆ Station</span><span>Gray = unavailable</span><span>Thick rim = mainshock · dashed = aftershock</span><span>Historical origins without coordinates appear in the catalogue</span></div>}
        {replay&&<div className="archive-toolbar" aria-label="Historical Earthquake Replay"><strong>Historical Earthquake Replay</strong>{intro&&<button onClick={()=>{setIntro(false);setFocus(true);}}>Skip camera introduction</button>}<button onClick={()=>{setFocus(true);setSection(true);}}>Reveal depth</button><button onClick={()=>replayNode.current?.scrollIntoView()}>Wave and station tools</button><button onClick={()=>{setReplay(false);setIntro(false);}}>Exit replay</button></div>}
        {shake&&<p className="archive-note archive-inset">USGS {parameters[parameter as keyof typeof parameters]} contours show published spatial estimates. Static Atlas product · {new Date(Number(products[shake].split('/')[7])).toLocaleDateString('en-GB',{timeZone:'UTC'})} UTC. Hover a 2D contour for its value. <a href={products[shake]}>Official contour product</a></p>}
        {shake&&shakeLegends[shake]&&<details className="archive-inset"><summary>ShakeMap contour legend · {parameters[parameter as keyof typeof parameters]}</summary><div className="terrain-swatches">{shakeLegends[shake].map(([value,color])=><span key={value}><i style={{background:color}}/>{value}</span>)}</div></details>}
        {recentAt>0&&dataset==='Recent'&&<p className="archive-note archive-inset">Last successful ComCat update {new Date(recentAt).toISOString()}</p>}
        {status&&<p className="archive-status archive-inset" role="status">{status}</p>}
      </section>
      <aside className="archive-card archive-events">
        <h2>Find an earthquake</h2><label>Search name, year or event ID<input type="search" value={filters.query} onChange={e=>edit('query',e.target.value)} placeholder="Dolakha, 2015, Gorkha"/></label>
        <details><summary>Catalogue filters</summary><div className="archive-fields">
          {filterText('From year','since',1000,2100)}{filterText('To year','until',1000,2100)}
          {filterText('Min magnitude','minimum',0,10)}{filterText('Max magnitude','maximum',0,10)}
          {filterText('Max depth (km)','depth',0,750)}
          <label>Source<select value={filters.source} onChange={e=>edit('source',e.target.value)}><option value="">All sources</option>{[...new Set(show.map(e=>e.source))].map(s=><option key={s}>{s}</option>)}</select></label>
          <label>Province<select value={filters.province} onChange={e=>edit('province',e.target.value)}><option value="">All provinces</option>{provinces?.features.map(f=><option key={f.properties.province}>{f.properties.province}</option>)}</select></label>
          <label>District<select value={filters.district} onChange={e=>edit('district',e.target.value)}><option value="">All districts</option>{districts?.features.filter(f=>!filters.province||f.properties.province===filters.province).map(f=>f.properties.name).sort().map(name=><option key={name}>{name}</option>)}</select></label>
        </div><label className="archive-check"><input type="checkbox" checked={filters.recorded} onChange={e=>edit('recorded',e.target.checked)}/>Has a bundled station recording</label><button onClick={()=>{setFilters(initialFilters);setChronology(null);setReplay(false);setIntro(false);}}>Clear filters</button></details>
        <p className="archive-note">{matches.length} events in view</p>
        <ul>{displayList.map(item=><li key={item.id}><button aria-pressed={current?.id===item.id} onClick={()=>select(item)}>
          <span>{item.mag===null?'—':item.mag.toFixed(1)}</span><div><strong>{item.name}</strong><small>{item.year} · {item.magType??'historical'}{stationEvents.has(item.id)?' · Station record':''}</small></div>
        </button></li>)}</ul>
        {matches.length===0&&<p>No events match these filters.</p>}
      </aside>
    </div>
    {current&&<section className="archive-card archive-detail" aria-label="Selected earthquake">
      <div className="archive-section-head"><div><p>{current.kind==='Unclassified'?'Catalogue event':current.kind} · {current.source}</p><h2>{current.name}</h2></div><button className="archive-primary" onClick={startReplay}>Historical Earthquake Replay</button><label className="archive-check"><input type="checkbox" checked={cinematic} onChange={e=>setCinematic(e.target.checked)}/>Camera introduction</label></div>
      <dl className="archive-readings">
        <div><span>Magnitude</span><strong>{missing(current.mag,current.magType?' '+current.magType:'')}</strong></div>
        <div><span>Depth</span><strong>{missing(current.depth,' km',2)}</strong></div>
        <div><span>{current.date?'UTC origin':'Historical date'}</span><strong>{formatTime(current,'UTC')}</strong></div>
        <div><span>Nepal local time</span><strong>{current.date?formatTime(current,'Asia/Kathmandu'):'Time unavailable'}</strong></div>
        <div><span>Epicentre</span><strong>{current.lat===null||current.lon===null?'Unavailable':current.lat.toFixed(4)+'° N · '+current.lon.toFixed(4)+'° E'}</strong></div>
        <div><span>Approximate district / province</span><strong>{region?region.name+' · '+region.province:districts&&current.lat!==null?'Outside bundled Nepal districts':'Unavailable'}</strong></div>
        <div><span>ComCat ShakeMap maximum MMI</span><strong>{missing(current.intensity,' MMI')}</strong></div>
        <div><span>Bundled station files</span><strong>{currentStations.length||'Unavailable'}</strong></div>
      </dl>
      <p className="archive-note">{current.place}{current.note?' · '+current.note:''}</p>
      {current.id==='us7000l8p5'&&<p className="archive-note">Alternate reported solution · <strong>6.4 ML</strong> near Ramidanda, attributed to NEMRC/DMG. <a href="https://www.neanepal.org.np/public/storage/news/2023/11/jajarkot-earthquake-2023compressed_1700830540.pdf">Nepal Engineers’ Association summary</a></p>}
      {info?.mechanism&&<p className="archive-note">Mechanism · {info.mechanism}</p>}{info?.impact&&<p className="archive-note">{info.impact}</p>}
      <p className="archive-note"><a href={current.url}>Event reference</a>{info&&<> · <a href={info.url}>Background and impacts</a></>} · {Object.keys(products).some(s=>s.startsWith(current.id+'-'))?'Official ShakeMap contours available in 2D and 3D':'No bundled ShakeMap for this event'}. PGV and strong-shaking duration are unavailable as station measurements here.</p>
    </section>}
    {replay&&current&&<div ref={replayNode} className="archive-replay">
      {currentStations.length>0?<Suspense fallback={<p role="status">Loading recording tools…</p>}><RecordLab key={current.id} event={current} stationPick={stationPick} stations={currentStations} onTransfer={(recording,direction)=>onTransfer(recording,direction,current.id)}/></Suspense>:
        <section className="archive-card archive-detail"><h2>Instrumental replay unavailable</h2><p className="archive-note">This archive has no source-verified time history linked to this event. You can still inspect its epicentre, catalogued depth, and any official ShakeMap.</p><button onClick={()=>onTransfer()}>Open a separate synthetic exercise</button></section>}
      <Waves/>
    </div>}
    <section className="archive-card archive-history"><div className="archive-section-head"><div><h2>Catalogue timeline</h2><p>Counts per decade for the current filters. Catalogue coverage changes across time.</p></div>
      <div className="archive-tools"><button disabled={years.length<2} onClick={()=>{setTerrain(false);setTimelinePlaying(!timelinePlaying);if(timelinePlaying)setChronology(null);}}>{timelinePlaying?'Stop chronology':'Play chronology'}</button>{chronology!==null&&<button onClick={()=>{setChronology(null);setTimelinePlaying(false);}}>Show all years</button>}</div></div>
      <div className="archive-histogram" aria-label="Documented earthquake counts by decade">{bins.map(([decade,{count,peak,aftershocks}])=><button key={decade} title={count+' events · maximum '+(peak||'unavailable')+' · '+aftershocks+' assigned aftershocks'} onClick={()=>{setFilters(old=>({...old,since:String(decade),until:String(decade+9)}));setChronology(null);setTimelinePlaying(false);setReplay(false);setIntro(false);}}>
        <strong>{count}</strong><i style={{height:Math.max(4,Math.log2(count+1)*10)+'px',background:peak>=7?'#ffc17d':'#5dcbd9'}}/><span>{decade}s</span></button>)}</div>
      {chronology!==null&&<p role="status">Epicentres through {chronology}</p>}
    </section>
    <details className="archive-card archive-sources"><summary>Scientific sources and coverage</summary>
      <p className="archive-note">Snapshot prepared {archiveDate}. ComCat query covers 1900–25 November 2026, reported M≥5, within 26–31° N and 79–89° E. It includes Nepal’s neighbouring areas. Two older historical entries are curated separately. Counts reflect the selected data and can’t establish historical earthquake rates. Simplified administrative matching near borders is approximate.</p>
      <p className="archive-note">ML is local magnitude, Mw is moment magnitude, and mb is body-wave magnitude. mww, mwr and mwb are reported moment-magnitude method codes. MMI describes shaking intensity; PGA is the peak acceleration of an input or station trace. Neither is interchangeable with magnitude.</p>
      <p className="archive-note"><a href={sources.comcat}>USGS ComCat</a> · <a href={sources.isc}>ISC-GEM</a> · <a href={sources.nepal}>Nepal NEMRC</a> · <a href={sources.dmg}>Nepal DMG</a> · <a href={sources.cesmd}>CESMD</a> · <a href={sources.boundaries}>Open Knowledge Nepal boundaries</a> · <a href={sources.paper}>Strong-motion paper</a></p>
    </details>
  </div>;
}
