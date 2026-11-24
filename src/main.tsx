import {lazy,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {G,parseMotion,simulate,synthetic,type Building,type Motion} from './solver';
import {presets,systems} from './presets';
import './style.css';
import {experiments} from './experiments';
import type {CameraView} from './Scene';
const Diagnostics=lazy(()=>import('./Diagnostics'));
const Scene=lazy(()=>import('./Scene'));
const Analytics=lazy(()=>import('./Analytics'));
const Explorer=lazy(()=>import('./Explorer'));
const Learn=lazy(()=>import('./Learn'));
const metrics=[['displacement','Peak displacement','mm',1000],['acceleration','Peak floor acceleration','g',1/G],['drift','Peak interstorey drift','%',100],['shear','Peak base shear','kN',.001]] as const;
const dimensions=[['floors','Floors',1,20,1],['height','Floor height (m)',2,6,.05],['width','Width (m)',4,28,.5],['length','Depth (m)',4,24,.5],['column','Column width (m)',.2,1.5,.05],['beam','Beam depth (m)',.2,1.4,.05],['mass','Floor mass (t)',10,500,1],['stiffness','Storey stiffness (MN/m)',2,600,1],['damping','Damping (%)',0,25,.5]] as const;
type Tab='Diagnostics'|'Simulation'|'Analytics'|'Nepal explorer'|'Learn';
const scenarios={
  'Valley benchmark':{pga:.28,hz:1.25,seconds:22,direction:0},
  'Resonance study':{pga:.15,hz:1.85,seconds:26,direction:0},
  'Short strong pulse':{pga:.55,hz:2.6,seconds:12,direction:45},
};
function Select({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){
  return <label className="field">{label}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(option=><option key={option}>{option}</option>)}</select></label>;
}
function NumberField({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void}){
  const hints:Record<string,string>={'Input PGA (g)':'Peak input acceleration as a fraction of standard gravity.','Storey stiffness (MN/m)':'Lateral restoring force in meganewtons per metre of storey displacement.','Damping (%)':'Target Rayleigh damping ratio for the first and third available modes.','Shaking direction (°)':'Orients the single horizontal response axis in the 3D view.','Floor mass (t)':'Uniform lumped seismic mass per floor in metric tonnes.'};
  return <label className="field" title={hints[label]}>{label}<input type="number" key={value} defaultValue={value} min={min} max={max} step={step} onBlur={e=>{
    const next=e.currentTarget.valueAsNumber;
    const clamped=Number.isFinite(next)?Math.max(min,Math.min(max,next)):value;
    const corrected=step===1?Math.round(clamped):clamped;
    e.currentTarget.value=String(corrected);
    if(corrected!==value)onChange(corrected);
  }} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>;
}
function Toggle({children,value,onClick}:{children:ReactNode;value:boolean;onClick:()=>void}){
  return <button type="button" className={value?'toggle on':'toggle'} aria-pressed={value} onClick={onClick}>{children}</button>;
}
function App(){
  const [tab,setTab]=useState<Tab>('Diagnostics');
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('seismonepal-theme')??'dark'}catch{return 'dark'}});
  const [sidebar,setSidebar]=useState(false);
  const [cameraView,setCameraView]=useState<CameraView>('Perspective');
  const [selected,setSelected]=useState<{building:number;floor:number}|null>(null);
  const [quickStart,setQuickStart]=useState(true);
  const pendingPlay=useRef(false);
  const [compare,setCompare]=useState(false);
  const [edit,setEdit]=useState(0);
  const [buildings,setBuildings]=useState([presets['Concrete frame'],{...presets['Concrete frame'],system:'Base isolation'} as Building]);
  const [names,setNames]=useState(['Concrete frame','Concrete frame']);
  const [settings,setSettings]=useState(scenarios['Valley benchmark']);
  const [scenario,setScenario]=useState('Valley benchmark');
  const [record,setRecord]=useState<Motion|null>(null);
  const [source,setSource]=useState('');
  const [error,setError]=useState('');
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [scale,setScale]=useState(15);
  const [wire,setWire]=useState(false);
  const [section,setSection]=useState(false);
  const [demand,setDemand]=useState(true);
  const [damage,setDamage]=useState(false);
  const [collapse,setCollapse]=useState(false);
  const [viewError,setViewError]=useState('');
  const [cameraId,setCameraId]=useState(0);
  const [runId,setRunId]=useState(0);
  const [clock,setClock]=useState(0);
  const time=useRef(0);
  const viewport=useRef<HTMLDivElement>(null);
  const motion=useMemo(()=>record??synthetic(settings.pga,settings.hz,settings.seconds),[record,settings.pga,settings.hz,settings.seconds]);
  const duration=(motion.acceleration.length-1)*motion.dt;
  const models=useMemo(()=>buildings.slice(0,compare?2:1).map(building=>({building,result:simulate(building,motion)})),[buildings,motion,compare]);
  function seek(value:number){time.current=value;setClock(value);}
  function restart(play=false){setPlaying(play);seek(0);setRunId(id=>id+1);}
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    try{localStorage.setItem('seismonepal-theme',theme)}catch{/* storage is optional */}
  },[theme]);
  useEffect(()=>{
    time.current=0;setClock(0);setPlaying(pendingPlay.current);pendingPlay.current=false;setRunId(id=>id+1);
  },[models]);
  useEffect(()=>{
    if(!playing)return;
    let last=performance.now(),paint=last,handle=0;
    function tick(now:number){
      time.current=Math.min(duration,time.current+Math.min(.1,(now-last)/1000)*speed);
      last=now;
      if(now-paint>45||time.current>=duration){paint=now;setClock(time.current);}
      if(time.current>=duration){setPlaying(false);return;}
      handle=requestAnimationFrame(tick);
    }
    handle=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(handle);
  },[playing,duration,speed]);
  function playExperiment(experiment:typeof experiments[number]){
    const base=presets[experiment.preset];
    const motionName=experiment.motion as keyof typeof scenarios;
    pendingPlay.current=true;
    setBuildings([{...base},{...base,system:experiment.comparison??base.system}]);
    setNames([experiment.preset,experiment.preset]);
    setSettings(scenarios[motionName]);
    setScenario(motionName);
    setRecord(null);
    setCompare(Boolean(experiment.comparison));
    setEdit(0);
    setSidebar(false);
    setSelected(null);
    setCollapse(false);
    setDamage(false);
    setWire(false);
    setSection(false);
    setCameraView('Perspective');
    setCameraId(i=>i+1);
  }
  useEffect(()=>{
    if(tab!=='Simulation')return;
    function onKey(event:KeyboardEvent){
      const target=event.target;
      if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||target instanceof HTMLElement&&target.closest('input, select, textarea, button, a, summary, [contenteditable]'))return;
      if(event.code==='Space'){
        event.preventDefault();
        if(time.current>=duration){time.current=0;setClock(0);setRunId(id=>id+1);setPlaying(true);}
        else setPlaying(value=>!value);
      }
    }
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[tab,duration]);
  function update<K extends keyof Building>(key:K,value:Building[K]){
    setBuildings(previous=>previous.map((item,i)=>i===edit?{...item,[key]:value}:item));
  }
  function selectPreset(name:string){
    setNames(previous=>previous.map((item,i)=>i===edit?name:item));
    setBuildings(previous=>previous.map((item,i)=>i===edit?{...presets[name]}:item));
  }
  async function importFile(file?:File){
    if(!file)return;
    try{
      if(file.size>5_000_000)throw Error('Choose a CSV smaller than 5 MB.');
      setRecord(parseMotion(await file.text(),file.name,source));
      setError('');
    }catch(error){setError(error instanceof Error?error.message:'Could not read the CSV.');}
  }
  function download(){
    const cols=['time_s','input_ground_m_s2'];
    for(const [i,model] of models.entries()){
      const mark=i?'B':'A';
      cols.push(mark+'_site_ground_m_s2',mark+'_base_shear_N',mark+'_isolation_displacement_m');
      for(let f=1;f<=model.building.floors;f++)cols.push(mark+'_floor'+f+'_displacement_m',mark+'_floor'+f+'_velocity_m_s',mark+'_floor'+f+'_acceleration_m_s2',mark+'_floor'+f+'_drift_ratio');
    }
    const rows=motion.acceleration.map((input,i)=>[i*motion.dt,input,...models.flatMap(({result})=>{
      const s=result.samples[i];
      return [input*result.soil,s.shear,s.isolation,...s.displacement.flatMap((v,j)=>[v,s.velocity[j],s.acceleration[j],s.drift[j]])];
    })].map(v=>v.toPrecision(10)).join(','));
    const url=URL.createObjectURL(new Blob([[cols.join(','),...rows].join('\n')],{type:'text/csv'}));
    const link=document.createElement('a');link.href=url;link.download='seismonepal-response.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const model=buildings[edit];
  const inspectedBuilding=Math.min(selected?.building??0,models.length-1);
  const inspectedModel=models[inspectedBuilding];
  const inspectedFloor=Math.min(selected?.floor??inspectedModel.building.floors-1,inspectedModel.building.floors-1);
  const sample=inspectedModel.result.samples[Math.min(Math.floor(clock/motion.dt),inspectedModel.result.samples.length-1)];
  const visibleSelection=selected?{building:inspectedBuilding,floor:inspectedFloor}:null;
  return <>
    <header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('Simulation')}}><img src={import.meta.env.BASE_URL+'logo.svg'} alt=""/><span>SeismoNepal <b>3D</b><small>Structural dynamics lab</small></span></a>
      <nav aria-label="Main navigation">{(['Diagnostics','Simulation','Analytics','Nepal explorer','Learn'] as Tab[]).map(item=><button key={item} aria-current={item===tab?'page':undefined} onClick={()=>setTab(item)}>{item}</button>)}</nav>
      <button className="subtle theme" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'Light mode':'Dark mode'}</button>
    </header>
    <main className="page">
    <div className="print-report">
      <h1>SeismoNepal 3D · Educational simulation report</h1>
      <p>{motion.label} {motion.source&&' · '+motion.source} · {duration.toFixed(2)} s · direction {settings.direction}° · Δt {motion.dt} s</p>
      <p>Linear elastic shear-building model for educational use. It cannot certify whether a real building is earthquake-safe.</p>
      {models.map(({building,result},i)=><section key={i}><h2>Building {i?'B':'A'} · {names[i]}</h2><p>{building.floors} floors · {building.system} · {building.foundation} foundation · {building.soil} site</p><p>Floor height {building.height} m · plan {building.width} × {building.length} m · floor mass {building.mass} t · input stiffness {building.stiffness} MN/m · input damping {building.damping}% · first mode {result.modal[0].hz.toFixed(3)} Hz</p><ul>{metrics.map(([key,label,unit,factor])=><li key={key}>{label} {(result.peaks[key]*factor).toFixed(3)} {unit}</li>)}</ul></section>)}
    </div>
    {tab==='Diagnostics'&&<Suspense fallback={<p>Loading diagnostics…</p>}><Diagnostics/></Suspense>}
    {tab==='Simulation'&&<>
      <div className="heading"><div><h1>Simulation workspace</h1><p>Configure a building and explore how it responds to ground motion.</p></div><div className="actions"><Toggle value={sidebar} onClick={()=>setSidebar(!sidebar)}>Configuration</Toggle><Toggle value={compare} onClick={()=>{if(compare)setEdit(0);setCompare(!compare)}}>Compare buildings</Toggle></div></div>
      <section className="panel experiment-panel" aria-label="Quick experiments">
        <button className="subtle experiment-heading" aria-expanded={quickStart} onClick={()=>setQuickStart(value=>!value)}>{quickStart?'Hide quick experiments':'Show quick experiments'}</button>
        {quickStart&&<div className="experiment-grid">{experiments.map(experiment=><button key={experiment.name} onClick={()=>playExperiment(experiment)}><strong>{experiment.name}</strong><span>{experiment.description}</span></button>)}</div>}
      </section>
      <div className={'workspace '+(sidebar?'with-sidebar':'')}>
      {sidebar&&<aside className="panel config">
        <h2>Model configuration</h2>
        {compare&&<div className="segmented"><Toggle value={edit===0} onClick={()=>setEdit(0)}>Building A</Toggle><Toggle value={edit===1} onClick={()=>setEdit(1)}>Building B</Toggle></div>}
        <Select label="Illustrative building preset" value={names[edit]} options={Object.keys(presets)} onChange={selectPreset}/>
        <Select label="Lateral system" value={model.system} options={systems} onChange={v=>update('system',v as Building['system'])}/>
        <details open><summary>Structural properties</summary><div className="fields">{dimensions.map(([key,label,min,max,step])=><NumberField key={edit+key} {...{label,min,max,step}} value={model[key]} onChange={v=>update(key,v)}/>)}</div></details>
        <details><summary>Materials and site</summary>
          <Select label="Construction material (visual)" value={model.material} options={['Reinforced concrete','Stone masonry','Brick masonry','Steel']} onChange={v=>update('material',v)}/>
          <Select label="Foundation assumption" value={model.foundation} options={['Fixed','Flexible']} onChange={v=>update('foundation',v)}/>
          <Select label="Soil amplification" value={model.soil} options={['Rock','Dense','Soft']} onChange={v=>update('soil',v)}/>
          <p className="muted">Geometry and finish control appearance. Mass and stiffness are explicit solver inputs.</p>
        </details>
        <details open><summary>Ground motion</summary>
          <Select label="Synthetic scenario" value={scenario} options={Object.keys(scenarios)} onChange={v=>{setScenario(v);setSettings(scenarios[v as keyof typeof scenarios]);setRecord(null)}}/>
          {!record&&<div className="fields">
            <NumberField label="Input PGA (g)" value={settings.pga} min={.01} max={2} step={.01} onChange={pga=>setSettings(prev=>({...prev,pga}))}/>
            <NumberField label="Frequency (Hz)" value={settings.hz} min={.1} max={10} step={.05} onChange={hz=>setSettings(prev=>({...prev,hz}))}/>
            <NumberField label="Duration (s)" value={settings.seconds} min={3} max={90} step={1} onChange={seconds=>setSettings(prev=>({...prev,seconds}))}/>
          </div>}
          <NumberField label="Shaking direction (°)" value={settings.direction} min={0} max={360} step={1} onChange={direction=>setSettings(prev=>({...prev,direction}))}/>
          <label className="field">Recording source<input type="text" value={source} onChange={e=>setSource(e.target.value)} placeholder="Station or archive URL"/></label>
          <label className="field">Import recording CSV<input type="file" accept=".csv,text/csv" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label>
          <p className="muted"><code>time_s,accel_m_s2</code> or <code>time_s,accel_g</code></p>
          {record&&<button onClick={()=>setRecord(null)}>Use synthetic motion</button>}{error&&<p role="alert" className="error">{error}</p>}
        </details>
      </aside>}
      <div className="work-main">
        <section className="panel viewport" ref={viewport} aria-label="Interactive structural model">
          <div className="viewport-head"><div><h2>Structural model</h2><p>{compare?'A · '+models[0].building.system+'  /  B · '+models[1].building.system:model.system} · {motion.label}</p></div><button className="subtle" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else viewport.current?.requestFullscreen?.().catch(()=>setViewError('Fullscreen is unavailable.'))}}>Fullscreen</button></div>
          <div className="canvas-wrap"><Suspense fallback={<div className="loading">Loading 3D scene…</div>}><Scene {...{models,time,dt:motion.dt,direction:settings.direction,scale,wire,section,demand,damage,collapse,playing,runId,cameraId,cameraView,selected:visibleSelection,onFloor:(building:number,floor:number)=>setSelected({building,floor})}}/></Suspense>
            <div className="view-key">{demand&&<span className="demand-key">Drift demand <i/> 0–2.5%+</span>}{collapse?<span>Scripted collapse · independent of calculated response</span>:damage&&<span>Illustrative cracking and debris</span>}<span>Drag to orbit · scroll to zoom · use Section to see inside</span></div>
          </div>
          {viewError&&<p className="error" role="status">{viewError}</p>}<div className="view-tools"><Toggle value={wire} onClick={()=>setWire(!wire)}>Wireframe</Toggle><Toggle value={section} onClick={()=>setSection(!section)}>Section cutaway</Toggle><Toggle value={demand} onClick={()=>setDemand(!demand)}>Drift overlay</Toggle><Toggle value={damage} onClick={()=>setDamage(!damage)}>Visual damage</Toggle><Toggle value={collapse} onClick={()=>{setCollapse(!collapse);restart(playing)}}>Collapse demo</Toggle><label>Camera <select aria-label="Camera view" value={cameraView} onChange={e=>setCameraView(e.target.value as CameraView)}>{['Perspective','Front','Overhead'].map(view=><option key={view}>{view}</option>)}</select></label><button className="subtle" onClick={()=>{setCameraView('Perspective');setCameraId(i=>i+1)}}>Reset camera</button><label>Deformation <select aria-label="Deformation multiplier" value={scale} onChange={e=>setScale(+e.target.value)}>{[1,5,15,30,60].map(n=><option value={n} key={n}>{n}×</option>)}</select></label></div>
        </section>
        <section className="panel playback" aria-label="Playback controls"><div className="play-buttons"><button className="primary" title="Space pauses or resumes playback" onClick={()=>{if(!playing&&time.current>=duration)restart(true);else setPlaying(!playing)}}>{playing?'Pause':'Play simulation'}</button><button onClick={()=>restart(playing)}>Restart</button></div>
          <label className="scrubber"><span>{clock.toFixed(2)} / {duration.toFixed(2)} s</span><input aria-label="Simulation time" type="range" min={0} max={duration} step={motion.dt} value={clock} onChange={e=>{setPlaying(false);seek(+e.target.value)}}/></label>
          <label className="speed">Speed <select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.25,.5,1,1.5,2,4].map(n=><option value={n} key={n}>{n}×</option>)}</select></label>
        </section>
        <section className="panel floor-inspector" aria-label="Live floor response">
          <div><h2>Live floor response</h2><p className="muted">At {clock.toFixed(2)} s</p></div>
          <div className="inspector-controls">
            {compare&&<label>Building <select value={inspectedBuilding} onChange={e=>setSelected({building:+e.target.value,floor:inspectedFloor})}><option value={0}>A</option><option value={1}>B</option></select></label>}
            <label>Floor <select aria-label="Inspect floor" value={inspectedFloor} onChange={e=>setSelected({building:inspectedBuilding,floor:+e.target.value})}>{sample.displacement.map((_,i)=><option key={i} value={i}>{i+1}{i===sample.displacement.length-1?' · Roof':''}</option>)}</select></label>
          </div>
          <dl><div><dt>Displacement</dt><dd>{(sample.displacement[inspectedFloor]*1000).toFixed(1)} mm</dd></div><div><dt>Acceleration</dt><dd>{(sample.acceleration[inspectedFloor]/G).toFixed(2)} g</dd></div><div><dt>Storey drift</dt><dd>{(sample.drift[inspectedFloor]*100).toFixed(2)}%</dd></div></dl>
        </section>
        <section className="metrics">{metrics.map(([key,label,unit,factor])=><div className="panel metric" key={key}><span>{label}</span><strong>{compare&&<small>A </small>}{(models[0].result.peaks[key]*factor).toFixed(2)} <small>{unit}</small></strong>
        {compare&&<p>B {(models[1].result.peaks[key]*factor).toFixed(2)} {unit} · Δ {((models[1].result.peaks[key]-models[0].result.peaks[key])*factor).toFixed(2)} {unit}</p>}</div>)}</section>
      </div></div>
    </>}
    {tab==='Analytics'&&<><div className="heading"><div><h1>Engineering analytics</h1><p>{motion.label} · {compare?'Building A vs. B':'Building A'}</p></div><div className="actions"><button onClick={download}>Export CSV</button><button className="primary" onClick={()=>window.print()}>Print report</button></div></div><Suspense fallback={<p>Loading charts…</p>}><Analytics {...{models,motion,clock,theme}}/></Suspense></>}
    {tab==='Nepal explorer'&&<Suspense fallback={<p>Loading earthquake catalog…</p>}><Explorer/></Suspense>}
    {tab==='Learn'&&<Suspense fallback={<p>Loading learning guide…</p>}><Learn/></Suspense>}
    <footer>Educational simulation. This application cannot certify whether a real building is earthquake-safe.</footer>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
