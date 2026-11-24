import {useEffect,useMemo,useRef,useState} from 'react';
import Plotly from 'plotly.js-dist-min';
import {G,responseSpectrum,type Building,type Motion,type Result} from './solver';

type Model={building:Building;result:Result};
const chartTypes=['Ground acceleration','Displacement','Velocity','Floor acceleration','Interstorey drift','Base shear','Natural frequencies','Mode shapes','Response spectrum'] as const;
type Chart=typeof chartTypes[number];
const channels={
  'Displacement':['displacement',1000,'Displacement (mm)'],
  'Velocity':['velocity',1000,'Velocity (mm/s)'],
  'Floor acceleration':['acceleration',1/G,'Absolute acceleration (g)'],
  'Interstorey drift':['drift',100,'Interstorey drift (%)']
} as const;
export default function Analytics({models,motion,clock,theme}:{models:Model[];motion:Motion;clock:number;theme:string}){
  const plot=useRef<HTMLDivElement>(null);
  const [chart,setChart]=useState<Chart>('Ground acceleration');
  const [floor,setFloor]=useState(0);
  const [mode,setMode]=useState(0);
  const [spectralDamping,setSpectralDamping]=useState(5);
  const [error,setError]=useState('');
  const colors=theme==='light'?['#087d66','#a84226']:['#74e0b8','#ffb283'];
  const data=useMemo(()=>{
    const points=motion.acceleration.map((_,i)=>i);
    const times=points.map(i=>i*motion.dt);
    return models.map(({building,result},i)=>{
      const name='Building '+(i?'B':'A');
      const f=floor?Math.min(floor-1,building.floors-1):building.floors-1;
      let x:number[]=times,y:number[]=[],axis='Time (s)',units='';
      let traceName=name;
      if(chart==='Response spectrum'){
        const spectrum=responseSpectrum(motion,spectralDamping/100,result.soil);
        x=spectrum.map(point=>point.period);y=spectrum.map(point=>point.pseudoAcceleration);
        axis='Oscillator period (s)';units='Pseudo-spectral acceleration (g)';
      }else if(chart==='Natural frequencies'){
        x=result.modal.map((_,index)=>index+1);
        y=result.modal.map(m=>m.hz);
        axis='Mode';units='Frequency (Hz)';
      }else if(chart==='Mode shapes'){
        const shape=result.modal[Math.min(mode,result.modal.length-1)].shape;
        const isolated=building.system==='Base isolation';
        x=isolated?shape:[0,...shape];
        y=x.map((_,j)=>j);
        axis='Normalized modal displacement';units='Floor · 0 = base';
      }else if(chart==='Ground acceleration'){
        y=motion.acceleration.map(value=>value*result.soil/G);units='Site acceleration (g)';
      }else if(chart==='Base shear'){
        y=result.samples.map(s=>s.shear*.001);units='Base shear (kN)';
      }else{
        const [key,factor,label]=channels[chart];
        y=result.samples.map(s=>s[key][f]*factor);units=label;
        traceName+=' · floor '+(f+1);
      }
      return {x,y,axis,units,traceName};
    });
  },[models,motion,floor,mode,chart,spectralDamping]);
  useEffect(()=>{
    if(!plot.current)return;
    const foreground=theme==='light'?'#213632':'#dbe9e6';
    const grid=theme==='light'?'#d2e1dc':'#294044';
    const timed=chart!=='Mode shapes'&&chart!=='Natural frequencies'&&chart!=='Response spectrum';
    void Plotly.react(plot.current,data.map((d,i)=>({x:d.x,y:d.y,name:d.traceName,type:chart==='Natural frequencies'?'bar':'scatter',mode:chart==='Mode shapes'?'lines+markers':'lines',line:{color:colors[i],width:2},marker:{color:colors[i]}})),{
      autosize:true,showlegend:true,hovermode:timed?'x unified':'closest',paper_bgcolor:'transparent',plot_bgcolor:'transparent',
      font:{color:foreground,family:'system-ui'},margin:{l:75,r:24,t:22,b:80},legend:{orientation:'h',y:-.23},
      xaxis:{title:{text:data[0].axis},type:chart==='Response spectrum'?'log':'linear',gridcolor:grid,zerolinecolor:grid},yaxis:{title:{text:data[0].units},gridcolor:grid,zerolinecolor:grid},
      shapes:timed?[{type:'line',xref:'x',yref:'paper',x0:clock,x1:clock,y0:0,y1:1,line:{color:foreground,width:1,dash:'dot'}}]:[]
    },{responsive:true,displaylogo:false,scrollZoom:true}).catch(()=>setError('The chart could not be rendered.'));
  },[data,chart,clock,theme,colors[0],colors[1]]);
  useEffect(()=>{const element=plot.current;return ()=>{if(element)Plotly.purge(element)}},[]);
  return <><section className="panel analytics"><div className="chart-toolbar"><label>Analysis <select value={chart} onChange={e=>setChart(e.target.value as Chart)}>{chartTypes.map(key=><option key={key}>{key}</option>)}</select></label>
  {chart in channels&&<label>Floor <select value={floor} onChange={e=>setFloor(+e.target.value)}><option value={0}>Each roof</option>{Array.from({length:Math.max(...models.map(m=>m.building.floors))},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></label>}
  {chart==='Response spectrum'&&<label>Oscillator damping <select value={spectralDamping} onChange={e=>setSpectralDamping(+e.target.value)}>{[2,5,10,20].map(n=><option value={n} key={n}>{n}%</option>)}</select></label>}
  {chart==='Mode shapes'&&<label>Mode <select value={mode} onChange={e=>setMode(+e.target.value)}>{Array.from({length:Math.min(...models.map(m=>m.result.modal.length))},(_,i)=><option value={i} key={i}>{i+1}</option>)}</select></label>}</div>
  {chart==='Response spectrum'&&<p className="muted">Peak elastic displacement × squared natural frequency, normalized by gravity. Short periods are limited by the input sample interval.</p>}
  {error&&<p role="alert">{error}</p>}<div className="plot" ref={plot}/></section>
  <section className="panel results"><h2>Peak response</h2><table><thead><tr><th scope="col">Measure</th>{models.map((_,i)=><th scope="col" key={i}>{i?'B':'A'}</th>)}{models.length>1&&<th scope="col">B − A</th>}</tr></thead><tbody>{([
    ['Displacement','displacement',1000,'mm'],['Acceleration','acceleration',1/G,'g'],['Interstorey drift','drift',100,'%'],['Base shear','shear',.001,'kN']
  ] as const).map(([label,key,scale,unit])=><tr key={key}><th scope="row">{label} ({unit})</th>{models.map(({result},i)=><td key={i}>{(result.peaks[key]*scale).toFixed(3)}</td>)}{models.length>1&&<td>{((models[1].result.peaks[key]-models[0].result.peaks[key])*scale).toFixed(3)}</td>}</tr>)}</tbody></table></section></>;
}
