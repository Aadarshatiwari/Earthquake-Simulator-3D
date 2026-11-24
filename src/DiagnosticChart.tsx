import {useEffect,useRef,useState} from 'react';
import Plotly from 'plotly.js-dist-min';
import {G,type EngineeringResult} from './engine';
const charts=['Displacement','Acceleration','Storey drift','Energy balance','Energy residual','Input motion','Mass distribution','Mode shape'] as const;
export default function DiagnosticChart({result}:{result:EngineeringResult}){
  const plot=useRef<HTMLDivElement>(null);
  const [chart,setChart]=useState<(typeof charts)[number]>('Displacement');
  const n=result.structure.mass.length;
  const [floor,setFloor]=useState(n-1);
  const [mode,setMode]=useState(0);
  const [error,setError]=useState('');
  useEffect(()=>{
    const node=plot.current;
    if(!node)return;
    const limit=Math.max(1,Math.ceil(result.time.length/6000));
    const samples=Array.from(result.time.keys()).filter(i=>i%limit===0||i===result.time.length-1);
    const x=samples.map(i=>result.time[i]);
    const colors=['#50d7e6','#e5a56c','#adbcff','#94e6a8'];
    const traces:object[]=[];
    let xLabel='Time (s)',yLabel='';
    function trace(name:string,read:(i:number)=>number){
      traces.push({x,y:samples.map(read),name,type:'scatter',mode:'lines',line:{color:colors[traces.length],width:2}});
    }
    if(chart==='Displacement'){
      yLabel='Relative displacement (mm)';trace('Displacement',i=>result.traces.displacement[i*n+floor]*1000);
    }else if(chart==='Acceleration'){
      yLabel='Floor acceleration (m/s²)';
      trace('Absolute',i=>result.traces.absoluteAcceleration[i*n+floor]);trace('Relative',i=>result.traces.relativeAcceleration[i*n+floor]);
    }else if(chart==='Storey drift'){
      yLabel='Drift ratio (%)';trace('Storey drift',i=>result.traces.drift[i*n+floor]*100);
    }else if(chart==='Energy balance'){
      yLabel='Energy (J)';
      (['kinetic','strain','dissipation','work'] as const).forEach(key=>trace(key,i=>result.energy[key][i]));
    }else if(chart==='Energy residual'){
      yLabel='Balance residual (J)';trace('Residual',i=>result.energy.residual[i]);
    }else if(chart==='Input motion'){
      yLabel='Ground acceleration (g)';trace('Input',i=>result.ground[i]/G);
    }else if(chart==='Mass distribution'){
      xLabel='Storey';yLabel='Mass (kg)';traces.push({x:Array.from({length:n},(_,i)=>i+1),y:Array.from(result.structure.mass),type:'bar',marker:{color:colors[0]}});
    }else{
      xLabel='Mass-normalized displacement (kg⁻½)';yLabel='Storey';
      traces.push({x:[0,...result.structure.modes[mode].shape],y:Array.from({length:n+1},(_,i)=>i),type:'scatter',mode:'lines+markers',line:{color:colors[0]}});
    }
    void Plotly.react(node,traces,{
      margin:{l:76,r:25,t:21,b:69},autosize:true,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#d1e1e6'},
      xaxis:{title:{text:xLabel},gridcolor:'#283a43',zerolinecolor:'#45606d'},yaxis:{title:{text:yLabel},gridcolor:'#283a43',zerolinecolor:'#45606d'},
      showlegend:traces.length>1,legend:{orientation:'h',y:1.15},hovermode:'x unified',
    },{responsive:true,displaylogo:false}).catch(()=>setError('Could not draw this chart.'));
  },[chart,floor,mode,n,result]);
  useEffect(()=>{
    const node=plot.current;
    if(!node)return;
    const observer=new ResizeObserver(()=>{
      if(node.clientWidth&&node.querySelector('.main-svg'))void Plotly.Plots.resize(node).catch(()=>{});
    });
    observer.observe(node);
    return ()=>{observer.disconnect();Plotly.purge(node);};
  },[]);
  return <section className="panel engine-chart">
    <div className="engine-section-head"><h2>Response plots</h2>
      <label>Chart<select value={chart} onChange={e=>setChart(e.target.value as typeof chart)}>{charts.map(name=><option key={name}>{name}</option>)}</select></label>
      {['Displacement','Acceleration','Storey drift'].includes(chart)&&<label>Plot storey<select value={floor} onChange={e=>setFloor(+e.target.value)}>{Array.from({length:n},(_,i)=><option value={i} key={i}>{i+1}</option>)}</select></label>}
      {chart==='Mode shape'&&<label>Plot mode<select value={mode} onChange={e=>setMode(+e.target.value)}>{Array.from({length:n},(_,i)=><option value={i} key={i}>{i+1}</option>)}</select></label>}
    </div>{error&&<p role="alert">{error}</p>}<div className="engine-plot" ref={plot}/>
  </section>;
}
