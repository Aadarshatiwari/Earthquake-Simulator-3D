import {useEffect,useMemo,useRef,useState} from 'react';
import {archiveAsset,sources,type RecordingMeta} from '../archive/catalog';
import {loadTrace} from '../archive/loadTrace';
import {G,type GroundMotion} from '../engine';
import {makeMotion} from '../seismic/motion';
import {presetVariant,type Archetype,type Variant} from '../protection/model';
import {type Experiment,responseChange,energyKinds} from '../protection/analysis';
import {WorkerSlot} from '../seismic/workerSlot';
import {useFullscreen} from '../ui/useFullscreen';
import {analysisDefaults,objectives,parameters,type Axis,type Objective,type Study} from './compute';
import {spectrumNames,type WindowName} from './signal';
import type {Reply,Request} from './worker';
import {readResearch,type ResearchProject} from './projects';
import {saveBlob} from './export';
import Chart,{Heat,type Series} from './Chart';
import './research.css';

const tabs=['Ground motion','Response spectra','Frequency','Modal analysis','Structural response','Energy','Comparison','Research sweeps','Verification','Math lab','Export & projects'] as const;
type Tab=typeof tabs[number];
const example=['A · Gorkha spectra','B · Isolation trade-offs','C · Tuned and mistuned','D · Soft-storey drift','E · Stiffness sensitivity','F · Compare stations','G · Time-step convergence'] as const;
const names:Record<string,string>={us20002926:'Gorkha mainshock',us2000292y:'25 April Gorkha aftershock',us200029bt:'26 April Gorkha aftershock',us20002ejl:'Dolakha aftershock'};
const models:Archetype[]=['Ordinary reinforced concrete','Isolated institutional','Braced concrete','Shear-wall residence','Soft-storey apartment','Newari residence'];
const responseNames={displacement:'Relative displacement (m)',velocity:'Relative velocity (m/s)',absoluteAcceleration:'Absolute acceleration (m/s²)',interstoreyDisplacement:'Interstorey movement (m)',drift:'Drift ratio',restoringForce:'Elastic link force (N)','base relative':'Base-relative displacement (m)','base shear':'Base reaction (N)','device travel':'Device travel (m)','device force':'Per-device dashpot force (N)'} as const;
type Channel=keyof typeof responseNames;
const storeKey='seismonepal-research-projects-v1';
const fmt=(n:number|null|undefined)=>n==null?'—':Number(n.toPrecision(5)).toString();
const base=()=>presetVariant('Ordinary reinforced concrete');
const defaults=():ResearchProject=>({version:1,name:'Gorkha response study',notes:'',source:'us20002926-KTP',component:'NS',
  variants:[base(),presetVariant('Isolated institutional')],settings:structuredClone(analysisDefaults),
  axis:{parameter:'Storey stiffness multiplier',min:.55,max:1.65,count:8,log:false},
  axis2:{parameter:'Floor mass multiplier',min:.7,max:1.4,count:8,log:false},grid:false,objective:'superstructureDrift'});
function Num({label,value,set,min,max,step='any'}:{label:string;value:number;set:(n:number)=>void;min?:number;max?:number;step?:string|number}){
  return <label>{label}<input type="number" value={Number.isFinite(value)?value:''} min={min} max={max} step={step} onChange={e=>set(e.target.valueAsNumber)}/></label>;
}
function DataTable({head,rows}:{head:string[];rows:(string|number)[][]}){
  return <div className="research-table"><table><thead><tr>{head.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((x,j)=><td key={j}>{x}</td>)}</tr>)}</tbody></table></div>;
}
function axisEditor(axis:Axis,set:(axis:Axis)=>void,label:string){
  return <div className="research-tools"><label>{label}<select value={axis.parameter} onChange={e=>{
    const parameter=e.target.value as Axis['parameter'];
    const bounds:Partial<Record<Axis['parameter'],[number,number]>>={'Storeys':[2,10],'Structural damping (%)':[1,12],'Isolation period (s)':[1,4],'Isolation stiffness (N/m)':[1e6,9e6],'Isolation damping ratio':[.05,.3],'Brace area (m²)':[.001,.004],'Wall stiffness factor':[.1,.8],'TMD mass ratio':[.01,.12],'TMD frequency (Hz)':[.6,2.4],'Viscous coefficient (N·s/m)':[1e5,1.5e6]};
    const [min,max]=bounds[parameter]??[.6,1.6];set({...axis,parameter,min,max});
  }}>{parameters.map(p=><option key={p}>{p}</option>)}</select></label>
    <Num label={label+' min'} value={axis.min} set={min=>set({...axis,min})}/><Num label={label+' max'} value={axis.max} set={max=>set({...axis,max})}/>
    <Num label={label+' samples'} value={axis.count} min={2} max={16} step={1} set={count=>set({...axis,count})}/>
    <label><input type="checkbox" checked={axis.log} onChange={e=>set({...axis,log:e.target.checked})}/> Log spacing</label></div>;
}
export default function Research({seed,legacy,initialPanel}:{seed?:Experiment;legacy:GroundMotion;initialPanel?:Tab}){
  const [project,setProject]=useState<ResearchProject>(()=>seed?{...defaults(),name:'Protection Lab experiment',notes:seed.notes,source:'protection',variants:seed.variants}:defaults());
  const [tab,setTab]=useState<Tab>(seed?'Comparison':initialPanel??'Ground motion'),[advanced,setAdvanced]=useState(false);
  const [records,setRecords]=useState<RecordingMeta[]>([]),[input,setInput]=useState<GroundMotion>(),[study,setStudy]=useState<Study>();
  const [busy,setBusy]=useState(false),[status,setStatus]=useState('Choose an input and run the study.'),[exampleIndex,setExample]=useState(0);
  const [caseIndex,setCase]=useState(0),[baseline,setBaseline]=useState(0),[modeIndex,setMode]=useState(0);
  const [cursor,setCursor]=useState(0),[dof,setDof]=useState(0),[spectrum,setSpectrum]=useState<typeof spectrumNames[number]>('PSA');
  const [channel,setChannel]=useState<Channel>('displacement'),[heat,setHeat]=useState(false),[log,setLog]=useState(false);
  const [psd,setPsd]=useState(false),[angular,setAngular]=useState(false),[spectro,setSpectro]=useState(false),[maxFrequency,setMaxFrequency]=useState(20);
  const [stationComparison,setStationComparison]=useState<{label:string;motion:GroundMotion;offset:number}>();
  const [sweep,setSweep]=useState<Extract<Reply,{job:'sweep'}>['value']>(),[sensitivity,setSensitivity]=useState<Extract<Reply,{job:'sensitivity'}>['value']>(),[convergence,setConvergence]=useState<Extract<Reply,{job:'convergence'}>['value']>();
  const [exportMode,setExportMode]=useState<'Full resolution'|'Lightweight'>('Full resolution'),[metadata,setMetadata]=useState('');
  const [saved,setSaved]=useState<ResearchProject[]>(()=>{try{return (JSON.parse(localStorage.getItem(storeKey)??'[]') as unknown[]).map(p=>readResearch(JSON.stringify(p)));}catch{return [];}});
  const [savedIndex,setSavedIndex]=useState(0),[remove,setRemove]=useState(false),[file,setFile]=useState<File>();
  const [batchRecord,setBatchRecord]=useState('us20002ejl-KTP'),[batch,setBatch]=useState<Extract<Reply,{job:'batch'}>['value']>(),[pdf,setPdf]=useState(''),[matrix,setMatrix]=useState<'M'|'K'|'C'>('K'),[mathStep,setMathStep]=useState(0),[modePlaying,setModePlaying]=useState(false);
  const [reportFormat,setReportFormat]=useState<'Compact'|'Comprehensive'>('Comprehensive');
  const [sections,setSections]=useState({signals:true,comparison:true,parameters:true});
  const slot=useRef(new WorkerSlot<Worker>()).current,loader=useRef<AbortController|null>(null),stage=useRef<HTMLElement>(null);
  const fullscreen=useFullscreen(stage);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(['gorkha-mainshock.json','recordings.json'].map(path=>fetch(archiveAsset(path),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<RecordingMeta[]>;})))
      .then(r=>setRecords(r.flat())).catch(()=>{if(!controller.signal.aborted)setStatus('Recording index is unavailable.');});
    return ()=>{controller.abort();loader.current?.abort();slot.close();};
  },[slot]);
  useEffect(()=>()=>{if(pdf)URL.revokeObjectURL(pdf);},[pdf]);
  function update(p:Partial<ResearchProject>){
    slot.close();loader.current?.abort();setBusy(false);setStudy(undefined);setInput(undefined);setSweep(undefined);setSensitivity(undefined);setConvergence(undefined);setBatch(undefined);setPdf('');
    setProject(old=>({...old,...p}));
  }
  async function motion(signal:AbortSignal){
    if(project.embedded)return {dt:project.embedded.dt,label:project.embedded.label,provenance:project.embedded.provenance,acceleration:Float64Array.from(project.embedded.samples)};
    if(project.source==='legacy')return legacy;
    if(project.source==='protection'&&seed)return makeMotion(seed.settings,seed.recording).motion;
    const meta=records.find(r=>r.id===project.source);
    if(!meta)throw Error('Select a verified station recording.');
    const trace=await loadTrace(meta,signal);
    return {label:'Recorded · '+names[meta.event]+' · '+meta.station+' · '+project.component,
      provenance:(meta.source??sources.figshare)+' · '+meta.path+' · SHA-256 '+meta.sha256,dt:trace.dt,acceleration:trace.components[project.component]};
  }
  async function dispatch(job:Request['job']){
    slot.close();loader.current?.abort();
    const controller=new AbortController();loader.current=controller;
    setBusy(true);setStatus('Running '+job+'…');
    try{
      const ground=input??await motion(controller.signal);
      if(controller.signal.aborted)return;
      setInput(ground);
      let motions:GroundMotion[]|undefined;
      if(job==='batch'){
        const meta=records.find(r=>r.id===batchRecord);
        if(!meta||meta.id===project.source)throw Error('Choose a different station record.');
        const trace=await loadTrace(meta,controller.signal);
        if(controller.signal.aborted)return;
        motions=[ground,{label:'Recorded · '+names[meta.event]+' · '+meta.station+' · '+project.component,provenance:(meta.source??sources.figshare)+' · '+meta.path+' · SHA-256 '+meta.sha256,
          dt:trace.dt,acceleration:trace.components[project.component]}];
      }
      const child=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});slot.take(child);
      const stride=exportMode==='Full resolution'?1:Math.max(1,Math.ceil(ground.acceleration.length/1400));
      child.onmessage=({data}:{data:Reply})=>{
        if(!slot.owns(child))return;
        slot.close();setBusy(false);
        switch(data.job){
          case 'batch':setBatch(data.value);break;
          case 'study':setStudy(data.value);setCase(0);setBaseline(0);setDof(0);setMode(0);setCursor(0);break;
          case 'sweep':setSweep(data.value);break;
          case 'sensitivity':setSensitivity(data.value);break;
          case 'convergence':setConvergence(data.value);break;
          case 'csv':case 'json':saveBlob('seismonepal-'+(stride===1?'full':'lightweight')+'.'+data.job,data.value);setMetadata(data.metadata);break;
          case 'error':setStatus(data.value);return;
        }
        setStatus(data.job+' complete'+('ms' in data?' · '+data.ms.toFixed(0)+' ms':'')+'.');
      };
      child.onerror=()=>{if(slot.owns(child)){slot.close();setBusy(false);setStatus('The research worker stopped.');}};
      child.postMessage({job,motion:ground,variants:project.variants,settings:project.settings,x:project.axis,y:project.grid?project.axis2:null,metric:project.objective,stride,motions});
    }catch(e){if(!controller.signal.aborted){setBusy(false);setStatus(e instanceof Error?e.message:'Study failed.');}}
  }
  async function compareStation(id:string){
    const main=records.find(r=>r.id===project.source),other=records.find(r=>r.id===id);
    setStationComparison(undefined);if(!other||!main||!input)return;
    const controller=new AbortController();loader.current?.abort();loader.current=controller;
    try{
      const trace=await loadTrace(other,controller.signal);
      if(controller.signal.aborted)return;
      setStationComparison({label:other.station,offset:(Date.parse(other.start)-Date.parse(main.start))/1000,
        motion:{label:other.station,provenance:(other.source??sources.figshare)+' · '+other.path+' · SHA-256 '+other.sha256,dt:trace.dt,acceleration:trace.components[project.component]}});
    }catch(e){if(!controller.signal.aborted)setStatus(String(e));}
  }
  function guided(){
    const options:Tab[]=['Response spectra','Comparison','Comparison','Structural response','Research sweeps','Ground motion','Verification'];
    const next=defaults();next.name=example[exampleIndex];setHeat(false);setStationComparison(undefined);
    if(exampleIndex===2){
      const a=base(),b=base(),c=base();
      b.name='Tuned mass · 1.35 Hz';b.devices.tmd=true;
      c.name='Mistuned mass · 2.2 Hz';c.devices.tmd=true;c.devices.tmdHz=2.2;
      next.variants=[a,b,c];
    }
    if(exampleIndex===3){next.variants=[base(),presetVariant('Soft-storey apartment')];setChannel('drift');setHeat(true);}
    update(next);setTab(options[exampleIndex]);
  }
  function saveList(list:ResearchProject[]){
    try{localStorage.setItem(storeKey,JSON.stringify(list));setSaved(list);setSavedIndex(i=>Math.max(0,Math.min(i,list.length-1)));setRemove(false);}
    catch{setStatus('Local project storage is unavailable.');}
  }
  function archiveProject(){
    return {...project,embedded:input&&['legacy','protection'].includes(project.source)?{dt:input.dt,label:input.label,provenance:input.provenance,samples:Array.from(input.acceleration)}:project.embedded};
  }
  async function makePdf(){
    if(!input||!study)return;
    const {reportPdf}=await import('./pdf');
    const bytes=reportPdf(project.name,input,study,project.variants,project.notes,new Date(),{format:reportFormat,...sections});
    const blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
    setPdf(URL.createObjectURL(blob));saveBlob('seismonepal-research.pdf',blob);
  }
  const current=study?.cases[Math.min(caseIndex,study.cases.length-1)],run=current?.run,n=run?.structure.mass.length??0;
  const currentMode=run?.structure.modes[Math.min(modeIndex,n-1)];
  const selected=records.find(r=>r.id===project.source);
  const time=run?.time;
  const reference=study?.cases[baseline];
  const phase=mathStep/100*Math.PI*2;
  useEffect(()=>{
    if(tab!=='Modal analysis'||!modePlaying||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let frame=0,last=0;
    function next(t:number){if(t-last>35){setMathStep((t/18)%100);last=t;}frame=requestAnimationFrame(next);}
    frame=requestAnimationFrame(next);return ()=>cancelAnimationFrame(frame);
  },[tab,modePlaying]);
  const plotData=useMemo(()=>{
    if(!study||!run||!current||!time)return null;
    const row=(result:typeof run,coordinate:number)=>Float64Array.from(result.time,(_,i)=>{
      const c=result.structure.mass.length,k=i*c+Math.min(coordinate,c-1);
      if(channel==='base shear')return result.baseShear[i];
      if(channel==='base relative')return result.traces.displacement[k]-(result.structure.isolated?result.traces.displacement[i*c]:0);
      if(channel==='device travel'||channel==='device force')return 0;
      return result.traces[channel][k];
    });
    const device=channel==='device travel'||channel==='device force';
    const series:Series[]=device?current.devices.map(d=>({name:d.kind,x:time,y:channel==='device travel'?d.travel:d.force})):study.cases.map(c=>({name:c.name,x:c.run.time,y:row(c.run,dof)}));
    const indices=Array.from({length:Math.min(320,time.length)},(_,i)=>Math.round(i*(time.length-1)/(Math.min(320,time.length)-1)));
    const rowData=Array.from({length:n},(_,i)=>row(run,i));
    const envelope=rowData.map((values,i)=>{
      let peak=0,idx=0;values.forEach((v,k)=>{if(Math.abs(v)>peak){peak=Math.abs(v);idx=k;}});
      const heights=project.variants[caseIndex].building.levels;
      const k=i-Number(run.structure.isolated);
      const height=k<0?0:heights.slice(0,k+1).reduce((sum,f)=>sum+f.heightM,0);
      return [i+1,fmt(height),fmt(peak),fmt(time[idx])];
    });
    return {series,indices,rows:rowData.map(r=>indices.map(i=>r[i])),envelope};
  },[study,run,current,time,n,dof,channel,project.variants,caseIndex]);
  return <article className="research">
    <header><div><h1>Engineering Analytics</h1><p>Historical records, computed response and reproducible numerical experiments.</p></div><button aria-pressed={advanced} onClick={()=>setAdvanced(!advanced)}>{advanced?'Engineering mode':'Learning mode'}</button></header>
    <section className="research-card">
      <div className="research-tools">
        <label>Research experiment<select value={exampleIndex} onChange={e=>setExample(+e.target.value)}>{example.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>
        <button onClick={guided}>Load experiment</button>
        <label>Ground motion<select value={project.source} onChange={e=>update({source:e.target.value,embedded:undefined})}><option value="legacy">Current simulation input</option>{(seed||project.embedded&&project.source==='protection')&&<option value="protection">Current Protection Lab input</option>}
          {records.map(r=><option key={r.id} value={r.id}>{names[r.event]} · {r.station}</option>)}</select></label>
        <label>Component<select value={project.component} onChange={e=>update({component:e.target.value as 'NS'|'EW'})}><option>NS</option><option>EW</option></select></label>
        <button className="research-primary" disabled={busy||(!input&&!records.length&&project.source!=='legacy'&&project.source!=='protection')} onClick={()=>void dispatch('study')}>Run analysis</button>
        {busy&&<button onClick={()=>{slot.close();loader.current?.abort();setBusy(false);setStatus('Calculation cancelled.');}}>Cancel job</button>}
      </div>
      <p className="research-meta" role="status">{status}</p>
      {input&&<div className="research-meta"><p>{input.label} · {input.acceleration.length.toLocaleString()} samples · {fmt((input.acceleration.length-1)*input.dt)} s · {fmt(1/input.dt)} Hz</p>
        {input.provenance&&<details><summary>Recording provenance</summary><p style={{overflowWrap:'anywhere'}}>{input.provenance}</p></details>}
      </div>}
      <details><summary>Structural configurations and signal settings</summary>
        <div className="research-tools"><label>Case count<select value={project.variants.length} onChange={e=>update({variants:Array.from({length:+e.target.value},(_,i)=>project.variants[i]??presetVariant(models[i]))})}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>
        {project.variants.map((v,i)=><label key={i}>Case {i+1}<select value={v.archetype} onChange={e=>update({variants:project.variants.map((item,j)=>i===j?presetVariant(e.target.value as Archetype):item)})}>
          {!models.includes(v.archetype)&&<option>{v.archetype}</option>}{models.map(name=><option key={name}>{name}</option>)}</select></label>)}</div>
        <div className="research-tools">
        <label>Spectrum damping (%)<input key={project.name} defaultValue={project.settings.ratios.map(v=>v*100).join(', ')} onBlur={e=>{const list=e.target.value.split(',').map(Number).map(n=>n/100);if(list.length&&list.length<=8&&list.every(v=>Number.isFinite(v)&&v>=0&&v<1))update({settings:{...project.settings,ratios:[...new Set(list)]}});else setStatus('Use up to eight damping ratios from 0 to less than 100%.');}}/></label>
        <label>FFT window<select value={project.settings.window} onChange={e=>update({settings:{...project.settings,window:e.target.value as WindowName}})}><option>Hann</option><option>Hamming</option><option>Rectangular</option></select></label>
        <label><input type="checkbox" checked={project.settings.demean} onChange={e=>update({settings:{...project.settings,demean:e.target.checked}})}/> Remove signal mean</label>
        {advanced&&<><Num label="Arias bracket threshold (m/s²)" value={project.settings.threshold} set={threshold=>update({settings:{...project.settings,threshold}})}/>
          <Num label="Minimum oscillator period (s)" value={project.settings.periodMin??.05} set={periodMin=>update({settings:{...project.settings,periodMin}})}/>
          <Num label="Maximum oscillator period (s)" value={project.settings.periodMax??10} set={periodMax=>update({settings:{...project.settings,periodMax}})}/>
          <Num label="STFT window samples" value={project.settings.frame} set={frame=>update({settings:{...project.settings,frame}})}/>
          <Num label="STFT overlap (fraction)" value={project.settings.overlap} set={overlap=>update({settings:{...project.settings,overlap}})}/>
          <label>FFT zero-padding<select value={project.settings.pad} onChange={e=>update({settings:{...project.settings,pad:+e.target.value}})}>{[1,2,4].map(n=><option key={n}>{n}</option>)}</select></label></>}
        </div>
      </details>
    </section>
    <nav aria-label="Analysis panels" className="research-tabs">
      <label>Analysis tools <select value={tab} onChange={e=>setTab(e.target.value as typeof tab)}>
        <optgroup label="Ground Motion"><option>Ground motion</option><option>Frequency</option></optgroup>
        <optgroup label="Structural Dynamics"><option>Response spectra</option><option>Modal analysis</option></optgroup>
        <optgroup label="Structural Response"><option>Structural response</option><option>Energy</option><option>Comparison</option></optgroup>
        <optgroup label="Research Laboratory"><option>Research sweeps</option><option>Verification</option><option>Math lab</option></optgroup>
        <optgroup label="Reports and Data"><option>Export &amp; projects</option></optgroup>
      </select></label>
    </nav>
    <section className="research-card research-panel" ref={stage}>
      <div className="research-tools"><h2>{tab}</h2><button onClick={()=>void fullscreen.toggle()}>{fullscreen.expanded?'Exit fullscreen':'Expand panel'}</button>
      {study&&<label>Active configuration<select value={caseIndex} onChange={e=>{setCase(+e.target.value);setDof(0);setMode(0);}}>{study.cases.map((r,i)=><option key={i} value={i}>{i+1} · {r.name}</option>)}</select></label>}
      {time&&<label>Time cursor {cursor.toFixed(2)} s<input type="range" min={0} max={time.at(-1)} step={input?.dt} value={cursor} onChange={e=>setCursor(+e.target.value)}/></label>}</div>
      {study&&input&&run&&tab==='Ground motion'&&<>
        <div className="research-stats">{[['PGA (g)',study.intensity.pga/G],['RMS (m/s²)',study.intensity.rms],['Arias (m/s)',study.intensity.arias],['D5–95 (s)',study.intensity.d595],['D5–75 (s)',study.intensity.d575],['Bracketed (s)',study.intensity.bracket],['Record (s)',study.intensity.duration],['Dominant (Hz)',study.fft.dominant]].map(([label,value])=><div key={label}><span>{label}</span><strong>{fmt(value as number|null)}</strong></div>)}</div>
        {selected&&<label>Compare same-event station<select value={stationComparison?.label??''} onChange={e=>void compareStation(records.find(r=>r.event===selected.event&&r.station===e.target.value)?.id??'')}><option value="">Off</option>{records.filter(r=>r.event===selected.event&&r.id!==selected.id).map(r=><option key={r.id}>{r.station}</option>)}</select></label>}
        {stationComparison&&<p className="research-meta">{stationComparison.label} · UTC start offset {stationComparison.offset.toFixed(2)} s · {stationComparison.motion.provenance}</p>}
        <Chart series={[{name:input.label,x:run.time,y:input.acceleration},...(stationComparison?[{name:stationComparison.label,x:Float64Array.from(stationComparison.motion.acceleration,(_,i)=>stationComparison.offset+i*stationComparison.motion.dt),y:stationComparison.motion.acceleration}]:[])]} x="Time (s)" y="Ground acceleration (m/s²)" cursor={cursor}/>
        <Chart series={[{name:'Arias intensity',x:run.time,y:study.intensity.cumulative}]} x="Time (s)" y="Cumulative intensity (m/s)" cursor={cursor}/>
      </>}
      {study&&tab==='Response spectra'&&<>
        <div className="research-tools"><label>Response quantity<select value={spectrum} onChange={e=>setSpectrum(e.target.value as typeof spectrum)}>{spectrumNames.map(x=><option key={x}>{x}</option>)}</select></label><label><input type="checkbox" checked={log} onChange={e=>setLog(e.target.checked)}/> Log period axis</label></div>
        <p className="research-meta">Amber markers show fundamental periods of the selected configurations. True oscillator acceleration and pseudo-acceleration are distinct quantities. {study.samplingWarning}</p>
        <Chart markers={study.cases.map(c=>c.run.structure.modes[0].period)} log={log} x="Oscillator period (s)" y={spectrum+' ('+(spectrum==='Sd'?'m':spectrum==='PSV'||spectrum==='Relative velocity'?'m/s':'m/s²')+')'}
          series={study.spectra.map(s=>({name:fmt(100*s.ratio)+'% damping',x:s.points.map(p=>p.period),y:s.points.map(p=>p[spectrum])}))}/>
      </>}
      {study&&tab==='Frequency'&&<>
        <div className="research-tools"><label><input type="checkbox" checked={psd} onChange={e=>setPsd(e.target.checked)}/> PSD</label><label><input type="checkbox" checked={spectro} onChange={e=>setSpectro(e.target.checked)}/> Spectrogram</label><label><input type="checkbox" checked={angular} onChange={e=>setAngular(e.target.checked)}/> Angular frequency</label>
          <label><input type="checkbox" checked={log} onChange={e=>setLog(e.target.checked)}/> Log frequency</label><Num label="Max frequency (Hz)" value={maxFrequency} min={.1} set={setMaxFrequency}/></div>
        <p className="research-meta">Sampling {fmt(2*study.fft.nyquist)} Hz · Nyquist {fmt(study.fft.nyquist)} Hz · bin {fmt(study.fft.bin)} Hz · record resolution {fmt(study.fft.resolution)} Hz. Padding interpolates bins and does not sharpen physical resolution.</p>
        {spectro?<Heat label="Spectrogram · x time (s) · y frequency (Hz) · PSD (dB re 1 (m/s²)²/Hz)" positive x={study.spectrogram.time} y={study.spectrogram.frequency.filter(f=>f<=maxFrequency)}
          rows={Array.from(study.spectrogram.frequency.filter(f=>f<=maxFrequency),(_,i)=>study.spectrogram.frames.map(f=>10*Math.log10(Math.max(1e-12,f[i]))))}/>:<Chart log={log}
          series={[{name:psd?'Periodogram':'Fourier amplitude',x:study.fft.frequency.filter(f=>f<=maxFrequency&&(!log||f>0)).map(f=>f*(angular?2*Math.PI:1)),y:(psd?study.fft.psd:study.fft.amplitude).filter((_,i)=>study.fft.frequency[i]<=maxFrequency&&(!log||i>0))}]}
          x={angular?'Angular frequency (rad/s)':'Frequency (Hz)'} y={psd?'PSD ((m/s²)²/Hz)':'Amplitude (m/s²)'}/>}
      </>}
      {run&&currentMode&&tab==='Modal analysis'&&<>
        <Num label="Mode index (zero-based)" value={modeIndex} min={0} max={n-1} step={1} set={v=>setMode(Math.max(0,Math.min(n-1,Math.round(v)||0)))}/>
        <DataTable head={['Mode','Frequency (Hz)','Period (s)','Participation','Effective mass (kg)','Effective mass (%)','Cumulative (%)']} rows={run.structure.modes.map((m,i)=>[i+1,fmt(m.hz),fmt(m.period),fmt(m.participation),fmt(m.effectiveMassKg),fmt(100*m.effectiveMassRatio),fmt(100*run.structure.modes.slice(0,i+1).reduce((a,r)=>a+r.effectiveMassRatio,0))])}/>
        <Chart x="Mode index" y="Effective modal mass (%)" series={[{name:'Individual',x:run.structure.modes.map((_,i)=>i+1),y:run.structure.modes.map(m=>m.effectiveMassRatio*100)},{name:'Cumulative',x:run.structure.modes.map((_,i)=>i+1),y:run.structure.modes.map((_,i)=>100*run.structure.modes.slice(0,i+1).reduce((sum,m)=>sum+m.effectiveMassRatio,0))}]}/>
        <button onClick={()=>setModePlaying(v=>!v)}>{modePlaying?'Pause mode shape':'Animate mode shape'}</button><label>Mode shape phase <input type="range" min={0} max={100} value={mathStep} onChange={e=>setMathStep(+e.target.value)}/></label>
        <svg className="research-mode" viewBox="0 0 500 240" role="img" aria-label="Projected normalized mode shape">
          {Array.from(currentMode.shape,(v,i)=>{
            const x=210+90*Math.cos(phase)*v/Math.max(...Array.from(currentMode.shape,Math.abs)),y=218-(i+1)*195/n;
            return <g key={i}><path d={'M '+x+' '+y+' l 83 0 22 -12 -83 0 Z'} fill="#72d8e7" stroke="#25475d"/><text x={x-20} y={y} fill="#e0f1f6">{i+1}</text></g>;
          })}
        </svg>
      </>}
      {run&&plotData&&tab==='Structural response'&&<>
        <div className="research-tools"><label>Response channel<select value={channel} onChange={e=>setChannel(e.target.value as Channel)}>{Object.entries(responseNames).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
          <Num label="DOF (zero-based)" value={dof} min={0} max={n-1} step={1} set={v=>setDof(Math.max(0,Math.min(n-1,Math.round(v)||0)))}/>
          <label><input type="checkbox" checked={heat} onChange={e=>setHeat(e.target.checked)}/> Demand heatmap</label></div>
        {heat&&!channel.startsWith('device')&&channel!=='base shear'?<Heat rows={plotData.rows} x={plotData.indices.map(i=>run.time[i])} y={plotData.rows.map((_,i)=>i+1)} label={'Time (s) / DOF · '+responseNames[channel]}/>:plotData.series.length?<Chart series={plotData.series} x="Time (s)" y={responseNames[channel]} cursor={cursor}/>:<p>No active device provides this channel.</p>}
        {!channel.startsWith('device')&&channel!=='base shear'&&<DataTable head={['DOF','Height (m)','Peak magnitude','Peak time (s)']} rows={plotData.envelope}/>}
      </>}
      {current&&run&&tab==='Energy'&&<><p className="research-meta">Peak numerical residual {fmt(run.peak.energyResidual)} J. Total dissipation is the sum of localized dashpot groups.</p>
        <Chart series={[...(['kinetic','strain','work','dissipation'] as const).map(k=>({name:k,x:run.time,y:run.energy[k]})),...energyKinds.map(k=>({name:k,x:run.time,y:current.split[k]}))]} x="Time (s)" y="Energy (J)" cursor={cursor}/>
        <Chart series={[{name:'Balance residual',x:run.time,y:run.energy.residual}]} x="Time (s)" y="Residual (J)" cursor={cursor}/>
      </>}
      {study&&reference&&tab==='Comparison'&&<>
        <label>Baseline case<select value={baseline} onChange={e=>setBaseline(+e.target.value)}>{study.cases.map((r,i)=><option key={i} value={i}>{r.name}</option>)}</select></label>
        <DataTable head={['Case','Roof (mm)','Drift (%)','Acceleration (g)','Reaction (kN)','T1 (s)','Isolation stroke (m)','Device force (kN)','Dissipation (J)']} rows={study.cases.map(c=>[c.name,fmt(c.run.peak.roofDisplacement*1000),fmt(c.run.peak.superstructureDrift*100),fmt(c.run.peak.floorAcceleration/G),fmt(c.run.peak.baseShear/1000),fmt(c.run.structure.modes[0].period),c.devices.some(d=>d.kind==='Isolation')?fmt(c.devices.find(d=>d.kind==='Isolation')!.travel.reduce((p,v)=>Math.max(p,Math.abs(v)),0)):'—',fmt(Math.max(0,...c.devices.map(d=>d.force.reduce((p,v)=>Math.max(p,Math.abs(v)/1000),0)))),fmt(c.run.energy.dissipation.at(-1))])}/>
        <details><summary>Compare different recordings</summary>
          <p>Compare independent record windows using the original duration and interval for each station.</p>
          <div className="research-tools"><label>Second historical record<select value={batchRecord} onChange={e=>{setBatchRecord(e.target.value);setBatch(undefined);}}>{records.filter(r=>r.id!==project.source).map(r=><option key={r.id} value={r.id}>{names[r.event]} · {r.station}</option>)}</select></label>
            <button disabled={busy} onClick={()=>void dispatch('batch')}>Compare records</button></div>
          {batch&&<><DataTable head={['Input','Building','Δt (s)','Duration (s)','PGA (g)','Arias (m/s)','Roof (mm)','Drift (%)']} rows={batch.map(r=>[r.input,r.case,fmt(r.dt),fmt(r.duration),fmt(r.pga/G),fmt(r.arias),fmt(r.peak.roofDisplacement*1000),fmt(r.peak.superstructureDrift*100)])}/>
          {[...new Set(batch.map(r=>r.provenance))].map(s=><p key={s} className="research-meta">{s}</p>)}</>}
        </details>
        <Chart x="Drift reduction (%)"  y="Acceleration reduction (%)" series={study.cases.map(c=>({name:c.name,markers:true,x:[responseChange(reference.run.peak.superstructureDrift,c.run.peak.superstructureDrift)??NaN],y:[responseChange(reference.run.peak.floorAcceleration,c.run.peak.floorAcceleration)??NaN]}))}/>
        {study.cases.some(c=>c.sweep.length>0)&&<Chart x="Excitation frequency (Hz)" y="Steady-state roof amplitude (m per m/s²)" series={study.cases.map(c=>({name:c.name,x:c.sweep.map(p=>p[0]),y:c.sweep.map(p=>p[1]??NaN)}))}/>}

      </>}
      {tab==='Research sweeps'&&<>
        {axisEditor(project.axis,axis=>update({axis}),'First parameter')}
        <label><input type="checkbox" checked={project.grid} onChange={e=>update({grid:e.target.checked})}/> Two-parameter grid</label>
        {project.grid&&axisEditor(project.axis2,axis2=>update({axis2}),'Second parameter')}
        <div className="research-tools"><label>Response objective (SI)<select value={project.objective} onChange={e=>update({objective:e.target.value as Objective})}>{objectives.map(o=><option key={o}>{o}</option>)}</select></label>
          <button disabled={busy} onClick={()=>void dispatch('sweep')}>Run sweep</button><button disabled={busy} onClick={()=>void dispatch('sensitivity')}>Run sensitivity</button></div>
        {sweep&&<><p>Minimum {fmt(sweep.min)} · Maximum {fmt(sweep.max)} · Baseline {fmt(sweep.baseline)}. Case A, same input for each point.</p>
          {project.grid?<Heat label={project.axis.parameter+' / '+project.axis2.parameter+' · '+project.objective} x={sweep.x} y={sweep.y} rows={sweep.observed} positive/>:<Chart x={project.axis.parameter} y={project.objective+' (SI)'} series={[{name:'Sweep',x:sweep.x,y:sweep.observed[0]},{name:'Baseline',x:sweep.x,y:sweep.x.map(()=>sweep.baseline)}]}/>}</>}
        {sensitivity&&<><h3>Local sensitivity · ±10%</h3><DataTable head={['Parameter','Low perturbation reduction (%)','High perturbation reduction (%)','Slope (SI / parameter unit)','Normalized sensitivity']} rows={sensitivity.map(s=>[s.parameter,fmt(s.low),fmt(s.high),fmt(s.absolute),fmt(s.elasticity)])}/>
          <div className="research-tornado">{sensitivity.map(s=><div key={s.parameter}><span>{s.parameter}</span>{[s.low,s.high].map((v,i)=><meter key={i} min={0} max={Math.max(1,...sensitivity.flatMap(a=>[Math.abs(a.low??0),Math.abs(a.high??0)]))} value={Math.abs(v??0)} title={fmt(v)+'% reduction'}/>)}</div>)}</div></>}
      </>}
      {tab==='Verification'&&<><p>Refine the integration interval with piecewise-linear input interpolation. Differences refer to the finest tested run on the original time grid.</p>
        <button disabled={busy} onClick={()=>void dispatch('convergence')}>Run convergence test</button>
        {convergence&&<DataTable head={['Δt (s)','Peak roof (m)','Peak difference (m)','Max history difference (m)','Residual (J)','Time (ms)']} rows={convergence.map(r=>[fmt(r.dt),fmt(r.peak),fmt(r.peakDifference),fmt(r.maxHistoryDifference),fmt(r.residual),fmt(r.ms)])}/>}</>}
      {tab==='Math lab'&&<>
        <h3>Mü + Ců + Ku = −Mr aᵍ</h3><p>Inertia, damping and spring forces balance the equivalent lateral load from ground acceleration. For a link with stiffness k between coordinates i and j, the diagonal entries gain k and the off-diagonal entries lose k.</p>
        <label>Derivation step<input type="range" min={0} max={4} value={Math.min(4,mathStep)} onChange={e=>setMathStep(+e.target.value)}/></label>
        <p>{['One mass: ω = √(k/m).','Two masses: add symmetric spring contributions.','Find undamped modes from det(K − ω²M) = 0.','Newmark advances displacement and velocity from equilibrium acceleration.','Recover energy using the quadratic mass and stiffness forms.'][Math.min(4,mathStep)]}</p>
        {run&&<details open={advanced}><summary>Actual system matrix</summary><label>Matrix<select value={matrix} onChange={e=>setMatrix(e.target.value as typeof matrix)}><option>M</option><option>K</option><option>C</option></select></label>
          <DataTable head={Array.from({length:n},(_,i)=>String(i+1))} rows={Array.from({length:n},(_,i)=>Array.from(run.structure[matrix].slice(i*n,(i+1)*n),fmt))}/></details>}
      </>}
      {tab==='Export & projects'&&<>
        <div className="research-tools"><label>Export resolution<select value={exportMode} onChange={e=>setExportMode(e.target.value as typeof exportMode)}><option>Full resolution</option><option>Lightweight</option></select></label>
          <button disabled={busy} onClick={()=>void dispatch('csv')}>Download engineering CSV</button><button disabled={busy} onClick={()=>void dispatch('json')}>Download research JSON</button>
          <label>Report format<select value={reportFormat} onChange={e=>setReportFormat(e.target.value as typeof reportFormat)}><option>Comprehensive</option><option>Compact</option></select></label>
          <button disabled={!study} onClick={()=>void makePdf()}>Generate research PDF</button>
          {metadata&&<button onClick={()=>saveBlob('metadata.json',new Blob([metadata],{type:'application/json'}))}>Download CSV metadata</button>}</div>
        <div className="research-tools">{(Object.keys(sections) as (keyof typeof sections)[]).map(key=><label key={key}><input type="checkbox" checked={sections[key]} onChange={e=>setSections(old=>({...old,[key]:e.target.checked}))}/>{key==='signals'?'Signal charts':key==='comparison'?'Comparative time histories':'Model parameters'}</label>)}</div>
        {pdf&&<><p><a href={pdf} target="_blank" rel="noreferrer">Open generated PDF</a></p><section className="research-report-preview"><h3>SeismoNepal 3D | Research Laboratory</h3><h4>{project.name}</h4><p>{input?.label}</p><p>{input?.provenance}</p><p>Arias intensity {fmt(study?.intensity.arias)} m/s · Record duration {fmt(study?.intensity.duration)} s · {study?.cases.length} structural configurations</p><p>Linear one-axis educational response. Reports retain the station source and numerical assumptions.</p></section></>}
        <p className="research-meta">Full resolution reruns the solver and exports every integration timestamp. Lightweight output reduces rows. Case and DOF identifiers are described in the metadata.</p>
        <div className="research-tools"><label>Experiment name<input maxLength={100} value={project.name} onChange={e=>setProject(old=>({...old,name:e.target.value}))}/></label>
          <label>Notes<textarea maxLength={2000} value={project.notes} onChange={e=>setProject(old=>({...old,notes:e.target.value}))}/></label>
          <button onClick={()=>{try{const p=readResearch(JSON.stringify(archiveProject()));saveList([...saved.filter(s=>s.name!==p.name),p].slice(-12));setSavedIndex(Math.min(11,saved.filter(s=>s.name!==p.name).length));setStatus('Experiment saved locally.');}catch(e){setStatus(String(e));}}}>Save experiment</button>
          <button onClick={()=>saveBlob('experiment.json',new Blob([JSON.stringify(archiveProject(),null,2)],{type:'application/json'}))}>Export experiment</button>
          <label>Import experiment<input type="file" accept=".json" onChange={e=>setFile(e.target.files?.[0])}/></label>
          <button disabled={!file} onClick={()=>{if(file&&file.size>700000){setStatus('Experiment file exceeds 700 KB.');return;}if(file)void file.text().then(t=>update(readResearch(t))).catch(e=>setStatus(String(e)));}}>Import selected file</button></div>
        {saved.length>0&&<div className="research-tools"><label>Saved experiments<select value={savedIndex} onChange={e=>{setSavedIndex(+e.target.value);setRemove(false);}}>{saved.map((s,i)=><option key={i} value={i}>{s.name}</option>)}</select></label>
          <button onClick={()=>update(saved[savedIndex])}>Reopen</button><button onClick={()=>saveList([...saved,{...saved[savedIndex],name:saved[savedIndex].name.slice(0,75)+' copy '+Date.now()}].slice(-12))}>Duplicate</button>
          <button onClick={()=>{if(remove)saveList(saved.filter((_,i)=>i!==savedIndex));else setRemove(true);}}>{remove?'Confirm deletion':'Delete saved experiment'}</button></div>}
      </>}
      {!study&&['Ground motion','Response spectra','Frequency','Modal analysis','Structural response','Energy','Comparison'].includes(tab)&&<p>Run an analysis to display results.</p>}
      <p className="research-meta">Calculated linear educational response. Modelled demand does not establish structural capacity or code compliance.</p>
    </section>
  </article>;
}
