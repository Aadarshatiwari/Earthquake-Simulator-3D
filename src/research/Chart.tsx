import {useEffect,useRef,useState} from 'react';
import Plotly from 'plotly.js-basic-dist-min';
import {extremaIndices} from '../charts/sample';
import {palette} from '../protection/Plot';
export type Series={name:string;x:ArrayLike<number>;y:ArrayLike<number>;markers?:boolean};
export default function Chart({series,x,y,log=false,cursor,markers=[]}:{series:Series[];x:string;y:string;log?:boolean;cursor?:number;markers?:number[]}){
  const plot=useRef<HTMLDivElement>(null),box=useRef<HTMLElement>(null);
  useEffect(()=>{
    const node=plot.current;if(!node)return;
    const shapes=[...markers,...(cursor===undefined?[]:[cursor])].map(value=>({type:'line' as const,x0:value,x1:value,y0:0,y1:1,yref:'paper' as const,line:{color:'#ffc583',width:1,dash:'dot' as const}}));
    void Plotly.react(node,series.map((v,i)=>{
      const keys=extremaIndices(v.y.length,j=>v.y[j],1600);
      return {type:'scatter',mode:v.markers?'markers':'lines',name:v.name,x:keys.map(j=>v.x[j]),y:keys.map(j=>v.y[j]),line:{color:palette[i%palette.length],width:2}};
    }),{paper_bgcolor:'#102532',plot_bgcolor:'#102532',font:{color:'#d9ebf6'},margin:{l:67,r:19,t:15,b:58},
      xaxis:{title:{text:x},type:log?'log':'linear',gridcolor:'#2b4659',showspikes:true},
      yaxis:{title:{text:y},gridcolor:'#2b4659',showspikes:true},hovermode:'closest',shapes,legend:{orientation:'h',y:-.28}},
    {responsive:true,displaylogo:false,scrollZoom:false}).catch(()=>{});
  },[series,x,y,log,cursor,markers]);
  useEffect(()=>{const node=plot.current;if(!node)return;return ()=>{Plotly.purge(node);};},[]);
  return <figure ref={box} className="research-chart">
    <div className="research-plot" ref={plot} role="img" aria-label={y+' by '+x}/>
    <figcaption>{y} <button onClick={()=>{const node=box.current;if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else void node?.requestFullscreen?.().catch(()=>{});}}>Fullscreen chart</button></figcaption>
  </figure>;
}
export function Heat({rows,x,y,label,positive=false}:{rows:ArrayLike<number>[];x:ArrayLike<number>;y:ArrayLike<number>;label:string;positive?:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const [hover,setHover]=useState('');
  let max=0,min=Infinity;
  for(const row of rows)for(const v of Array.from(row)){max=Math.max(max,Math.abs(v));min=Math.min(min,v);}
  useEffect(()=>{
    const n=canvas.current;if(!n||!x.length||!rows.length)return;
    const ctx=n.getContext('2d');if(!ctx)return;
    const raster=ctx.createImageData(x.length,rows.length);
    rows.forEach((row,i)=>Array.from(row).forEach((value,j)=>{
      const t=positive?(value-min)/Math.max(1e-20,max-min):.5+.5*Math.sign(value)*Math.sqrt(Math.abs(value)/Math.max(1e-20,max));
      const k=((rows.length-1-i)*x.length+j)*4;
      const low=[40,131,193],mid=[22,38,57],high=[251,155,77];
      const a=positive||t>.5?mid:low,b=positive||t>.5?high:mid;
      const factor=positive?t:t>.5?2*t-1:2*t;
      raster.data.set([...a.map((v,j)=>Math.round(v+(b[j]-v)*factor)),255],k);
    }));
    ctx.putImageData(raster,0,0);
  },[rows,x,max,min,positive]);
  if(positive)max=Math.max(...rows.map(row=>Array.from(row).reduce((m,v)=>Math.max(m,v),-Infinity)));
  const [x0,x1]=[x[0],x[x.length-1]],y0=y[0],y1=y[y.length-1];
  return <figure className="research-chart"><canvas ref={canvas} width={x.length} height={rows.length} role="img" aria-label={label} onPointerLeave={()=>setHover('')} onPointerMove={e=>{
    const bounds=e.currentTarget.getBoundingClientRect();
    const j=Math.min(x.length-1,Math.max(0,Math.floor(x.length*(e.clientX-bounds.left)/bounds.width)));
    const i=Math.min(rows.length-1,Math.max(0,rows.length-1-Math.floor(rows.length*(e.clientY-bounds.top)/bounds.height)));
    setHover('x '+x[j].toPrecision(4)+' · y '+y[i].toPrecision(4)+' · value '+rows[i][j].toExponential(3));
  }}/>
    <figcaption>{label} · x {x0?.toPrecision(3)}–{x1?.toPrecision(3)} · y {y0?.toPrecision(3)}–{y1?.toPrecision(3)} · scale {(positive?min:-max).toExponential(2)} to {max.toExponential(2)}{!positive?' · signed square-root colour scale':''}{hover&&' · '+hover}</figcaption></figure>;
}
