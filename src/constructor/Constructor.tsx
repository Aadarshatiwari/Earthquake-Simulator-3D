import {Component,lazy,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {assembleModel} from '../engine';
import {generate,type Part} from './geometry';
import {editHistory,materials,moveHistory,numberLimits,presetConfig,presets,readLibrary,readProject,resize,toModel,validateConfig,writeProject,type Config,type History,type Level,type Project} from './model';
import type {ConstructorResult} from './analysis';
import {cameras,environments,qualities,views,type Options} from './viewOptions';
import './constructor.css';

const Viewport=lazy(()=>import('./Viewport'));
const storageKey='seismonepal-projects-v1';
const defaultOptions:Options={view:'Architectural',camera:'Perspective',quality:'Automatic',environment:'Kathmandu neighbourhood',floor:0,gap:.9,clip:.54,axis:'Depth',ghost:false,exaggeration:8,details:true};
const fresh=():Project=>({version:1,id:crypto.randomUUID(),name:'Concrete residence',config:presetConfig('Concrete residence')});
const geometryFields=[
  ['width','Plan width (m)',.25],['length','Plan depth (m)',.25],['baysX','Bays across',1],['baysZ','Bays deep',1],
  ['columnWidth','Column width (m)',.05],['columnDepth','Column depth (m)',.05],['beamWidth','Beam width (m)',.05],['beamDepth','Beam depth (m)',.05],
  ['slab','Slab thickness (m)',.025],['wall','Wall thickness (m)',.025],['footing','Footing depth (m)',.05],['overhang','Footing extension (m)',.05],
  ['glazing','Window width fraction',.05],['entryBay','Front entry bay',1],['reinforcementBay','Reinforcement bay',1],
] as const;
const presetTraits=['Stone walls · pitched roof','Exposed brick · timber windows','Concrete frame · balconies','Open ground-floor parking','Broad glazing · eight storeys','Exposed steel diagonals','Interior concrete wall','Visible isolation bearings'];
const panels=['Presets','Geometry','Analysis','View','Projects'] as const;
type Panel=typeof panels[number];
function NumberInput({label,value,min,max,step,change}:{label:string;value:number;min:number;max:number;step:number;change:(n:number)=>boolean|void}){
  return <label>{label}<input key={value} aria-label={label} type="number" defaultValue={value} inputMode={step===1?'numeric':'decimal'} min={min} max={max} step={step}
    onBlur={e=>{
      const n=e.currentTarget.valueAsNumber;
      const accepted=Number.isFinite(n)&&n>=min&&n<=max&&(step!==1||Number.isInteger(n))&&change(n)!==false;
      e.currentTarget.value=String(accepted?n:value);
    }} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
function Choice<T extends string>({label,value,choices,change}:{label:string;value:T;choices:readonly T[];change:(s:T)=>void}){
  return <label>{label}<select value={value} onChange={e=>change(e.target.value as T)}>{choices.map(item=><option key={item}>{item}</option>)}</select></label>;
}
function Check({label,value,change}:{label:string;value:boolean;change:(v:boolean)=>void}){
  return <label className="build-check"><input type="checkbox" checked={value} onChange={e=>change(e.target.checked)}/>{label}</label>;
}
class SceneBoundary extends Component<{children:ReactNode;recover:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="constructor-fallback"><p>Unable to start WebGL. Configuration and project tools are still available.</p><button onClick={this.props.recover}>Retry graphics</button></div>:this.props.children;}
}
export default function Constructor({active,onContinue}:{active:boolean;onContinue?:(project:Project)=>void}){
  const [history,setHistory]=useState<History>(()=>({past:[],current:fresh(),future:[]}));
  const [panel,setPanel]=useState<Panel>('Presets');
  const [expanded,setExpanded]=useState(true);
  const [initialLibrary]=useState(()=>{
    try{return {projects:readLibrary(localStorage.getItem(storageKey)??'[]'),warning:''};}
    catch{return {projects:[] as Project[],warning:'The saved project library could not be read. Export important projects as JSON.'};}
  });
  const [library,setLibrary]=useState(initialLibrary.projects);
  const [notice,setNotice]=useState(initialLibrary.warning);
  const [deletion,setDeletion]=useState<Project|null>(null);
  const [options,setOptions]=useState(defaultOptions);
  const [storedSelection,setSelected]=useState<string|null>(null);
  const [partType,setPartType]=useState<Part['type']>('Column');
  const [level,setLevel]=useState(0);
  const [modeIndex,setModeIndex]=useState(0);
  const [fit,setFit]=useState(0);
  const [contextKey,setContextKey]=useState(0);
  const [lost,setLost]=useState(false);
  const [fps,setFps]=useState(0);
  const [motion,setMotion]=useState<'modal'|'seismic'|null>(null);
  const [playing,setPlaying]=useState(false);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<ConstructorResult|null>(null);
  const [clock,setClock]=useState(0);
  const [speed,setSpeed]=useState(1);
  const time=useRef(0);
  const stage=useRef<HTMLDivElement>(null);
  const worker=useRef<Worker|null>(null);
  const {current}=history;
  const {config}=current;
  const geometry=useMemo(()=>generate(config),[config]);
  const analytical=useMemo(()=>assembleModel(toModel(config)),[config]);
  const activeLevel=Math.min(level,config.levels.length-1);
  const mode=analytical.modes[Math.min(modeIndex,analytical.modes.length-1)];
  const selected=geometry.parts.find(part=>part.id===storedSelection);
  const duration=motion==='modal'?10:result?.diagnostics.duration??0;

  function stop(){
    worker.current?.terminate();worker.current=null;
    setBusy(false);setResult(null);setMotion(null);setPlaying(false);time.current=0;setClock(0);setFps(0);
  }
  useEffect(()=>()=>worker.current?.terminate(),[]);
  useEffect(()=>{if(!active)setPlaying(false);},[active]);
  useEffect(()=>{
    const pause=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',pause);
    return ()=>document.removeEventListener('visibilitychange',pause);
  },[]);
  useEffect(()=>{
    if(!playing||lost||!active)return;
    let handle=0,last=performance.now(),paint=last;
    const tick=(now:number)=>{
      const next=time.current+Math.min(.075,(now-last)/1000)*speed;
      last=now;
      time.current=motion==='modal'?next%duration:Math.min(duration,next);
      if(now-paint>75||time.current>=duration){setClock(time.current);paint=now;}
      if(motion==='seismic'&&next>=duration){setPlaying(false);return;}
      handle=requestAnimationFrame(tick);
    };
    handle=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(handle);
  },[playing,lost,speed,duration,motion,active]);
  function apply(config:Config){
    try{validateConfig(config);assembleModel(toModel(config));}catch(e){setNotice(e instanceof Error?e.message:String(e));return false;}
    stop();setNotice('');
    setHistory(previous=>editHistory(previous,{...previous.current,config}));
    return true;
  }
  function change<K extends keyof Config>(key:K,value:Config[K]){
    const updated={...config,[key]:value};
    if(key==='baysX'){updated.entryBay=Math.min(updated.entryBay,updated.baysX);updated.reinforcementBay=Math.min(updated.reinforcementBay,updated.baysX);}
    return apply(updated);
  }
  function setStorey(key:keyof Level,value:number){
    return apply({...config,levels:config.levels.map((storey,i)=>i===activeLevel?{...storey,[key]:value}:storey)});
  }
  function changeOption<K extends keyof Options>(key:K,value:Options[K]){
    setOptions(old=>({...old,[key]:value}));
    if(key==='view'){
      if(value==='Mode shape'){
        worker.current?.terminate();worker.current=null;setBusy(false);
        time.current=0;setClock(0);setMotion('modal');setPlaying(true);setNotice('Undamped eigenmode · normalized shape, illustrative playback speed.');
      }else if(motion==='modal'){setPlaying(false);setMotion(null);time.current=0;setClock(0);}
    }
  }
  function load(project:Project){
    try{assembleModel(toModel(project.config));}catch(e){setNotice(String(e));return;}
    stop();setSelected(null);setLevel(0);setModeIndex(0);setNotice('Loaded '+project.name+'.');
    setHistory(old=>editHistory(old,project));setFit(n=>n+1);
  }
  function store(projects:Project[]){
    try{localStorage.setItem(storageKey,JSON.stringify(projects));setLibrary(projects);return true;}
    catch{setNotice('Local storage is unavailable or full. Export the project as JSON.');return false;}
  }
  function save(asCopy=false){
    const project=asCopy?{...current,id:crypto.randomUUID(),name:(current.name.slice(0,63)+' copy')}:current;
    const next=library.some(p=>p.id===project.id)?library.map(p=>p.id===project.id?project:p):[project,...library];
    if(next.length>40){setNotice('The local library holds at most 40 projects.');return;}
    if(store(next)){
      if(asCopy)setHistory(old=>editHistory(old,project));
      setNotice('Saved '+project.name+' on this device.');
    }
  }
  async function importFile(file?:File){
    if(!file)return;
    try{if(file.size>200000)throw Error('Project exceeds 200 KB.');load(readProject(await file.text()));}
    catch(e){setNotice(e instanceof Error?e.message:String(e));}
  }
  function exportFile(){
    const url=URL.createObjectURL(new Blob([writeProject(current)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='seismonepal-building.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function startSimulation(){
    stop();setBusy(true);setNotice('Calculating response to a synthetic 0.28 g pulse…');
    try{
      const instance=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      worker.current=instance;
      const finish=()=>{
        instance.terminate();worker.current=null;setBusy(false);
      };
      instance.onmessage=({data}:{data:{result?:ConstructorResult;error?:string}})=>{
        if(worker.current!==instance)return;
        finish();
        if(!data.result){setNotice(data.error??'The solver returned no result.');return;}
        setNotice('Synthetic 0.28 g pulse · 16 s');setResult(data.result);setMotion('seismic');setPlaying(true);
        setOptions(old=>old.view==='Mode shape'?{...old,view:'Structural skeleton'}:old);
      };
      instance.onerror=()=>{if(worker.current!==instance)return;finish();setNotice('Simulation worker could not start.');};
      instance.postMessage(toModel(config));
    }catch(e){setBusy(false);setNotice(String(e));}
  }
  function seek(value:number){time.current=value;setClock(value);}
  function togglePlay(){
    if(!motion||!duration)return;
    if(!playing&&time.current>=duration)seek(0);
    setPlaying(old=>!old);
  }
  function selectPart(part:Part){
    setSelected(part.id);
    if(part.storey>=0)setLevel(part.storey);
  }
  const viewOptions={...options,floor:Math.min(options.floor,config.levels.length-1)};
  const stamp=result&&motion==='seismic'?result.peak:null;
  return <div className="constructor" hidden={!active}>
    <header className="constructor-heading">
      <div><h1>Building constructor</h1><p>Model a structure, inspect its frame, and run a seismic test.</p></div>
      <div className="constructor-actions">
        <button onClick={()=>{if(history.past.length){stop();setHistory(old=>moveHistory(old,'undo'));}}} disabled={!history.past.length}>Undo</button>
        <button onClick={()=>{if(history.future.length){stop();setHistory(old=>moveHistory(old,'redo'));}}} disabled={!history.future.length}>Redo</button>
        <button onClick={()=>save()}>Save project</button>
        <button className="build-primary" disabled={busy} onClick={()=>onContinue?onContinue(current):startSimulation()}>{busy?'Computing…':'Continue to simulation'}</button>
      </div>
    </header>
    <div className="constructor-layout">
      <section className="build-stage" ref={stage} aria-label="Building viewport">
        <div className="viewport-title"><div><strong>{current.name}</strong><p>{config.levels.length} {config.levels.length===1?'storey':'storeys'} · {config.width} × {config.length} m · {geometry.height.toFixed(1)} m tall</p></div>
          <button onClick={()=>setFit(n=>n+1)}>Fit view</button><button onClick={async()=>{
            try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.current?.requestFullscreen();}
            catch{setNotice('Fullscreen is unavailable in this browser.');}
          }}>Fullscreen</button>
        </div>
        <div className="build-canvas">
          <SceneBoundary key={contextKey} recover={()=>{setLost(false);setContextKey(n=>n+1);}}>
            <Suspense fallback={<div className="constructor-fallback">Loading 3D viewport…</div>}>
              {active&&<Viewport {...{geometry,config,options:viewOptions,selected:storedSelection,onSelect:selectPart,fit,time,mode,result,motion,playing:playing&&!lost,onLost:setLost,onFps:setFps}}/>}
            </Suspense>
          </SceneBoundary>
          {lost&&<div className="constructor-fallback"><p>Graphics context interrupted.</p><button onClick={()=>{setLost(false);setContextKey(n=>n+1);}}>Restore graphics</button></div>}
          <div className="build-hud"><span>{options.view}</span>{playing&&fps>0&&<span>{fps} FPS</span>}<span>{motion?'Visual scale '+options.exaggeration+'×':'Drag to orbit · pinch to zoom'}</span></div>
        </div>
        <div className="build-bar">
          <Choice label="View mode" value={options.view} choices={views} change={v=>changeOption('view',v)}/>
          <Choice label="Camera" value={options.camera} choices={cameras} change={v=>changeOption('camera',v)}/>
          <Choice label="Graphics" value={options.quality} choices={qualities} change={v=>changeOption('quality',v)}/>
        </div>
        {motion&&<div className="build-playback">
          <button onClick={togglePlay}>{playing?'Pause':'Play'}</button>
          <button onClick={()=>{seek(0);setPlaying(false);}}>Reset time</button>
          <label className="build-time">{clock.toFixed(2)} / {duration.toFixed(1)} s<input type="range" aria-label="Playback time" min={0} max={duration} step={.005} value={clock} onChange={e=>{setPlaying(false);seek(+e.target.value);}}/></label>
          <label>Speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.25,.5,1,2].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
        </div>}
        {stamp&&<dl className="build-peaks"><div><dt>Roof motion</dt><dd>{(stamp.roofDisplacement*1000).toFixed(1)} mm</dd></div><div><dt>Peak drift</dt><dd>{(stamp.drift*100).toFixed(2)}%</dd></div><div><dt>Base shear</dt><dd>{(stamp.baseShear/1000).toFixed(1)} kN</dd></div></dl>}
        {selected&&<div className="part-card">
          <div><h2>{selected.type} <small>{selected.id}</small></h2><p>{selected.surface} · {selected.size.map(n=>n.toFixed(2)).join(' × ')} m · {selected.storey>=0?'Storey '+(selected.storey+1):'Foundation'}</p>
          {selected.storey>=0&&<p>Storey inputs · {config.levels[selected.storey].massKg.toLocaleString()} kg · {config.levels[selected.storey].stiffnessNPerM.toLocaleString()} N/m</p>}</div>
          <button onClick={()=>{setPanel('Geometry');setExpanded(true);}}>Edit geometry</button><button onClick={()=>setSelected(null)}>Clear</button>
        </div>}
      </section>
      <aside className="build-panel">
        <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
          <summary>Building controls</summary>
          <div className="build-tabs" aria-label="Constructor controls">{panels.map(label=><button key={label} aria-pressed={panel===label} onClick={()=>setPanel(label)}>{label}</button>)}</div>
          {panel==='Presets'&&<>
            <div className="build-counter"><strong>Storeys</strong><button aria-label="Remove storey" disabled={config.levels.length===1} onClick={()=>apply(resize(config,config.levels.length-1))}>−</button><output>{config.levels.length}</output><button aria-label="Add storey" disabled={config.levels.length===20} onClick={()=>apply(resize(config,config.levels.length+1))}>+</button></div>
            <div className="build-presets">{presets.map((preset,i)=><button key={preset} aria-pressed={config.preset===preset} onClick={()=>{if(apply(presetConfig(preset))){setHistory(old=>({...old,current:{...old.current,name:preset}}));setSelected(null);setFit(v=>v+1);}}}><strong>{preset}</strong><small>{presetTraits[i]}</small></button>)}</div>
          </>}
          {panel==='Geometry'&&<>
            <div className="build-fields">
              <NumberInput label="Storey count" value={config.levels.length} min={1} max={20} step={1} change={value=>apply(resize(config,value))}/>
              {geometryFields.map(([key,label,step])=><NumberInput key={key} label={label} value={config[key]} min={numberLimits[key][0]} max={key==='entryBay'||key==='reinforcementBay'?config.baysX:numberLimits[key][1]} step={step} change={value=>change(key,value)}/>)}
              <Choice label="Roof style" value={config.roof} choices={['Flat','Gable']} change={v=>change('roof',v)}/>
              <Choice label="Exterior material" value={config.finish} choices={materials} change={v=>change('finish',v)}/>
              <Choice label="Window sides" value={config.windows} choices={['All sides','Front and rear','Front only']} change={v=>change('windows',v)}/>
              <Choice label="Visible reinforcement" value={config.reinforcement} choices={['None','Bracing','Shear walls']} change={v=>change('reinforcement',v)}/>
            </div>
            <Check label="Balconies" value={config.balconies} change={v=>change('balconies',v)}/>
            <Check label="Interior stairs" value={config.stairs} change={v=>change('stairs',v)}/>
            <Check label="Open ground floor" value={config.openGround} change={v=>change('openGround',v)}/>
          </>}
          {panel==='Analysis'&&<>
            <p className="build-note">Mass and stiffness are explicit educational inputs. Appearance and member dimensions do not calculate stiffness.</p>
            <label>Analytical storey<select value={activeLevel} onChange={e=>setLevel(+e.target.value)}>{config.levels.map((_,i)=><option key={i} value={i}>Storey {i+1}</option>)}</select></label>
            <div className="build-fields">
              <NumberInput label="Storey height (m)" value={config.levels[activeLevel].heightM} min={2.3} max={6} step={.05} change={v=>setStorey('heightM',v)}/>
              <NumberInput label="Storey mass (kg)" value={config.levels[activeLevel].massKg} min={1000} max={1e7} step={100} change={v=>setStorey('massKg',v)}/>
              <NumberInput label="Storey stiffness (N/m)" value={config.levels[activeLevel].stiffnessNPerM} min={1e4} max={1e10} step={10000} change={v=>setStorey('stiffnessNPerM',v)}/>
              <NumberInput label="Target damping (%)" value={config.damping} min={0} max={30} step={.25} change={v=>change('damping',v)}/>
            </div>
            <Check label="Linear isolation bearing" value={config.isolation} change={v=>change('isolation',v)}/>
            {config.isolation&&<div className="build-fields">
              <NumberInput label="Bearing level mass (kg)" value={config.bearingMass} min={1000} max={1e7} step={100} change={v=>change('bearingMass',v)}/>
              <NumberInput label="Bearing stiffness (N/m)" value={config.bearingStiffness} min={1e4} max={1e10} step={10000} change={v=>change('bearingStiffness',v)}/>
            </div>}
            {config.openGround&&config.levels.length>1&&config.levels[0].stiffnessNPerM>=config.levels[1].stiffnessNPerM&&<p className="build-note">The open ground floor has no reduced analytical stiffness. Set its spring value explicitly for a soft-storey study.</p>}
            <label>Natural mode<select value={Math.min(modeIndex,analytical.modes.length-1)} onChange={e=>setModeIndex(+e.target.value)}>{analytical.modes.map((m,i)=><option key={i} value={i}>{i+1} · {m.hz.toFixed(3)} Hz</option>)}</select></label>
            <button onClick={()=>changeOption('view','Mode shape')}>Animate mode shape</button>
            <p className="build-note">{mode.period.toFixed(3)} s period · {(100*mode.effectiveMassRatio).toFixed(1)}% effective mass</p>
          </>}
          {panel==='View'&&<>
            <Choice label="Environment" value={options.environment} choices={environments} change={v=>changeOption('environment',v)}/>
            {options.view==='Material inspection'&&<>
              <label>Component type<select value={partType} onChange={e=>setPartType(e.target.value as Part['type'])}>{[...new Set(geometry.parts.map(part=>part.type))].map(type=><option key={type}>{type}</option>)}</select></label>
              <label>Component<select value={storedSelection??''} onChange={e=>setSelected(e.target.value||null)}><option value="">Select a component</option>{geometry.parts.filter(part=>part.type===partType).map(part=><option value={part.id} key={part.id}>{part.id}</option>)}</select></label>
            </>}
            <Check label="Landscape details"  value={options.details} change={v=>changeOption('details',v)}/>
            <Check label="Undeformed frame overlay" value={options.ghost} change={v=>changeOption('ghost',v)}/>
            <label>Deformation ({options.exaggeration}×)<input type="range" min={1} max={35} value={options.exaggeration} onChange={e=>changeOption('exaggeration',+e.target.value)}/></label>
            <label>Floor separation ({options.gap.toFixed(1)} m)<input type="range" min={0} max={4} step={.1} value={options.gap} onChange={e=>{changeOption('view','Exploded');changeOption('gap',+e.target.value);}}/></label>
            <Choice label="Section axis" value={options.axis} choices={['Width','Depth','Height']} change={v=>{changeOption('view','Section');changeOption('axis',v);}}/>
            <label>Section position<input type="range" min={0} max={1} step={.01} value={options.clip} onChange={e=>{changeOption('view','Section');changeOption('clip',+e.target.value);}}/></label>
            <label>Isolated floor<select value={viewOptions.floor} onChange={e=>{changeOption('view','Floor isolation');changeOption('floor',+e.target.value);}}>{config.levels.map((_,i)=><option key={i} value={i}>Storey {i+1}</option>)}</select></label>
          </>}
          {panel==='Projects'&&<>
            <label>Building name<input maxLength={70} key={current.name} defaultValue={current.name} onBlur={e=>{
              const name=e.target.value.trim();if(name)setHistory(old=>editHistory(old,{...old.current,name}));
              else e.currentTarget.value=current.name;
            }} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
            <div className="constructor-actions"><button onClick={()=>load(fresh())}>New</button><button onClick={()=>save(true)}>Duplicate</button>
              <button onClick={()=>apply(presetConfig(config.preset))}>Reset building</button><button onClick={exportFile}>Export JSON</button></div>
            <label>Import project JSON<input type="file" accept=".json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.currentTarget.value='';}}/></label>
            {library.length===0&&<p className="build-note">No saved projects on this device.</p>}
            <ul className="build-projects">{library.map(p=><li key={p.id}><button onClick={()=>load(p)}>{p.name}</button><button aria-label={'Delete '+p.name} onClick={()=>setDeletion(p)}>Delete</button></li>)}</ul>
            {deletion&&<section className="build-confirm" aria-label="Confirm project removal"><p>Delete “{deletion.name}” from this device?</p><button onClick={()=>{if(store(library.filter(p=>p.id!==deletion.id)))setNotice('Deleted '+deletion.name+'.');setDeletion(null);}}>Delete saved project</button><button onClick={()=>setDeletion(null)}>Cancel</button></section>}
          </>}
        </details>
      </aside>
    </div>
    <p className="build-notice" role="status">{notice}</p>
    <p className="build-note">Illustrative Nepal-inspired architecture. The solver models one lateral degree of freedom per storey. It does not calculate member stresses, damage, or building-code compliance.</p>
  </div>;
}
