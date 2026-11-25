import {axialBrace,archetypes,bearings,braceKinds,walls,dampers,retrofits,presetVariant,type Variant,type Protection,type Archetype} from './model';
import {resize} from '../constructor/model';

export function NumberField({label,value,onChange,min,max,step=.01}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number}){
  return <label>{label}<input type="number" value={Number.isNaN(value)?'':value} min={min} max={max} step={step} onChange={e=>onChange(e.target.valueAsNumber)}/></label>;
}
function Select<T extends string>({label,value,options,onChange}:{label:string;value:T;options:readonly T[];onChange:(value:T)=>void}){
  return <label>{label}<select value={value} onChange={e=>onChange(e.target.value as T)}>{options.map(item=><option key={item}>{item}</option>)}</select></label>;
}
export default function Controls({value,onChange,engineering}:{value:Variant;onChange:(value:Variant)=>void;engineering:boolean}){
  const d=value.devices,b=value.building,n=b.levels.length;
  const totalMass=b.levels.reduce((sum,level)=>sum+level.massKg,0);
  const braceLevel=b.levels[d.braceFirst-1];
  const run=b.width/b.baysX/(d.braceKind==='V'||d.braceKind==='Inverted V'?2:1);
  const braceGeometry=braceLevel&&run>0?axialBrace(1,0,run,braceLevel.heightM):null;
  const update=<K extends keyof Protection>(key:K,v:Protection[K])=>onChange({...value,devices:{...d,[key]:v}});
  type NumericalKey={[K in keyof Protection]:Protection[K] extends number?K:never}[keyof Protection];
  const number=(key:NumericalKey,label:string,min?:number,max?:number,step?:number)=><NumberField label={label} value={d[key]} onChange={v=>update(key,v)} {...{min,max,step}}/>;
  return <div className="protection-settings">
    <Select label="Building preset" value={value.archetype} options={archetypes} onChange={(v:Archetype)=>onChange(presetVariant(v))}/>
    {engineering&&<details><summary>Superstructure</summary><div className="protection-fields">
      <label>Configuration name<input value={value.name} maxLength={80} onChange={e=>onChange({...value,name:e.target.value})}/></label>
      <NumberField label="Storeys" value={n} min={1} max={20} step={1} onChange={v=>{
        if(!Number.isInteger(v)||v<1||v>20)return;
        onChange({...value,building:resize(b,v),devices:{...d,braceFirst:Math.min(d.braceFirst,v),braceLast:Math.min(d.braceLast,v),wallFirst:Math.min(d.wallFirst,v),wallLast:Math.min(d.wallLast,v),tmdFloor:Math.min(d.tmdFloor,v),viscousStorey:Math.min(d.viscousStorey,v)}});
      }}/>
      <NumberField label="Structural damping (%)" value={b.damping} min={0} max={30} onChange={v=>onChange({...value,building:{...b,damping:v}})}/>
      <NumberField label="Uniform floor mass (kg)" value={b.levels[0].massKg} min={1000} step={1000} onChange={v=>onChange({...value,building:{...b,levels:b.levels.map(level=>({...level,massKg:v}))}})}/>
      <NumberField label="Uniform storey stiffness (N/m)" value={b.levels[0].stiffnessNPerM} min={10000} step={1000000} onChange={v=>onChange({...value,building:{...b,levels:b.levels.map(level=>({...level,stiffnessNPerM:v}))}})}/>
    </div></details>}
    <div className="protection-toggles">
      {([['isolation','Base isolation'],['brace','Steel bracing'],['wall','Shear walls'],['tmd','Tuned mass damper'],['viscous','Viscous dampers']] as const).map(([key,label])=>
        <label key={key}><input type="checkbox" checked={d[key]} onChange={e=>update(key,e.target.checked)}/>{label}</label>)}
    </div>
    {d.isolation&&<details open={engineering}><summary>Isolation bearings</summary><div className="protection-fields">
      <Select label="Bearing illustration" value={d.bearing} options={bearings} onChange={v=>update('bearing',v)}/>
      {number('period','Target isolation period (s)',.2,12)}
      {engineering&&<>{number('baseMass','Base mass (kg)',100,1e7,1000)}{number('bearingRatio','Equivalent damping ratio',0,1)}{number('capacity','Reference capacity (m)',.001,10)}
      {number('bearingK','Direct stiffness (N/m), 0 = derived',0,1e12,10000)}{number('bearingC','Direct damping (N·s/m), 0 = derived',0,1e12,10000)}</>}
      <p>All bearing styles use a linear equivalent spring and dashpot.</p>
    </div></details>}
    {d.brace&&<details open={engineering}><summary>Bracing details</summary><div className="protection-fields">
      <Select label="Bracing pattern" value={d.braceKind} options={braceKinds} onChange={v=>update('braceKind',v)}/>
      {engineering&&<>{number('braceFirst','First braced storey',1,n,1)}{number('braceLast','Last braced storey',1,n,1)}
      {number('braceBays','Braced bays',1,b.baysX,1)}{number('braceArea','Brace area (m²)',0,1,.0001)}
      {number('braceE','Steel elastic modulus (Pa)',1,1e13,1e9)}
      <label><input type="checkbox" checked={d.tensionOnly} onChange={e=>update('tensionOnly',e.target.checked)}/>Pair approximated as one active brace</label></>}
      {braceGeometry&&<p>First braced storey: {braceGeometry.length.toFixed(2)} m at {braceGeometry.angle.toFixed(1)}° from horizontal.</p>}
    </div></details>}
    {d.wall&&<details open={engineering}><summary>Shear wall details</summary><div className="protection-fields">
      <Select label="Wall layout" value={d.wallKind} options={walls} onChange={v=>update('wallKind',v)}/>
      {engineering&&<>{number('wallLength','Equivalent wall length (m)',.1,b.width)}{number('wallThickness','Wall thickness (m)',.05,5)}
      {number('wallFirst','First wall storey',1,n,1)}{number('wallLast','Last wall storey',1,n,1)}
      {number('wallE','Concrete modulus (Pa)',1,1e13,1e9)}{number('wallFactor','Effective stiffness factor',0,1)}</>}
    </div></details>}
    {d.tmd&&<details open={engineering}><summary>Tuned mass details</summary><div className="protection-fields">
      <Select label="Damper illustration" value={d.tmdKind} options={dampers} onChange={v=>update('tmdKind',v)}/>
      {number('tmdHz','Tuning frequency (Hz)',.05,30)}
      {engineering&&<>{number('tmdFloor','Attachment floor',1,n,1)}{number('tmdMass','Damper mass (kg)',1,1e7,100)}
      {number('tmdRatio','Damper damping ratio',0,1)}
      <NumberField label="Mass ratio (% of superstructure)" value={100*d.tmdMass/totalMass} min={.01} step={.1} onChange={percent=>update('tmdMass',totalMass*percent/100)}/></>}
    </div></details>}
    {d.viscous&&<details open={engineering}><summary>Viscous device details</summary><div className="protection-fields">
      {number('viscousC','Axial coefficient per device (N·s/m)',0,1e12,10000)}
      {engineering&&<>{number('viscousStorey','Installation storey',1,n,1)}{number('viscousCount','Number of devices',1,20,1)}
      {number('viscousAngle','Inclination from horizontal (°)',0,90,1)}</>}
    </div></details>}
    <Select label="Retrofit demonstration" value={d.retrofit} options={retrofits} onChange={v=>update('retrofit',v)}/>
    {engineering&&['Concrete jacketing','Steel jacketing','Soft-storey strengthening'].includes(d.retrofit)&&<div className="protection-fields">
      {number('retrofitK','Illustrative stiffness increment (fraction)',0,5)}
      {number('retrofitMass','Illustrative mass increment (fraction)',0,1)}
    </div>}
  </div>;
}
