import {lazy,Suspense,useEffect,useRef,useState,type FormEvent} from 'react';
import {engineeringPreset,engineeringPresets,importCsv,duration,G,channels,type Damping,type EngineeringResult,type GroundMotion,type Model,type Storey} from './engine';
import './diagnostics.css';
import type {SimulationJob,WorkerMessage} from './engine/workerProtocol';

const ResultChart=lazy(()=>import('./DiagnosticChart'));
const defaults={dt:.005,seconds:18,frequency:1.4,pga:.25,seed:17,stride:3};
const initialModel=()=>engineeringPreset('Concrete frame');
const fields=[['massKg','Mass (kg)',1000],['heightM','Height (m)',.05],['stiffnessNPerM','Stiffness (N/m)',100000],['damperNsPerM','Dashpot (N·s/m)',100],['initialDisplacementM','Initial u (m)',.001],['initialVelocityMPerS','Initial v (m/s)',.001]] as const;

export default function Diagnostics(){
  const [model,setModel]=useState(initialModel);
  const [preset,setPreset]=useState<(typeof engineeringPresets)[number]>('Concrete frame');
  const [settings,setSettings]=useState(defaults);
  const [kind,setKind]=useState<'sine'|'envelope'|'seeded'|'zero'|'import'>('envelope');
  const [damping,setDamping]=useState<Damping['kind']>('mass');
  const [ratio,setRatio]=useState(5);
  const [ratio2,setRatio2]=useState(5);
  const [firstMode,setFirstMode]=useState(0);
  const [secondMode,setSecondMode]=useState(1);
  const [provenance,setProvenance]=useState('');
  const [recording,setRecording]=useState<GroundMotion|null>(null);
  const [result,setResult]=useState<EngineeringResult|null>(null);
  const [solvedLabel,setSolvedLabel]=useState('');
  const [matrix,setMatrix]=useState<'M'|'K'|'C'>('M');
  const [progress,setProgress]=useState<number|null>(null);
  const [message,setMessage]=useState('Ready to run a fixed-base model.');
  const [failed,setFailed]=useState(false);
  const worker=useRef<Worker|null>(null);
  const importGeneration=useRef(0);
  useEffect(()=>()=>{worker.current?.terminate();importGeneration.current++;},[]);
  const busy=progress!==null;
  const size=model.storeys.length;
  function updateStorey(i:number,key:keyof Storey,value:number){
    setModel(old=>({...old,storeys:old.storeys.map((s,j)=>i===j?{...s,[key]:value}:s)}));
  }
  function changeCount(count:number){
    setModel(old=>({...old,storeys:Array.from({length:count},(_,i)=>old.storeys[i]??{...old.storeys.at(-1)!})}));
    setFirstMode(0);setSecondMode(Math.min(1,count-1));
    if((count===1&&damping==='rayleigh')||(count>1&&damping==='viscous'))setDamping('mass');
  }
  function restore(){
    importGeneration.current++;
    worker.current?.terminate();worker.current=null;
    setProgress(null);setResult(null);setModel(initialModel());setPreset('Concrete frame');
    setSettings(defaults);setKind('envelope');setDamping('mass');setRatio(5);setRatio2(5);
    setFirstMode(0);setSecondMode(1);setRecording(null);setProvenance('');setMatrix('M');setFailed(false);
    setMessage('Default configuration restored.');
  }
  function cancel(){
    worker.current?.terminate();worker.current=null;setProgress(null);setFailed(false);setMessage('Run cancelled.');
  }
  async function importFile(file?:File){
    if(!file)return;
    const generation=++importGeneration.current;
    try{
      if(file.size>16_000_000)throw new Error('Choose a CSV under 16 MB.');
      const motion=importCsv(await file.text(),file.name,provenance);
      if(generation!==importGeneration.current)return;
      setRecording(motion);setSettings(old=>({...old,dt:motion.dt,seconds:duration(motion)}));
      setFailed(false);setMessage('Loaded '+motion.label);
    }catch(error){
      if(generation!==importGeneration.current)return;
      setRecording(null);setFailed(true);setMessage(error instanceof Error?error.message:String(error));
    }
  }
  function run(event:FormEvent){
    event.preventDefault();
    if(worker.current)return;
    try{
      let input:SimulationJob['input'];
      if(kind==='import'){
        if(!recording)throw new Error('Import a sourced acceleration CSV first.');
        input={kind:'recording',motion:recording,dt:settings.dt,seconds:settings.seconds};
      }else{
        const zero=kind==='zero';
        input={kind:'synthetic',zero,options:{dt:settings.dt,seconds:settings.seconds,frequencyHz:zero?.001:settings.frequency,
          amplitude:zero?0:settings.pga,unit:'g',seed:settings.seed,kind:zero?'sine':kind}};
      }
      const zeta=ratio/100;
      const config:Damping=damping==='none'?{kind:'none'}:
        damping==='viscous'?{kind:'viscous',ratio:zeta}:
        damping==='rayleigh'?{kind:'rayleigh',first:{mode:firstMode,ratio:zeta},second:{mode:secondMode,ratio:ratio2/100}}:
        {kind:damping,mode:firstMode,ratio:zeta};
      const instance=new Worker(new URL('./engine/worker.ts',import.meta.url),{type:'module'});
      worker.current=instance;
      setProgress(0);setFailed(false);setMessage('Solving structural response…');
      function finish(){
        instance.terminate();worker.current=null;setProgress(null);
      }
      instance.onmessage=({data}:{data:WorkerMessage})=>{
        if(worker.current!==instance)return;
        if(data.type==='progress'){setProgress(data.fraction);return;}
        finish();
        if(data.type==='result'){
          setResult(data.result);setSolvedLabel(data.label);
          setMessage('Simulation complete.');
        }else{setFailed(true);setMessage(data.message);}
      };
      instance.onerror=()=>{
        if(worker.current!==instance)return;
        finish();setFailed(true);setMessage('The simulation worker stopped. Try a shorter run or a larger output stride.');
      };
      instance.postMessage({model:{...model,damping:config},input,controls:{stride:settings.stride}});
    }catch(error){
      worker.current?.terminate();worker.current=null;setProgress(null);
      setFailed(true);setMessage(error instanceof Error?error.message:String(error));
    }
  }
  function download(){
    if(!result)return;
    const n=result.structure.mass.length;
    const columns=['time_s','ground_m_s2','base_shear_N','kinetic_J','strain_J','dissipation_J','input_work_J','energy_residual_J'];
    const units=['m','m_s','m_s2','m_s2','m','ratio','N'];
    for(let i=0;i<n;i++)channels.forEach((channel,j)=>columns.push('floor_'+(i+1)+'_'+channel+'_'+units[j]));
    const grid=[columns.join(',')+'\n'];
    for(let j=0;j<result.time.length;j++){
      const e=result.energy,row=[result.time[j],result.ground[j],result.baseShear[j],e.kinetic[j],e.strain[j],e.dissipation[j],e.work[j],e.residual[j]];
      for(let i=0;i<n;i++)for(const channel of channels)row.push(result.traces[channel][j*n+i]);
      grid.push(row.join(',')+'\n');
    }
    const uri=URL.createObjectURL(new Blob(grid,{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=uri;link.download='seismonepal-engine-run.csv';link.click();setTimeout(()=>URL.revokeObjectURL(uri),1000);
  }
  const field=(key:keyof typeof settings,label:string,min:number,max:number,step:number|'any')=><label>{label}<input type="number" required min={min} max={max} step={step} value={Number.isNaN(settings[key])?'':settings[key]} onChange={e=>setSettings(old=>({...old,[key]:e.target.valueAsNumber}))}/></label>;
  const modeOptions=Array.from({length:size},(_,i)=><option value={i} key={i}>{i+1}</option>);
  const number=(value:number)=>Math.abs(value)>=1e5||(value!==0&&Math.abs(value)<.001)?value.toExponential(3):value.toLocaleString('en-US',{maximumFractionDigits:4});
  return <div className="engine-lab">
    <div className="heading"><div><h1>Structural dynamics diagnostics</h1><p>Run a linear shear-building model and inspect its matrices, modes, and numerical response.</p></div></div>
    <div className="engine-layout">
      <form className="panel engine-config" onSubmit={run}>
        <fieldset disabled={busy}>
          <legend>Model configuration</legend>
          <div className="engine-fields">
            <label>Educational preset<select value={preset} onChange={e=>{const name=e.target.value as typeof preset;setPreset(name);setModel(engineeringPreset(name));setDamping('mass');setFirstMode(0);setSecondMode(1);}}>{engineeringPresets.map(name=><option key={name}>{name}</option>)}</select></label>
            <label>Storeys<select value={size} onChange={e=>changeCount(+e.target.value)}>{Array.from({length:20},(_,i)=><option key={i}>{i+1}</option>)}</select></label>
          </div>
          <details open><summary>Independent storey inputs</summary>
            {model.storeys.map((storey,i)=><details className="storey" key={i} open={i===0||undefined}><summary>Storey {i+1}{i===size-1?' · Roof':''}</summary>
              <div className="engine-fields">{fields.map(([key,label,step])=><label key={key}>{label}<input type="number" required min={key==='massKg'||key==='heightM'||key==='stiffnessNPerM'?.001:key==='damperNsPerM'?0:undefined} step="any" inputMode="decimal" title={'Typical edit increment '+step} value={Number.isNaN(storey[key])?'':storey[key]??0} onChange={e=>updateStorey(i,key,e.target.valueAsNumber)}/></label>)}</div>
            </details>)}
          </details>
          <details><summary>Damping</summary><div className="engine-fields">
            <label>Model<select value={damping} onChange={e=>setDamping(e.target.value as Damping['kind'])}><option value="none">None</option><option value="mass">Mass proportional</option><option value="stiffness">Stiffness proportional</option>{size===1?<option value="viscous">Viscous SDOF</option>:<option value="rayleigh">Rayleigh · two modes</option>}</select></label>
            {damping!=='none'&&<label>Target damping (%)<input type="number" required min={0} max={100} step="any" value={Number.isNaN(ratio)?'':ratio} onChange={e=>setRatio(e.target.valueAsNumber)}/></label>}
            {damping!=='none'&&damping!=='viscous'&&<label>Target mode<select value={firstMode} onChange={e=>setFirstMode(+e.target.value)}>{modeOptions}</select></label>}
            {damping==='rayleigh'&&<><label>Second mode<select value={secondMode} onChange={e=>setSecondMode(+e.target.value)}>{modeOptions}</select></label><label>Second damping (%)<input type="number" required min={0} max={100} step="any" value={Number.isNaN(ratio2)?'':ratio2} onChange={e=>setRatio2(e.target.valueAsNumber)}/></label></>}
          </div><p>Storey dashpots add damping to the selected global model.</p></details>
          <details open><summary>Motion and integration</summary>
            <label>Input<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="envelope">Synthetic envelope</option><option value="seeded">Seeded synthetic</option><option value="sine">Synthetic sine</option><option value="zero">Zero · free vibration</option><option value="import">Import recording</option></select></label>
            {kind==='import'&&<><label>Recording source<input value={provenance} placeholder="Archive or station reference" onChange={e=>setProvenance(e.target.value)}/></label><label>Acceleration CSV<input type="file" accept=".csv,text/csv" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label><p>Headers work with <code>time_s,accel_g</code> or <code>time_s,accel_m_s2</code>.</p></>}
            <div className="engine-fields">
              {field('dt','Time step (s)',.00001,1,'any')}{field('seconds','Duration (s)',.00001,3600,'any')}
              {kind!=='zero'&&kind!=='import'&&<>{field('pga',kind==='sine'?'Amplitude (g)':'Peak input (g)',0,1000,'any')}{field('frequency','Frequency (Hz)',.001,500,'any')}</>}
              {kind==='seeded'&&field('seed','Seed',0,4294967295,1)}
              {field('stride','Save every N steps',1,200001,1)}
            </div>
          </details>
        </fieldset>
        <div className="engine-actions">
          <button className="engine-run" disabled={busy}>Run simulation</button>
          <button type="button" disabled={!busy} onClick={cancel}>Cancel</button><button type="button" onClick={restore}>Reset</button>
        </div>
      </form>
      <div className="engine-results">
        <section className="panel engine-status"><div><h2>Solver status</h2><p role="status" className={failed?'error':''}>{message}</p>{result&&<p>Last completed run · {solvedLabel}</p>}</div>
          {result&&<button onClick={download}>Export CSV</button>}
          {progress!==null&&<progress aria-label="Simulation progress" value={progress} max={1}/>}
        </section>
        {result&&<>
          <section className="engine-metrics">
            {[
              ['Total mass',(result.structure.totalMassKg/1000).toFixed(2)+' t'],
              ['First mode',result.structure.modes[0].hz.toFixed(3)+' Hz'],
              ['Peak roof displacement',(1000*result.peak.roofDisplacement).toFixed(2)+' mm'],
              ['Peak absolute acceleration',(result.peak.absoluteAcceleration/G).toFixed(3)+' g'],
              ['Peak drift',(100*result.peak.drift).toFixed(3)+'%'],
              ['Integration time',result.diagnostics.elapsedMs.toFixed(1)+' ms'],
            ].map(([label,value])=><div className="panel" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </section>
          <Suspense fallback={<div className="panel engine-status">Loading chart…</div>}><ResultChart key={solvedLabel+result.diagnostics.elapsedMs} result={result}/></Suspense>
          <div className="panel engine-table">
            <div className="engine-section-head"><h2>System matrices</h2><label>Matrix<select value={matrix} onChange={e=>setMatrix(e.target.value as typeof matrix)}><option value="M">Mass M (kg)</option><option value="K">Stiffness K (N/m)</option><option value="C">Damping C (N·s/m)</option></select></label></div>
            <div className="engine-table-scroll"><table><thead><tr><th scope="col">DOF</th>{Array.from(result.structure.mass.keys(),i=>i+1).map(i=><th scope="col" key={i}>{i}</th>)}</tr></thead>
              <tbody>{Array.from(result.structure.mass,(_,i)=><tr key={i}><th scope="row">{i+1}</th>{Array.from(result.structure[matrix].subarray(i*result.structure.mass.length,(i+1)*result.structure.mass.length),(value,j)=><td key={j}>{number(value)}</td>)}</tr>)}</tbody></table></div>
          </div>
          <div className="panel engine-table"><h2>Natural modes</h2><div className="engine-table-scroll"><table><thead><tr>{['Mode','ω (rad/s)','Frequency (Hz)','Period (s)','Participation (√kg)','Effective mass (kg)','Mass fraction'].map(x=><th scope="col" key={x}>{x}</th>)}</tr></thead>
          <tbody>{result.structure.modes.map((mode,i)=><tr key={i}><th scope="row">{i+1}</th>{[mode.omega,mode.hz,mode.period,mode.participation,mode.effectiveMassKg].map((x,j)=><td key={j}>{number(x)}</td>)}<td>{(100*mode.effectiveMassRatio).toFixed(2)}%</td></tr>)}</tbody></table></div></div>
          <section className="panel engine-status diagnostics-notes"><h2>Numerical diagnostics</h2>
            <p>{result.diagnostics.steps.toLocaleString()} steps · {result.diagnostics.outputSamples.toLocaleString()} stored samples · {(result.diagnostics.bytes/1048576).toFixed(2)} MiB · {result.diagnostics.duration.toFixed(4)} s simulated</p>
            <p>Input PGA {(result.diagnostics.pga/G).toFixed(4)} g · peak base shear {(result.peak.baseShear/1000).toFixed(3)} kN · max energy residual {result.peak.energyResidual.toExponential(3)} J</p>
            <p>Rayleigh α {number(result.structure.alpha)} s⁻¹ · β {number(result.structure.beta)} s</p>
            {result.warnings.map(warning=><p className="engine-warning" key={warning}>{warning}</p>)}
          </section>
        </>}
        <p className="engine-limit">Educational linear elastic model. Actual cracking, yielding and collapse require nonlinear modelling. Assessment of a real building requires a qualified engineer and detailed building information.</p>
      </div>
    </div>
  </div>;
}
