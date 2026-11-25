import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {archiveAsset,sources,type RecordingMeta} from '../archive/catalog';
import {loadTrace} from '../archive/loadTrace';
import {horizontal,type Component} from '../archive/waveform';
import {assembleModel,G} from '../engine';
import {defaults,forms,type Recording} from '../seismic/motion';
import {WorkerSlot} from '../seismic/workerSlot';
import {readLibrary,type Config} from '../constructor/model';
import {useFullscreen} from '../ui/useFullscreen';
import {buildVariant,defaultsFor,presetVariant,tunedDevice,type Variant} from './model';
import {energyKinds,responseChange,type CaseResult,type Experiment,type LabResult} from './analysis';
import {storageKey,readExperiment} from './projects';
import Controls,{NumberField} from './Controls';
import Plot,{type Curve} from './Plot';
import {lessons} from './lessons';
import type {View} from './Scene';
import type {Reply} from './worker';
import './protection.css';

const Scene=lazy(()=>import('./Scene'));
const views:View[]=['Architecture','Skeleton','Wireframe','X-ray','Exploded','Foundation','Devices','Drift heatmap'];
const names:Record<string,string>={us20002926:'Gorkha mainshock · 25 April 2015',us2000292y:'Gorkha aftershock · 25 April 2015',us200029bt:'Gorkha aftershock · 26 April 2015',us20002ejl:'Dolakha · 12 May 2015'};
const letters=['A','B','C','D'];
const base=()=>presetVariant('Ordinary reinforced concrete');
const seed=():Experiment=>({version:1,variants:[base(),presetVariant('Isolated institutional')],settings:{...defaults},notes:''});
const modeTabs=['Response','Energy','Resonance','Matrices'] as const;
type Mode=typeof modeTabs[number];
const responseOptions=['Roof displacement','Storey drift','Floor acceleration','Base shear'] as const;
type ResponseChart=typeof responseOptions[number];
const chartMetrics=[
  ['roofDisplacement','Roof vs. ground','mm',1000],['roofRelativeToBase','Roof vs. base','mm',1000],
  ['superstructureDrift','Peak storey drift','%',100],['floorAcceleration','Peak absolute floor acceleration','g',1/G],
  ['baseShear','Peak base shear','kN',.001],
] as const;
function saveFile(filename:string,content:string,type:string){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csv(result:LabResult,variants:Variant[]){
  const protectedText=(value:string)=>'"'+(/^[\s]*[=+@-]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
  const rows=['variant,time_s,ground_acc_m_s2,roof_m,roof_relative_to_base_m,base_shear_N,kinetic_J,strain_J,damping_J,input_J,balance_J,structural_J,isolation_J,tmd_J,viscous_J'];
  for(const [index,r] of result.comparison.entries())for(let i=0;i<r.time.length;i++){
    const roof=r.displacements[i*r.n+r.structuralCount-1],base=r.isolated?r.displacements[i*r.n]:0;
    rows.push([protectedText(variants[index].name),r.time[i],r.ground[i],roof,roof-base,r.shear[i],r.energy.kinetic[i],r.energy.strain[i],r.energy.dissipation[i],r.energy.input[i],r.energy.balance[i],...energyKinds.map(kind=>r.energy[kind][i])].join(','));
  }
  return rows.join('\n');
}
function Dashboard({result,variants}:{result:LabResult;variants:Variant[]}){
  const baseline=result.comparison[0];
  return <div className="protection-results">
    <div className="protection-table-wrap"><table><thead><tr><th>Peak demand</th>{variants.map((v,i)=><th key={i}>{letters[i]} · {v.name}</th>)}</tr></thead>
      <tbody>{chartMetrics.map(([key,label,unit,factor])=><tr key={key}><th>{label} ({unit})</th>{result.comparison.map((r,i)=>{
        const change=responseChange(baseline.peaks[key],r.peaks[key]);
        return <td key={i}><strong>{(r.peaks[key]*factor).toFixed(3)}</strong>{i>0&&<small>{change===null?'Baseline ≈ 0':Math.abs(change).toFixed(1)+'% '+(change<0?'increase':'reduction')}</small>}</td>;
      })}</tr>)}
      <tr><th>First coupled period (s)</th>{result.comparison.map((r,i)=><td key={i}>{r.modes[0].period.toFixed(3)}</td>)}</tr>
      <tr><th>Total dissipation (kJ)</th>{result.comparison.map((r,i)=><td key={i}>{((r.energy.dissipation.at(-1)??0)/1000).toFixed(3)}</td>)}</tr>
      </tbody></table></div>
    {variants.length>1&&<p className="protection-note">{result.comparison.slice(1).map((r,i)=>{
      const drift=responseChange(baseline.peaks.superstructureDrift,r.peaks.superstructureDrift);
      const accel=responseChange(baseline.peaks.floorAcceleration,r.peaks.floorAcceleration);
      return letters[i+1]+' vs A: '+(drift===null?'drift baseline near zero':(drift>=0?'drift fell ':'drift rose ')+Math.abs(drift).toFixed(1)+'%')+'; '+(accel===null?'acceleration baseline near zero':(accel>=0?'acceleration fell ':'acceleration rose ')+Math.abs(accel).toFixed(1)+'%');
    }).join(' · ')}.</p>}
  </div>;
}
function activeCurves(result:LabResult,tab:Mode,active:number,quantity:ResponseChart='Roof displacement'):{curves:Curve[];xLabel:string;yLabel:string}{
  const value=result.comparison[active];
  if(tab==='Energy')return {xLabel:'Time (s)',yLabel:'Energy (kJ)',curves:[
    ['Kinetic',value.energy.kinetic],['Elastic strain',value.energy.strain],['Ground input',value.energy.input],['Total dissipation',value.energy.dissipation],...energyKinds.map(kind=>[kind,value.energy[kind]])].map(([name,y])=>({name:name as string,x:value.time,y:Float64Array.from(y as Float64Array,v=>v/1000)}))};
  if(tab==='Resonance')return {xLabel:'Excitation frequency (Hz)',yLabel:'Roof amplitude (mm per m/s²)',curves:result.comparison.map((r,i)=>({name:letters[i],x:r.sweep.map(s=>s[0]),y:r.sweep.map(s=>s[1]===null?null:s[1]*1000)}))};
  const fields={
    'Roof displacement':{key:'displacements',factor:1000,label:'Relative roof displacement (mm)'},
    'Storey drift':{key:'drifts',factor:100,label:'Maximum floor drift magnitude (%)'},
    'Floor acceleration':{key:'accelerations',factor:1/G,label:'Maximum floor acceleration magnitude (g)'},
    'Base shear':{key:'shear',factor:.001,label:'Base shear (kN)'},
  } as const;
  const field=fields[quantity];
  return {xLabel:'Time (s)',yLabel:field.label,curves:result.comparison.map((r,i)=>({
    name:letters[i],x:r.time,y:Float64Array.from(r.time,(_,j)=>{
      if(field.key==='shear')return r.shear[j]*field.factor;
      if(field.key==='displacements')return r.displacements[j*r.n+r.structuralCount-1]*field.factor;
      let maximum=0;
      for(let floor=Number(r.isolated);floor<r.structuralCount;floor++)maximum=Math.max(maximum,Math.abs(r[field.key][j*r.n+floor]));
      return maximum*field.factor;
    }),
  }))};
}
function Matrix({caseResult}:{caseResult:CaseResult}){
  const [name,setName]=useState<'M'|'K'|'C'>('K');
  const matrix=caseResult[name],n=caseResult.n;
  const unit={M:'kg',K:'N/m',C:'N·s/m'};
  return <><label>System matrix<select value={name} onChange={e=>setName(e.target.value as typeof name)}><option>M</option><option>K</option><option>C</option></select></label>
    <p className="protection-note">{unit[name]} · Order is {caseResult.isolated?'base, ':''}floors from bottom to top{n>caseResult.structuralCount?', then tuned mass':''}.</p>
    <div className="protection-table-wrap"><table aria-label={name+' matrix'}><tbody>
      {Array.from({length:n},(_,i)=><tr key={i}><th>{i+1}</th>{Array.from({length:n},(_,j)=><td key={j}>{matrix[i*n+j].toExponential(3)}</td>)}</tr>)}
    </tbody></table></div>
    <div className="protection-table-wrap"><table><thead><tr><th>Mode</th><th>Frequency (Hz)</th><th>Period (s)</th><th>Effective mass (%)</th></tr></thead>
      <tbody>{caseResult.modes.map((m,i)=><tr key={i}><th>{i+1}</th><td>{m.hz.toFixed(4)}</td><td>{m.period.toFixed(4)}</td><td>{(m.effectiveMassRatio*100).toFixed(2)}</td></tr>)}</tbody></table></div>
  </>;
}
export default function ProtectionLab({archiveRecording,constructorConfig}:{archiveRecording?:Recording;constructorConfig?:Config}){
  const [experiment,setExperiment]=useState<Experiment>(()=>archiveRecording?{...seed(),settings:{...defaults,form:'Imported CSV'},recording:archiveRecording}:seed());
  const [active,setActive]=useState(0),[engineering,setEngineering]=useState(false),[tab,setTab]=useState<Mode>('Response');
  const [result,setResult]=useState<LabResult>();
  const [running,setRunning]=useState(false),[progress,setProgress]=useState(0),[status,setStatus]=useState('');
  const [quantity,setQuantity]=useState<ResponseChart>('Roof displacement');
  const [mode,setMode]=useState<'Synthetic'|'Historical'>(archiveRecording?'Historical':'Synthetic');
  const [records,setRecords]=useState<RecordingMeta[]>([]),[event,setEvent]=useState('us20002926'),[station,setStation]=useState('KTP'),[component,setComponent]=useState<Component>('NS');
  const [recordLoading,setRecordLoading]=useState(false);
  const [view,setView]=useState<View>('Architecture'),[quality,setQuality]=useState<'Balanced'|'Low'>('Balanced'),[scale,setScale]=useState(18);
  const [speed,setSpeed]=useState(1),[sample,setSample]=useState(0),[playing,setPlaying]=useState(false),[picked,setPicked]=useState('');
  const [importFile,setImportFile]=useState<File|null>(null),[lesson,setLesson]=useState(0);
  const [library]=useState(()=>{try{return readLibrary(localStorage.getItem('seismonepal-projects-v1')??'[]');}catch{return [];}});
  const slot=useRef(new WorkerSlot<Worker>()).current;
  const archiveLoad=useRef<AbortController|null>(null);
  const stage=useRef<HTMLElement>(null);
  const fullscreen=useFullscreen(stage);
  useEffect(()=>()=>{slot.close();archiveLoad.current?.abort();},[slot]);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(['gorkha-mainshock.json','recordings.json'].map(path=>fetch(archiveAsset(path),{signal:controller.signal}).then(r=>{
      if(!r.ok)throw Error('Archive manifest is unavailable.');
      return r.json() as Promise<RecordingMeta[]>;
    }))).then(groups=>{if(!controller.signal.aborted)setRecords(groups.flat());})
      .catch(()=>{if(!controller.signal.aborted&&mode==='Historical')setStatus('Historical station list could not be loaded.');});
    return ()=>controller.abort();
    // Manifest identity is independent of the selected input.
  },[]);
  const duration=result?.comparison[0].time.at(-1)??0;
  const series=result?.comparison[0].time;
  const time=series?.[sample]??0;
  const cursor=useRef(0);
  useEffect(()=>{
    if(!series||!playing)return;
    let frame=0,last=performance.now(),publish=0;
    const next=(now:number)=>{
      cursor.current=Math.min(duration,cursor.current+Math.min(.16,(now-last)/1000)*speed);
      last=now;
      if(now-publish>33||cursor.current>=duration){
        let low=0,high=series.length-1;
        while(low<high){const middle=Math.floor((low+high+1)/2);if(series[middle]<=cursor.current)low=middle;else high=middle-1;}
        setSample(low);publish=now;
      }
      if(cursor.current<duration)frame=requestAnimationFrame(next);
      else setPlaying(false);
    };
    frame=requestAnimationFrame(next);
    return ()=>cancelAnimationFrame(frame);
  },[playing,series,speed,duration]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',visibility);
    return ()=>document.removeEventListener('visibilitychange',visibility);
  },[]);
  const {variants,settings,recording}=experiment;
  const variant=variants[active];
  const available=records.filter(r=>r.event===event);
  const caseResult=result?.comparison[active];
  const curves=useMemo(()=>result&&tab!=='Matrices'?activeCurves(result,tab,active,quantity):null,[result,tab,active,quantity]);
  const groundCurve=useMemo(()=>caseResult?[{name:'Shared input',x:caseResult.time,y:caseResult.ground}]:[],[caseResult]);
  const reportCurves=useMemo(()=>result?[activeCurves(result,'Response',active),activeCurves(result,'Energy',active)]:[],[result,active]);
  function invalidate(){
    slot.close();archiveLoad.current?.abort();archiveLoad.current=null;setRecordLoading(false);setRunning(false);setResult(undefined);setPlaying(false);setSample(0);cursor.current=0;setPicked('');setStatus('');
  }
  function setCases(next:Variant[]){
    invalidate();setExperiment(old=>({...old,variants:next}));setActive(i=>Math.min(i,next.length-1));
  }
  function setCase(next:Variant){setCases(variants.map((item,i)=>i===active?next:item));}
  function setCount(count:number){
    const additional=[base(),presetVariant('Isolated institutional'),presetVariant('Braced concrete'),{...base(),name:'Tuned roof mass',devices:{...base().devices,tmd:true}}];
    setCases(Array.from({length:count},(_,i)=>variants[i]??additional[i]));
  }
  function fromBuilder(config:Config,name:string){
    const building=structuredClone(config),devices=defaultsFor(building);
    if(building.isolation){devices.isolation=true;devices.baseMass=building.bearingMass;devices.bearingK=building.bearingStiffness;}
    building.isolation=false;
    setCase({name,building,archetype:'Custom',devices});
  }
  async function historical(){
    if(!horizontal(component))return;
    const match=available.find(item=>item.station===station);
    if(!match){setStatus('Choose an available station for this earthquake.');return;}
    invalidate();
    setExperiment(old=>({...old,recording:undefined,settings:{...old.settings,form:'Imported CSV'}}));
    const controller=new AbortController();archiveLoad.current=controller;
    setRecordLoading(true);setStatus('Checking the original station file…');
    try{
      const trace=await loadTrace(match,controller.signal);
      if(controller.signal.aborted)return;
      const source=match.source??sources.figshare;
      const chosen={label:'Recorded · '+names[event]+' · '+station+' · '+component,provenance:source+' · '+match.path+' · SHA-256 '+match.sha256,dt:trace.dt,samples:Array.from(trace.components[component])};
      setExperiment(old=>({...old,recording:chosen,settings:{...old.settings,form:'Imported CSV'}}));
      setStatus('Station recording verified. Ready to calculate.');
    }catch(error){
      if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'Recording failed.');
    }finally{if(archiveLoad.current===controller){archiveLoad.current=null;setRecordLoading(false);}}
  }
  function chooseInput(next:typeof mode){
    invalidate();setMode(next);
    setExperiment(old=>({...old,recording:undefined,settings:{...old.settings,form:next==='Historical'?'Imported CSV':'Broadband'}}));
  }
  function updateSynthetic(key:'form'|'dt'|'duration'|'pgaG'|'hz',value:number|string){
    invalidate();setExperiment(old=>({...old,settings:{...old.settings,[key]:value}}));
  }
  function run(){
    invalidate();setRunning(true);setProgress(0);setStatus('Solving all configurations with the same ground acceleration…');
    const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
    slot.take(worker);
    worker.onmessage=({data}:{data:Reply})=>{
      if(!slot.owns(worker))return;
      if(data.type==='progress'){setProgress(data.value);return;}
      slot.close();setRunning(false);
      if(data.type==='error'){setStatus(data.message);return;}
      setResult(data.result);setStatus('Calculation complete · '+data.result.elapsed.toFixed(0)+' ms in worker');
    };
    worker.onerror=()=>{if(slot.owns(worker)){slot.close();setRunning(false);setStatus('The simulation worker stopped.');}};
    worker.postMessage(experiment);
  }
  function adopt(text:string){
    const next=readExperiment(text);
    invalidate();setExperiment(next);setActive(0);setMode(next.recording?'Historical':'Synthetic');setStatus('Experiment restored.');
  }
  async function importProject(){
    if(!importFile)return;
    try{if(importFile.size>3_000_000)throw Error('Experiment is too large.');adopt(await importFile.text());}
    catch(error){setStatus(error instanceof Error?error.message:'Could not read this experiment.');}
  }
  function save(){
    try{
      const validated=readExperiment(JSON.stringify(experiment));
      localStorage.setItem(storageKey,JSON.stringify({...validated,results:result?.comparison.map(r=>({peaks:r.peaks,modes:r.modes,devices:r.devices}))}));
      setStatus('Experiment and available result summary saved locally.');
    }catch(error){setStatus(error instanceof Error?error.message:'Local saving is unavailable.');}
  }
  function applyLesson(){
    const kind=lessons[lesson][3],first=kind==='retrofit'?presetVariant('Soft-storey apartment'):base();
    const modified=structuredClone(first);
    if(kind==='retrofit'){modified.name='Soft-storey strengthening';modified.devices.retrofit='Soft-storey strengthening';}
    else if(kind!=='baseline'){modified.name=lessons[lesson][0];modified.devices[kind]=true;}
    else{modified.name='Increased floor mass';modified.building.levels.forEach(l=>{l.massKg*=1.5;});}
    const next=[first,modified];
    if(kind==='tmd'){
      modified.devices.tmdHz=assembleModel(buildVariant(first).model).modes[0].hz;
      modified.name='Tuned mass';
      const mistuned=structuredClone(modified);mistuned.name='Mistuned mass';mistuned.devices.tmdHz*=1.6;next.push(mistuned);}
    setCases(next);
    if(kind==='tmd'||lesson===1)setTab('Resonance');
    else if(kind==='viscous')setTab('Energy');
    else setTab('Response');
    setStatus('Lesson experiment loaded. Calculate response to compare the cases.');
  }
  function seek(i:number){
    setPlaying(false);setSample(i);cursor.current=series?.[i]??0;
  }
  const sameStructure=variants.every(v=>JSON.stringify(v.building.levels)===JSON.stringify(variants[0].building.levels)&&v.building.damping===variants[0].building.damping&&['None','Horizontal seismic bands','Masonry reinforcement','Improved connections'].includes(v.devices.retrofit));
  const baselineMotion=settings.form==='Imported CSV';
  return <article className="protection" aria-label="Seismic Protection Lab">
    <header className="protection-header"><div><h1>Seismic Protection Lab</h1><p>Compare structural systems under the same ground motion.</p></div>
      <div className="protection-actions"><button aria-pressed={!engineering} onClick={()=>{setEngineering(false);if(tab==='Matrices')setTab('Response');}}>Learning mode</button><button aria-pressed={engineering} onClick={()=>setEngineering(true)}>Engineering mode</button></div>
    </header>
    <div className="protection-layout">
      <section className={'protection-card protection-stage'+(fullscreen.inline?' viewport-expanded':'')} ref={stage} aria-label="Protection viewport">
        <div className="protection-heading"><div><h2>Building comparison</h2><p>{sameStructure?'Common baseline superstructure properties':'Superstructure properties vary between cases'}</p></div>
          <div className="protection-actions">
            <label>Comparison size<select value={variants.length} onChange={e=>setCount(+e.target.value)}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?'building':'buildings'}</option>)}</select></label>
            <label>View<select value={view} onChange={e=>setView(e.target.value as View)}>{views.map(v=><option key={v}>{v}</option>)}</select></label>
            <button onClick={()=>void fullscreen.toggle()}>{fullscreen.expanded?'Exit fullscreen':'Fullscreen'}</button>
          </div></div>
        <Suspense fallback={<p className="protection-scene">Loading protection geometry…</p>}>
          <Scene variants={variants} results={result?.comparison} sample={sample} scale={scale} view={view} active={active} setActive={setActive} onPick={setPicked} quality={quality}/>
        </Suspense>
        <div className="protection-playback">
          <button disabled={!result} onClick={()=>{if(cursor.current>=duration){cursor.current=0;setSample(0);}setPlaying(v=>!v);}}>{playing?'Pause':'Play'}</button>
          <button disabled={!result} onClick={()=>seek(0)}>Reset</button>
          <label className="protection-timeline">Time {time.toFixed(2)} / {duration.toFixed(2)} s<input type="range" min={0} max={(series?.length??1)-1} value={sample} onChange={e=>seek(+e.target.value)} disabled={!series}/></label>
          <label>Speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.25,.5,1,2,4].map(x=><option key={x} value={x}>{x}×</option>)}</select></label>
          <label>Deformation {scale}×<input type="range" min={1} max={40} value={scale} onChange={e=>setScale(+e.target.value)}/></label>
          <label>Graphics<select value={quality} onChange={e=>setQuality(e.target.value as typeof quality)}><option>Balanced</option><option>Low</option></select></label>
        </div>
        {picked&&<p className="protection-note protection-inset" role="status"><strong>{letters[active]} · {picked}.</strong> Device settings and calculated peaks are in the configuration and response panels.</p>}
      </section>
      <aside className="protection-card protection-config">
        <h2>Configurations</h2>
        <div className="protection-actions">{variants.map((item,i)=><button key={i} title={item.name} aria-pressed={active===i} onClick={()=>{setActive(i);setPicked('');}}>{letters[i]}</button>)}</div>
        <Controls key={active+'-'+variant.archetype} value={variant} onChange={setCase} engineering={engineering}/>
        <details><summary>Use a constructor project</summary>
          {constructorConfig&&<button onClick={()=>fromBuilder(constructorConfig,'Current constructor project')}>Use current constructor project</button>}
          {library.length>0?<label>Saved building<select value="" onChange={e=>{const item=library.find(p=>p.id===e.target.value);if(item)fromBuilder(item.config,item.name);}}><option value="">Choose…</option>{library.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>:<p className="protection-note">Saved constructor projects appear here.</p>}
        </details>
      </aside>
    </div>
    <section className="protection-card protection-panel">
      <div className="protection-heading"><div><h2>Ground motion</h2><p>{recording?.label??(baselineMotion?'Choose a verified station file.':'Synthetic · '+settings.form)}</p></div><div className="protection-actions">
        <button aria-pressed={mode==='Synthetic'} onClick={()=>{if(mode!=='Synthetic')chooseInput('Synthetic');}}>Synthetic</button>
        <button aria-pressed={mode==='Historical'} onClick={()=>{if(mode!=='Historical')chooseInput('Historical');}}>Historical record</button>
      </div></div>
      <div className="protection-fields">
        {mode==='Historical'?<>
          <label>Historical earthquake<select value={event} onChange={e=>{invalidate();setEvent(e.target.value);setStation(records.find(r=>r.event===e.target.value)?.station??'');setExperiment(old=>({...old,recording:undefined}));}}>{Object.entries(names).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
          <label>Recording station<select value={station} onChange={e=>{invalidate();setStation(e.target.value);setExperiment(old=>({...old,recording:undefined}));}}>{available.map(r=><option key={r.id}>{r.station}</option>)}</select></label>
          <label>Horizontal component<select value={component} onChange={e=>{invalidate();setComponent(e.target.value as Component);setExperiment(old=>({...old,recording:undefined}));}}><option value="NS">North–south</option><option value="EW">East–west</option></select></label>
          <button disabled={recordLoading||available.length===0} onClick={()=>void historical()}>Load verified recording</button>
        </>:<>
          <label>Waveform<select value={settings.form} onChange={e=>updateSynthetic('form',e.target.value)}>{forms.filter(f=>f!=='Imported CSV').map(f=><option key={f}>{f}</option>)}</select></label>
          <NumberField label="PGA (g)" value={settings.pgaG} min={0} max={2} onChange={v=>updateSynthetic('pgaG',v)}/>
          <NumberField label="Dominant frequency (Hz)" value={settings.hz} min={.1} max={20} onChange={v=>updateSynthetic('hz',v)}/>
          {engineering&&<><NumberField label="Time step (s)" value={settings.dt} min={.001} max={.1} step={.001} onChange={v=>updateSynthetic('dt',v)}/>
            <NumberField label="Duration (s)" value={settings.duration} min={1} max={120} step={1} onChange={v=>updateSynthetic('duration',v)}/></>}
        </>}
      </div>
      {recording&&<p className="protection-note protection-source">{recording.samples.length.toLocaleString()} original samples · Δt {recording.dt} s · SI acceleration · {recording.provenance}</p>}
      <div className="protection-actions"><button className="protection-primary" disabled={running||recordLoading||(baselineMotion&&!recording)} onClick={run}>Calculate response</button>
        {running&&<><progress value={progress} max={1}/><button onClick={()=>{invalidate();setStatus('Calculation cancelled.');}}>Cancel calculation</button></>}
        <span role="status" className="protection-note">{status}</span></div>
    </section>
    <section className="protection-card protection-panel" id="protection-results" aria-label="Engineering results">
      <div className="protection-heading"><div><h2>{tab==='Energy'?'Structural energy':tab==='Resonance'?'Resonance laboratory':'Engineering response'}</h2><p>{result?.label??'Calculate a response to populate the charts.'}</p></div>
        <div className="protection-actions">{modeTabs.filter(t=>engineering||t!=='Matrices').map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div></div>
      {result&&caseResult&&<>
        {tab==='Response'&&<><Dashboard result={result} variants={variants}/>
          <div className="protection-detail">
            <h3>{letters[active]} · {variant.name}</h3>
            <p>First coupled period {caseResult.modes[0].period.toFixed(3)} s · {caseResult.steps.toLocaleString()} integration steps · {caseResult.n} DOFs</p>
            {caseResult.bearingPeriod!==null&&<p>Rigid-superstructure isolation estimate {caseResult.bearingPeriod.toFixed(3)} s · reference stroke {variant.devices.capacity.toFixed(3)} m. Reference capacity is an educational input.</p>}
            {variant.devices.tmd&&(()=>{const cfg=variant.devices,{k,c}=tunedDevice(cfg.tmdMass,cfg.tmdHz,cfg.tmdRatio);return <p>Tuned mass {cfg.tmdMass.toLocaleString()} kg · k {(k/1000).toFixed(1)} kN/m · c {(c/1000).toFixed(2)} kN·s/m · tuning ratio against A’s first frequency {(cfg.tmdHz/result.comparison[0].modes[0].hz).toFixed(2)}</p>;})()}
            {caseResult.devices.map(device=><p key={device.kind}>{device.kind} · peak lateral relative travel {(device.peakMovement*1000).toFixed(2)} mm · peak mass or floor displacement {device.peakAbsoluteMovement.toFixed(4)} m · peak axial velocity {device.peakVelocity.toFixed(3)} m/s · peak per-device dashpot force {(device.peakForce/1000).toFixed(2)} kN</p>)}
            {engineering&&<p>Added brace stiffness (MN/m) {caseResult.braceStiffness.map(k=>(k/1e6).toFixed(2)).join(', ')} · Added wall stiffness (MN/m) {caseResult.wallStiffness.map(k=>(k/1e6).toFixed(2)).join(', ')}</p>}
            {caseResult.warnings.map(message=><p className="protection-warning" key={message}>{message}</p>)}
          </div></>}
        {tab==='Energy'&&<p className="protection-note">{letters[active]} · Peak absolute energy balance residual {caseResult.peaks.energyResidual.toExponential(3)} J. Dissipation is split by dashpot group; elastic strain energy is recoverable.</p>}
        {tab==='Resonance'&&<p className="protection-note">Steady-state roof displacement for a harmonic ground acceleration of 1 m/s². Use a tuned and mistuned pair to compare the response around resonance.</p>}
        {tab==='Response'&&<>
          <Plot curves={groundCurve} xLabel="Time (s)" yLabel="Acceleration (m/s²)" marker={time}/>
          <label>Response chart<select value={quantity} onChange={e=>setQuantity(e.target.value as ResponseChart)}>{responseOptions.map(value=><option key={value}>{value}</option>)}</select></label>
        </>}
        {tab==='Matrices'?<Matrix caseResult={caseResult}/>:curves&&<Plot {...curves} marker={tab==='Resonance'?undefined:time}/>}
      </>}
    </section>
    <div className="protection-bottom">
      <section className="protection-card protection-panel"><h2>Engineering lessons</h2>
        <label>Lesson<select value={lesson} onChange={e=>setLesson(+e.target.value)}>{lessons.map(([title],i)=><option value={i} key={title}>{title}</option>)}</select></label>
        <p>{lessons[lesson][1]}</p><p className="protection-formula">{lessons[lesson][2]}</p>
        <button onClick={applyLesson}>Load lesson experiment</button>
        <details><summary>Knowledge check</summary><p>Which quantities should you compare before judging changes in response?</p><p>Check drift, acceleration, force, displacement and device movement together. An improvement in one demand can coincide with an increase in another.</p></details>
      </section>
      <section className="protection-card protection-panel"><h2>Experiments and export</h2>
        <label>Experiment notes<textarea rows={3} maxLength={2500} value={experiment.notes} onChange={e=>setExperiment(old=>({...old,notes:e.target.value}))}/></label>
        <div className="protection-actions"><button onClick={save}>Save locally</button><button onClick={()=>{try{adopt(localStorage.getItem(storageKey)??'null');}catch{setStatus('No valid local Protection Lab experiment was found.');}}}>Restore local experiment</button>
          <button onClick={()=>saveFile('seismonepal-protection.json',JSON.stringify(experiment,null,2),'application/json')}>Export JSON</button>
          <button disabled={!result} onClick={()=>{if(result)saveFile('seismonepal-protection.csv',csv(result,variants),'text/csv');}}>Export CSV</button>
          <button disabled={!result} onClick={()=>window.print()}>Print experiment report</button>
        </div>
        <label>Import experiment<input type="file" accept=".json,application/json" onChange={e=>setImportFile(e.target.files?.[0]??null)}/></label><button disabled={!importFile} onClick={()=>void importProject()}>Restore JSON file</button>
      </section>
    </div>
    <section className="protection-card protection-panel protection-assumptions">
      <h2>Model assumptions</h2><p>Linear elastic, one-axis shear-building response. Device visuals show amplified model motion. Actual safety depends on strength, ductility, detailing, foundations, soil and construction quality. The lab cannot certify safety or code compliance.</p>
      <p>Equivalent isolators omit yielding and friction hysteresis. Bracing omits buckling, connection failure and force redistribution. Shear-wall springs match overall cantilever compliance and omit continuous flexural mode shapes. The sensor-response treatment and provenance of recorded files come from their publishers.</p>
    </section>
    {result&&<section className="protection-print"><h2>SeismoNepal 3D experiment report</h2><p>{result.label}</p><p>{result.provenance}</p><p>{experiment.notes}</p><p>Linear elastic educational model. This report does not certify structural safety.</p>
      <Dashboard result={result} variants={variants}/>
      {variants.map((v,i)=><details open key={i}><summary>{letters[i]} · {v.name}</summary><pre>{JSON.stringify({levels:v.building.levels,damping:v.building.damping,devices:v.devices},null,2)}</pre></details>)}
      {reportCurves.map(chart=><Plot key={chart.yLabel} {...chart}/>)}
    </section>}
  </article>;
}
