import {Component,lazy,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {assembleModel,importCsv} from '../engine';
import {floorDisplacement,generate,type Part} from '../constructor/geometry';
import {presetConfig,presets,readLibrary,resize,toModel,type Config,type Level,type Project} from '../constructor/model';
import {cameras,environments,qualities,type Options} from '../constructor/viewOptions';
import {channels,heatChoices,heatMagnitude,heatStops,heatUnits,peakAt,scaleFor,type Heat} from './controller';
import {defaults,forms,G,scenarios,validateMotion,type MotionSettings,type Recording} from './motion';
import {checkedOutput,deleteScenario,listScenarios,loadScenario,readScenario,saveScenario,type Scenario} from './projects';
import type {Job} from './jobs';
import {responseCsv} from './export';
import {useRun} from './useRun';
import Waveform from './Waveform';
import {useFullscreen} from '../ui/useFullscreen';
import './simulator.css';

const Viewport=lazy(()=>import('../constructor/Viewport'));
const ResultsChart=lazy(()=>import('./Charts').then(x=>({default:x.ResultsChart})));
const ResonanceChart=lazy(()=>import('./Charts').then(x=>({default:x.ResonanceChart})));
const optionsDefault:Options={view:'Architectural',camera:'Perspective',quality:'Automatic',environment:'Kathmandu neighbourhood',floor:0,gap:0,clip:.5,axis:'Depth',ghost:false,exaggeration:8,details:true};
const fresh=(preset:Config['preset']='Concrete residence'):Project=>({version:1,id:crypto.randomUUID(),name:preset,config:presetConfig(preset)});
const labFields=[['pgaG','Target PGA (g)',0,2,.01],['duration','Duration (s)',1,120,.5],['dt','Time step (s)',.001,.1,.001],['hz','Dominant frequency (Hz)',.1,20,.01],['bandwidth','Frequency spread',0,2,.05],['seed','Random seed',0,4294967295,1],['direction','Direction (°)',0,360,1]] as const;
function NumberInput({label,value,min,max,step,change}:{label:string;value:number;min:number;max:number;step:number;change:(n:number)=>void}){
  return <label>{label}<input type="number" key={value} defaultValue={value} min={min} max={max} step={step} onBlur={e=>{const n=e.target.valueAsNumber;const valid=Number.isFinite(n)&&n>=min&&n<=max;e.target.value=String(valid?n:value);if(valid&&n!==value)change(n);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
function Select<T extends string>({label,value,values,change}:{label:string;value:T;values:readonly T[];change:(v:T)=>void}){
  return <label>{label}<select value={value} onChange={e=>change(e.target.value as T)}>{values.map(v=><option key={v}>{v}</option>)}</select></label>;
}
function Flag({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){
  return <label className="quake-flag"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>;
}
class GraphicsBoundary extends Component<{children:ReactNode;retry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="constructor-fallback"><p>3D graphics are unavailable. Playback and numerical tools remain available.</p><button onClick={this.props.retry}>Retry graphics</button></div>:this.props.children;}
}
function displayNumber(value:number){
  const magnitude=Math.abs(value);
  if(magnitude!==0&&(magnitude<.001||magnitude>=1e7))return value.toExponential(4);
  return value.toLocaleString('en-US',{maximumSignificantDigits:5});
}
function download(parts:BlobPart[],type:string,file:string){
  const url=URL.createObjectURL(new Blob(parts,{type})),link=document.createElement('a');
  link.href=url;link.download=file;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type Seed={project?:Project;recording?:Recording;direction?:number;serial:number}|null;
export default function Simulator({active,seed,onDamage}:{active:boolean;seed:Seed;onDamage:()=>void}){
  const [a,setA]=useState<Project>(()=>fresh());
  const [b,setB]=useState<Project>(()=>fresh('Soft storey'));
  const [comparison,setComparison]=useState(false);
  const [edit,setEdit]=useState<0|1>(0);
  const [floor,setFloor]=useState(0);
  const [scenario,setScenario]=useState('Moderate amplitude');
  const [settings,setSettings]=useState(defaults);
  const [recording,setRecording]=useState<Recording>();
  const [source,setSource]=useState('');
  const [speed,setSpeed]=useState(1);
  const [loop,setLoop]=useState(false);
  const [volume,setVolume]=useState(.25);
  const [haptic,setHaptic]=useState(false);
  const [options,setOptions]=useState(optionsDefault);
  const [fit,setFit]=useState(0);
  const [fps,setFps]=useState(0);
  const [lost,setLost]=useState(false);
  const [graphicsKey,setGraphicsKey]=useState(0);
  const [selected,setSelected]=useState<{building:number;id:string}|null>(null);
  const [heat,setHeat]=useState<Heat>('Drift');
  const [manual,setManual]=useState(false);
  const [heatLimit,setHeatLimit]=useState(1);
  const [showGround,setShowGround]=useState(true);
  const [waves,setWaves]=useState(false);
  const [modeIndex,setModeIndex]=useState(0);
  const [sheet,setSheet]=useState<'Motion'|'Building'|'View'|'Saved'>('Motion');
  const [expanded,setExpanded]=useState(true);
  const [resultTab,setResultTab]=useState<'Live'|'Results'|'Resonance'>('Live');
  const [savedIds,setSavedIds]=useState<{id:string;name:string}[]>([]);
  const [id,setId]=useState<string>(()=>crypto.randomUUID());
  const [name,setName]=useState('Earthquake study');
  const [includeResults,setIncludeResults]=useState(true);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const stage=useRef<HTMLDivElement>(null);
  const fullscreen=useFullscreen(stage,active);
  const resultRef=useRef<HTMLDivElement>(null);
  const asyncGeneration=useRef(0);
  const appliedSeed=useRef(0);
  const viewportOptions=useMemo(()=>({...options,floor}),[options,floor]);
  const run=useRun(active,speed,loop,volume,haptic);
  const job=useMemo<Job>(()=>({buildings:comparison?[a,b]:[a],settings,recording:settings.form==='Imported CSV'?recording:undefined}),[a,b,comparison,settings,recording]);
  const models=useMemo(()=>job.buildings.map(x=>toModel(x.config)),[a,b,comparison]);
  const modal=useMemo(()=>models.map(m=>assembleModel(m).modes),[models]);
  const geoA=useMemo(()=>generate(a.config),[a.config]);
  const geoB=useMemo(()=>generate(b.config),[b.config]);
  const current=edit===1&&comparison?b:a;
  const curatedFloor=Math.min(floor,current.config.levels.length-1);
  const currentMode=modal[edit===1&&comparison?1:0][Math.min(modeIndex,modal[edit===1&&comparison?1:0].length-1)];
  const outcome=run.output;
  const sharedScale=useMemo(()=>scaleFor(outcome?.results??[],heat),[outcome,heat]);
  const peak=useMemo(()=>outcome?peakAt(outcome.results[0],'roof'):null,[outcome]);
  const floorAccelerationPeaks=useMemo(()=>outcome?.results.map((r,i)=>{
    let peak=0;
    const n=r.structure.mass.length;
    for(let j=0;j<r.traces.absoluteAcceleration.length;j++)if(j%n>=outcome.offsets[i])peak=Math.max(peak,Math.abs(r.traces.absoluteAcceleration[j]));
    return peak/G;
  })??[],[outcome]);
  const modelPeaks=useMemo(()=>outcome?.results.map((r,i)=>peakAt(r,'drift',outcome.offsets[i]).value)??[],[outcome]);
  function clear(){run.restore(null);}
  useEffect(()=>{
    if(!seed||seed.serial===appliedSeed.current)return;
    appliedSeed.current=seed.serial;
    setEdit(0);setFloor(0);setSelected(null);setId(crypto.randomUUID());
    setResultTab('Live');run.restore(null);
    if(seed.project){
      setA(seed.project);setName(seed.project.name+' earthquake study');setSheet('Motion');
      run.setNotice('Loaded '+seed.project.name+' from Build & test.');
    }else{
      setName(seed.recording?.label??'Synthetic educational exercise');
      setRecording(seed.recording);setScenario(seed.recording?'Custom':'Moderate amplitude');setSheet(seed.recording?'Building':'Motion');
      setSettings({...defaults,form:seed.recording?'Imported CSV':defaults.form,direction:seed.direction??0});
      run.setNotice(seed.recording?'Loaded '+seed.recording.label+'. Choose a building and calculate its response.':'Synthetic educational exercise. No historical record is attached.');
    }

  },[seed]);
  useEffect(()=>()=>{asyncGeneration.current++;},[]);
  async function refresh(){
    try{
      setSavedIds(await listScenarios());
    }catch{run.setNotice('Local simulation storage is unavailable. Export configuration as JSON.');}
  }
  useEffect(()=>{if(active&&sheet==='Saved')void refresh();},[active,sheet]);
  function changeSettings<K extends keyof MotionSettings>(key:K,value:MotionSettings[K]){
    clear();setScenario('Custom');setSettings(old=>({...old,[key]:value}));
  }
  function updateBuilding(project:Project){
    try{assembleModel(toModel(project.config));}
    catch(e){run.setNotice(e instanceof Error?e.message:String(e));return false;}
    clear();(edit===1&&comparison?setB:setA)(project);
    setSelected(null);return true;
  }
  function updateLevel(key:keyof Level,value:number){
    updateBuilding({...current,config:{...current.config,levels:current.config.levels.map((item,i)=>i===curatedFloor?{...item,[key]:value}:item)}});
  }
  function selectScenario(preset:string){
    const choice=scenarios.find(x=>x.name===preset)!;
    clear();setScenario(preset);setSettings({...defaults,...choice.changes,...(preset==='Resonance'?{hz:Math.max(.1,Math.min(20,modal[0][0].hz))}:{})});
    if(preset==='Soft storey'||preset==='High damping'){
      const match=structuredClone(a);
      match.id=crypto.randomUUID();
      match.name=preset==='Soft storey'?'Reduced first-storey stiffness':'Higher damping';
      if(preset==='Soft storey'){match.config.levels[0].stiffnessNPerM*=.30;match.config.openGround=true;}
      else match.config.damping=a.config.damping>=20?30:20;
      setB(match);setComparison(true);
    }
    run.setNotice(choice.description);
  }
  async function importRecording(file?:File){
    if(!file)return;
    const request=++asyncGeneration.current;
    try{
      if(file.size>2_000_000)throw Error('Choose a CSV under 2 MB.');
      const imported=importCsv(await file.text(),file.name,source);
      if(request!==asyncGeneration.current)return;
      if(imported.acceleration.length>12001)throw Error('Use at most 12,001 recorded samples.');
      clear();setRecording({label:imported.label,provenance:imported.provenance!,dt:imported.dt,samples:Array.from(imported.acceleration)});
      setSettings(old=>({...old,form:'Imported CSV'}));setScenario('Custom');run.setNotice('Loaded '+imported.label+'. Recorded acceleration is used as supplied.');
    }catch(e){if(request===asyncGeneration.current)run.setNotice(e instanceof Error?e.message:String(e));}
  }
  function configuration():Scenario{return {version:1,id,name:name.trim()||'Earthquake study',job};}
  async function persist(duplicate=false){
    try{
      const config=readScenario(JSON.stringify(configuration()));
      const copy=duplicate?{...config,id:crypto.randomUUID(),name:config.name.slice(0,72)+' copy'}:config;
      if(duplicate){setId(copy.id);setName(copy.name);}
      await saveScenario({...copy,output:includeResults?outcome??undefined:undefined});
      run.setNotice('Saved '+copy.name+' locally.');await refresh();
    }catch(e){run.setNotice('Could not save simulation. '+(e instanceof Error?e.message:String(e)));}
  }
  function restore(record:Scenario,output:typeof outcome){
    run.restore(output);setId(record.id);setName(record.name);setA(record.job.buildings[0]);
    if(record.job.buildings[1])setB(record.job.buildings[1]);
    setComparison(record.job.buildings.length===2);setEdit(0);setFloor(0);setSelected(null);setScenario('Custom');
    setSettings(record.job.settings);setRecording(record.job.recording);setResultTab('Live');run.setNotice('Loaded '+record.name+'.');
  }
  async function openSaved(key:string){
    try{
      const entry=await loadScenario(key);
      if(!entry)throw Error('Saved simulation was not found.');
      const {output,...record}=entry;
      const config=readScenario(JSON.stringify(record)),retained=checkedOutput(config,output);
      restore(config,retained);
      if(output&&!retained)run.setNotice('Loaded the configuration. Its cached results could not be read. Calculate again.');
    }
    catch(e){run.setNotice(e instanceof Error?e.message:String(e));}
  }
  async function importConfig(file?:File){
    if(!file)return;
    try{if(file.size>2_000_000)throw Error('Scenario files are limited to 2 MB.');restore(readScenario(await file.text()),null);}
    catch(e){run.setNotice(e instanceof Error?e.message:String(e));}
  }
  function calculate(){
    setResultTab('Live');
    try{validateMotion(settings);run.start(job);}
    catch(e){run.setNotice(e instanceof Error?e.message:String(e));}
  }
  function seek(t:number){run.send({type:'seek',time:t});}
  function results(){
    setResultTab('Results');requestAnimationFrame(()=>resultRef.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  }
  function selectPart(part:Part,index:number){
    setSelected({building:index,id:part.id});setEdit(index===1?1:0);
    if(part.storey>=0)setFloor(part.storey);
  }
  function openPanel(value:typeof sheet){setSheet(value);setExpanded(true);}
  const reading=outcome?.results[edit===1&&comparison?1:0];
  const t=run.state.time;
  const dof=curatedFloor+Number(current.config.isolation);
  const value=(channel:keyof NonNullable<typeof reading>['traces'],i=dof)=>reading?floorDisplacement(reading.traces[channel],reading.time,reading.structure.mass.length,i,t):0;
  const currentDrift=reading?Math.max(...current.config.levels.map((_,i)=>Math.abs(value('drift',i+Number(current.config.isolation))))):0;
  const currentPeak=reading?reading.diagnostics.pga:0;
  const ground=reading?floorDisplacement(reading.ground,reading.time,1,0,t):0;
  const shear=reading?floorDisplacement(reading.baseShear,reading.time,1,0,t):0;
  const groundShift=reading&&outcome?.hasGroundDisplacement?floorDisplacement(reading.groundDisplacement,reading.time,1,0,t):null;
  const viewMax=manual&&heat!=='Modal displacement'?heatLimit:sharedScale;
  const running=run.state.status==='playing';
  const available=!!outcome;
  const busy=run.progress!==null;
  const selectedPart=selected?(selected.building===0?geoA:geoB).parts.find(p=>p.id===selected.id):null;
  let localProjects:Project[]=[];
  if(sheet==='Building')try{localProjects=readLibrary(localStorage.getItem('seismonepal-projects-v1')??'[]');}catch{/* the constructor reports corrupted projects */}
  return <div className="quake-lab" hidden={!active}>
    <header className="quake-heading"><div><h1>Earthquake laboratory</h1><p>Run a ground-motion scenario and inspect the response floor by floor.</p></div>
      <div className="quake-actions"><Flag label="Compare buildings" checked={comparison} onChange={v=>{clear();setComparison(v);if(!v)setEdit(0);setSelected(null);}}/>
        <button className="quake-primary" disabled={busy} onClick={calculate}>Calculate response</button><button onClick={()=>{openPanel('Saved');void persist();}}>Save simulation</button><button disabled={!available} onClick={results}>Results</button></div></header>
    <div className="quake-grid">
      <section className={'quake-card quake-stage'+(fullscreen.inline?' viewport-expanded':'')} ref={stage} aria-label="Earthquake viewport">
        <div className="quake-card-row"><div><h2>{comparison?'A · '+a.name+' / B · '+b.name:a.name}</h2><p className="quake-sub">{outcome?.label??(settings.form==='Imported CSV'?'Imported recording':'Synthetic · '+settings.form)}{outcome?.provenance?' · '+outcome.provenance:''}</p></div>
          <button onClick={()=>setFit(v=>v+1)}>Fit</button><button aria-pressed={fullscreen.expanded} onClick={()=>void fullscreen.toggle()}>{fullscreen.expanded?'Exit fullscreen':'Fullscreen'}</button></div>
        <div className="quake-canvas">
          {active&&<GraphicsBoundary key={graphicsKey} retry={()=>{setLost(false);setGraphicsKey(v=>v+1);}}><Suspense fallback={<div className="constructor-fallback">Loading 3D scene…</div>}>
            <Viewport geometry={geoA} config={a.config} options={viewportOptions} selected={selected?.building===0?selected.id:null} onSelect={p=>selectPart(p,0)}
              fit={fit} time={run.time} mode={modal[0][Math.min(modeIndex,modal[0].length-1)]} result={outcome?.results[0]??null} playing={running&&!lost}
              motion={available?'seismic':null} onLost={v=>{setLost(v);if(v)run.send({type:'pause'});}} onFps={setFps}
              heat={available||heat==='Modal displacement'?heat:'None'} heatMax={viewMax} direction={settings.direction} showGround={showGround&&Boolean(outcome?.hasGroundDisplacement)} reference waves={waves} frameTime={t}
              comparison={comparison?{geometry:geoB,config:b.config,selected:selected?.building===1?selected.id:null,result:outcome?.results[1]??null,mode:modal[1][Math.min(modeIndex,modal[1].length-1)],onSelect:p=>selectPart(p,1)}:undefined}/>
          </Suspense></GraphicsBoundary>}
          {lost&&<div className="constructor-fallback"><p>WebGL context interrupted.</p><button onClick={()=>{setLost(false);setGraphicsKey(v=>v+1);}}>Restore graphics</button></div>}
          <div className="quake-hud"><span>{options.exaggeration}× deformation</span>{running&&fps>0&&<span>{fps} FPS</span>}{waves&&<span>Illustrative waves</span>}{comparison&&<span>A / B · shared camera</span>}</div>
        </div>
        <div className="quake-toolbar">
          <Select label="Heatmap" value={heat} values={heatChoices} change={setHeat}/><Select label="Camera" value={options.camera} values={cameras} change={camera=>setOptions(o=>({...o,camera}))}/>
          <label>Deformation<select value={options.exaggeration} onChange={e=>setOptions(o=>({...o,exaggeration:+e.target.value}))}>{[1,2,4,8,15,25,35].map(v=><option value={v} key={v}>{v===1?'1× · actual scale':v+'×'}</option>)}</select></label>
        </div>
        {heat!=='None'&&(available||heat==='Modal displacement')&&<div className="quake-legend"><span>{heat} · absolute magnitude</span><div style={{background:'linear-gradient(90deg,'+heatStops.join(',')+')'}}/><span>0–{viewMax.toPrecision(3)} {heatUnits[heat]}</span></div>}
        <div className="quake-timeline">
          <div className="quake-actions">
            <button className="quake-primary" disabled={!available} onClick={()=>run.send({type:running?'pause':'play'})}>{running?'Pause':run.state.status==='ready'?'Start playback':'Resume'}</button>
            <button disabled={!available} onClick={()=>run.send({type:'restart'})}>Restart</button><button disabled={!available} onClick={()=>run.send({type:'stop'})}>Stop</button>
            <button disabled={!available} aria-label="Previous sample" onClick={()=>seek(t-(outcome?.dt??0))}>−1</button>
            <button disabled={!available} aria-label="Next sample" onClick={()=>seek(t+(outcome?.dt??0))}>+1</button>
            <button disabled={!peak} onClick={()=>seek(peak?.time??0)}>Peak roof</button>
            <button disabled={!outcome} onClick={()=>{if(outcome)seek(peakAt(outcome.results[0],'drift',outcome.offsets[0]).time);}}>Peak drift</button>
          </div>
          <label className="quake-time"><span>{t.toFixed(3)} / {run.duration.toFixed(2)} s</span><input aria-label="Timeline" disabled={!available} type="range" min={0} max={run.duration||1} step={outcome?.dt??.01} value={t} onChange={e=>seek(+e.target.value)}/></label>
          <div className="quake-actions"><label>Speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.25,.5,1,2,4].map(v=><option value={v} key={v}>{v}×</option>)}</select></label><Flag label="Loop" checked={loop} onChange={setLoop}/></div>
        </div>
        {outcome&&<div className="quake-wave-wrap"><div className="quake-card-row"><strong>Input acceleration</strong><span>PGA {(currentPeak/G).toFixed(3)} g · {currentPeak.toFixed(3)} m/s²</span></div><Waveform output={outcome} time={t} seek={seek}/></div>}
      </section>
      <aside className="quake-card quake-config"><details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>Experiment setup</summary>
        <div className="quake-tabs">{(['Motion','Building','View','Saved'] as const).map(v=><button key={v} aria-pressed={sheet===v} onClick={()=>openPanel(v)}>{v}</button>)}</div>
        {sheet==='Motion'&&<>
          <Select label="Scenario" value={scenario} values={scenarios.map(x=>x.name)} change={selectScenario}/>
          <p className="quake-sub">{scenarios.find(x=>x.name===scenario)?.description}</p>
          <Select label="Waveform" value={settings.form} values={forms} change={v=>changeSettings('form',v)}/>
          {settings.form!=='Imported CSV'?<>
            <Select label="Envelope" value={settings.envelope} values={['Tapered','Flat','Decay']} change={v=>changeSettings('envelope',v)}/>
            <div className="quake-fields">{labFields.map(([key,label,min,max,step])=><NumberInput key={key} {...{label,min,max,step}} value={settings[key]} change={value=>changeSettings(key,value)}/>)}</div>
          </>:<>
            <label>Recording source<input value={source} onChange={e=>setSource(e.target.value)} placeholder="Station or archive reference"/></label>
            <label>Acceleration CSV<input type="file" accept=".csv,text/csv" onChange={e=>{void importRecording(e.target.files?.[0]);e.target.value='';}}/></label>
            <p className="quake-sub">Use time_s,accel_g or time_s,accel_m_s2. {recording?.label}</p>
            <NumberInput label="Direction (°)" value={settings.direction} min={0} max={360} step={1} change={v=>changeSettings('direction',v)}/>
          </>}
        </>}
        {sheet==='Building'&&<>
          {comparison&&<Select label="Edit building" value={edit===0?'A':'B'} values={['A','B']} change={v=>{setEdit(v==='A'?0:1);setFloor(0);}}/>}
          <label>Load building<select value="" onChange={e=>{
            const key=e.target.value;
            const saved=localProjects.find(p=>p.id===key);
            if(saved)updateBuilding(saved);else if(presets.includes(key as Config['preset']))updateBuilding(fresh(key as Config['preset']));
          }}><option value="">Choose a preset or saved project</option>{presets.map(p=><option key={p}>{p}</option>)}{localProjects.map(p=><option key={p.id} value={p.id}>{p.name} · saved</option>)}</select></label>
          <label>Inspect storey<select value={curatedFloor} onChange={e=>setFloor(+e.target.value)}>{current.config.levels.map((_,i)=><option key={i} value={i}>Storey {i+1}</option>)}</select></label>
          <div className="quake-fields">
            <NumberInput label="Storeys" value={current.config.levels.length} min={1} max={20} step={1} change={v=>{if(Number.isInteger(v))updateBuilding({...current,config:resize(current.config,v)});}}/>
            <NumberInput label="Damping (%)" value={current.config.damping} min={0} max={30} step={.25} change={v=>updateBuilding({...current,config:{...current.config,damping:v}})}/>
            <NumberInput label="Floor mass (kg)" value={current.config.levels[curatedFloor].massKg} min={1000} max={1e7} step={100} change={v=>updateLevel('massKg',v)}/>
            <NumberInput label="Stiffness (N/m)" value={current.config.levels[curatedFloor].stiffnessNPerM} min={1e4} max={1e10} step={10000} change={v=>updateLevel('stiffnessNPerM',v)}/>
          </div>
          <p className="quake-sub">Appearance and analytical properties are edited separately.</p>
        </>}
        {sheet==='View'&&<>
          <Select label="Environment" value={options.environment} values={environments} change={environment=>setOptions(o=>({...o,environment}))}/>
          <Select label="Graphics" value={options.quality} values={qualities} change={quality=>setOptions(o=>({...o,quality}))}/>
          <Flag label="Structural skeleton" checked={options.view==='Structural skeleton'} onChange={v=>setOptions(o=>({...o,view:v?'Structural skeleton':'Architectural'}))}/>
          <Flag label="Landscape details" checked={options.details} onChange={details=>setOptions(o=>({...o,details}))}/>
          <Flag label="Undeformed overlay" checked={options.ghost} onChange={ghost=>setOptions(o=>({...o,ghost}))}/>
          <Flag label="Synthetic ground movement" checked={showGround} onChange={setShowGround}/>
          <Flag label="Illustrative waves" checked={waves} onChange={setWaves}/>
          <Flag label="Manual heatmap maximum" checked={manual} onChange={setManual}/>
          {manual&&<NumberInput label={'Maximum ('+heatUnits[heat]+')'} value={heatLimit} min={.000001} max={1e10} step={.1} change={setHeatLimit}/>}
          {heat==='Modal displacement'&&<label>Heatmap mode<select value={Math.min(modeIndex,modal[0].length-1)} onChange={e=>setModeIndex(+e.target.value)}>{modal[0].map((m,i)=><option key={i} value={i}>{i+1} · {m.hz.toFixed(3)} Hz</option>)}</select></label>}
          <Flag label="Procedural rumble" checked={run.sound} onChange={run.toggleSound}/>
          <label>Rumble volume<input type="range" min={0} max={1} step={.05} value={volume} onChange={e=>setVolume(+e.target.value)}/></label>
          <Flag label="Optional haptic cues" checked={haptic} onChange={setHaptic}/>
          <p className="quake-sub">Audio and haptics are illustrative effects.</p>
          <button onClick={onDamage}>Open illustrative damage demo</button>
        </>}
        {sheet==='Saved'&&<>
          <label>Simulation name<input maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
          <Flag label="Include numerical results" checked={includeResults} onChange={setIncludeResults}/>
          <div className="quake-actions">
            <button onClick={()=>void persist()}>Save locally</button><button onClick={()=>void persist(true)}>Duplicate</button>
            <button onClick={()=>{try{const record=readScenario(JSON.stringify(configuration()));download([JSON.stringify(record,null,2)],'application/json','seismonepal-simulation.json');}catch(e){run.setNotice(String(e));}}}>Export JSON</button>
            <button disabled={!available} onClick={()=>{if(outcome)download(responseCsv(outcome),'text/csv','seismonepal-response.csv');}}>Export CSV</button>
          </div>
          <label>Import simulation JSON<input type="file" accept=".json,application/json" onChange={e=>{void importConfig(e.target.files?.[0]);e.target.value='';}}/></label>
          {savedIds.length===0&&<p className="quake-sub">No saved simulations on this device.</p>}
          <ul className="quake-saves">{savedIds.map(item=><li key={item.id}><button onClick={()=>void openSaved(item.id)}>{item.name}</button><button aria-label={'Delete '+item.name} onClick={()=>setDeleteId(item.id)}>Delete</button></li>)}</ul>
          {deleteId&&<div className="quake-alert"><p>Delete this saved simulation?</p><button onClick={async()=>{try{await deleteScenario(deleteId);setDeleteId(null);await refresh();run.setNotice('Saved simulation deleted.');}catch{run.setNotice('Could not delete the saved simulation.');}}}>Confirm deletion</button><button onClick={()=>setDeleteId(null)}>Cancel deletion</button></div>}
        </>}
      </details>
      <div className="quake-run">
        
        {busy&&<><button onClick={run.cancel}>Cancel calculation</button><progress value={run.progress!} max={1}/></>}
        <p role="status">{run.notice}</p>
      </div>
      </aside>
    </div>
    <div ref={resultRef} className="quake-results">
      <div className="quake-tabs">{(['Live','Results','Resonance'] as const).map(v=><button key={v} aria-pressed={resultTab===v} onClick={()=>setResultTab(v)}>{v}</button>)}</div>
      {resultTab==='Live'&&<section className="quake-card quake-live">
        <div className="quake-card-row"><h2>Live response</h2><label>Selected storey<select value={curatedFloor} onChange={e=>setFloor(+e.target.value)}>{current.config.levels.map((_,i)=><option key={i} value={i}>{comparison?(edit===1?'B':'A')+' · ':''}Storey {i+1}</option>)}</select></label></div>
        {selectedPart&&<p className="quake-sub">{selectedPart.id} · {selectedPart.type} · {selectedPart.surface}</p>}
        {!reading?<p className="quake-sub">Calculate a response to activate the timeline and engineering readings.</p>:<dl className="quake-metrics">
          {[
            ['Time',t.toFixed(2)+' s'],['Ground acceleration',ground.toFixed(3)+' m/s² · '+(ground/G).toFixed(3)+' g'],
            ['Ground velocity',outcome?.groundVelocity?floorDisplacement(outcome.groundVelocity,reading.time,1,0,t).toFixed(4)+' m/s':'Unavailable for this input'],
            ['Ground offset',groundShift===null?'Unavailable for this input':groundShift.toFixed(4)+' m'],
            ['Relative roof displacement',(value('displacement',reading.structure.mass.length-1)*1000).toFixed(1)+' mm'],
            ['Roof movement with ground',groundShift===null?'Unavailable for this input':((value('displacement',reading.structure.mass.length-1)+groundShift)*1000).toFixed(1)+' mm'],
            ['Maximum storey drift',(currentDrift*100).toFixed(3)+'%'],['Floor acceleration',value('absoluteAcceleration').toFixed(3)+' m/s²'],
            ['Storey restoring force',(value('restoringForce')/1000).toFixed(2)+' kN'],['Base shear',(shear/1000).toFixed(2)+' kN'],
            ['First natural period',reading.structure.modes[0].period.toFixed(3)+' s'],['Damping target',current.config.damping+'%'],
            ['Solver time',outcome!.elapsedMs.toFixed(1)+' ms'],['Selected heatmap',heat==='None'?'Off':heat==='Modal displacement'?(Math.abs(currentMode.shape[dof])/Math.max(...currentMode.shape.map(Math.abs))).toFixed(3):heatMagnitude(heat,value(channels[heat])).toPrecision(4)+' '+heatUnits[heat]]
          ].map(([label,v])=><div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}
        </dl>}
        {outcome?.results.flatMap(r=>r.warnings).filter((v,i,all)=>all.indexOf(v)===i).map(warning=><p className="quake-warning" key={warning}>{warning}</p>)}
      </section>}
      {resultTab==='Results'&&(outcome?<><section className="quake-card quake-live"><div className="quake-card-row"><h2>Peak engineering results</h2><button onClick={()=>download(responseCsv(outcome),'text/csv','seismonepal-response.csv')}>Export results CSV</button></div>
        <div className="quake-table"><table><thead><tr><th>Measure</th>{outcome.results.map((_,i)=><th key={i}>Building {i?'B':'A'}</th>)}</tr></thead><tbody>
          {[
            ['Roof displacement (mm)',(i:number)=>outcome.results[i].peak.roofDisplacement*1000],
            ['Max drift (%)',(i:number)=>modelPeaks[i]*100],
            ['Peak absolute floor acceleration (g)',(i:number)=>floorAccelerationPeaks[i]],
            ['Base shear (kN)',(i:number)=>outcome.results[i].peak.baseShear/1000],['First period (s)',(i:number)=>outcome.results[i].structure.modes[0].period],
            ['Damping dissipation (J)',(i:number)=>outcome.results[i].energy.dissipation.at(-1)??0],
            ['Peak energy residual (J)',(i:number)=>outcome.results[i].peak.energyResidual],
          ].map(([label,read])=><tr key={label as string}><th>{label as string}</th>{outcome.results.map((_,i)=><td key={i}>{displayNumber((read as (i:number)=>number)(i))}</td>)}</tr>)}
        </tbody></table></div></section><Suspense fallback={<p>Loading response plots…</p>}><ResultsChart output={outcome} floor={floor} time={t} seek={seek}/></Suspense></>:<p className="quake-sub">Calculate a response to see results.</p>)}
      {resultTab==='Resonance'&&<section className="quake-card quake-live"><div className="quake-card-row"><h2>Resonance laboratory</h2><button onClick={()=>selectScenario('Resonance')}>Tune to building A</button></div>
        <p className="quake-sub">This steady-state curve divides the roof motion under harmonic base acceleration by its static-equivalent offset. Compare the peak against the selected input frequency. Change mass, stiffness, or damping under Building to see how the curve shifts.</p>
        <div className="quake-fields"><NumberInput label="Excitation frequency (Hz)" value={settings.hz} min={.1} max={20} step={.01} change={v=>changeSettings('hz',v)}/><p>{modal.map((m,i)=>(i?'B':'A')+' first mode '+m[0].hz.toFixed(3)+' Hz').join(' · ')}</p></div>
        <details><summary>Natural periods</summary><ul className="quake-sub">{modal.map((m,i)=><li key={i}>Building {i===0?'A':'B'} · {m.map((mode,j)=>'Mode '+(j+1)+' '+mode.period.toFixed(3)+' s').join(' · ')}</li>)}</ul></details>
        {active&&<Suspense fallback={<p>Loading frequency response…</p>}><ResonanceChart models={models} hz={settings.hz}/></Suspense>}
      </section>}
    </div>
    <p className="quake-sub">Educational linear shear-building model. Heatmaps show floor-level quantities. Actual damage and safety depend on the site, ground motion, construction and detailing, and require professional assessment.</p>
  </div>;
}
