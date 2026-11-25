import {useId} from 'react';
export const palette=['#7ce6f7','#ffc387','#bda7f4','#90dbad','#f4a5b4','#e3dd9f','#78aef8','#e4eff7'];
export type Curve={name:string;x:ArrayLike<number>;y:ArrayLike<number|null>};
export default function Plot({curves,xLabel,yLabel,marker}:{curves:Curve[];xLabel:string;yLabel:string;marker?:number}){
  const title=useId();
  const width=760,height=248,pad={x:79,y:13,base:198,right:19};
  let lowX=Infinity,highX=-Infinity,lowY=Infinity,highY=-Infinity;
  for(const curve of curves)for(let i=0;i<curve.x.length;i++){
    const x=curve.x[i],y=curve.y[i];
    if(y===null||!Number.isFinite(y)||!Number.isFinite(x))continue;
    lowX=Math.min(lowX,x);highX=Math.max(highX,x);lowY=Math.min(lowY,y);highY=Math.max(highY,y);
  }
  if(!Number.isFinite(lowX))return <p>Chart values are unavailable.</p>;
  if(highX===lowX)highX=lowX+1;
  if(highY===lowY){lowY-=1;highY+=1;}
  const format=(v:number)=>Math.abs(v)<1e-10?'0':Number(v.toPrecision(3)).toString();
  const xPlot=(value:number)=>pad.x+(width-pad.x-pad.right)*(value-lowX)/(highX-lowX);
  const yPlot=(value:number)=>pad.base-(pad.base-pad.y)*(value-lowY)/(highY-lowY);
  return <figure className="protection-plot">
    <svg viewBox={'0 0 '+width+' '+height} role="img" aria-labelledby={title}>
      <title id={title}>{yLabel} by {xLabel}</title>
      {Array.from({length:5},(_,i)=>{
        const y=lowY+(highY-lowY)*i/4,position=yPlot(y);
        return <g key={i}><line x1={pad.x} x2={width-pad.right} y1={position} y2={position} stroke="#365263"/>
          <text x={pad.x-7} y={position+4} textAnchor="end">{format(y)}</text></g>;
      })}
      {Array.from({length:6},(_,i)=>{
        const x=lowX+(highX-lowX)*i/5,position=xPlot(x);
        return <g key={i}><line x1={position} x2={position} y1={pad.y} y2={pad.base} stroke="#294755"/>
          <text x={position} y={pad.base+19} textAnchor="middle">{format(x)}</text></g>;
      })}
      {curves.map((curve,i)=>{
        let start=true,path='';
        for(let j=0;j<curve.x.length;j++){
          const x=curve.x[j],y=curve.y[j];
          if(y===null||!Number.isFinite(y)){start=true;continue;}
          path+=(start?'M':'L')+xPlot(x).toFixed(2)+' '+yPlot(y).toFixed(2)+' ';
          start=false;
        }
        return <path key={curve.name} d={path} stroke={palette[i%palette.length]} fill="none" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>;
      })}
      {marker!==undefined&&marker>=lowX&&marker<=highX&&<line x1={xPlot(marker)} x2={xPlot(marker)} y1={pad.y} y2={pad.base} stroke="#f7d091" strokeDasharray="4 4"/>}
      <text x={(pad.x+width-pad.right)/2} y={height-7} textAnchor="middle">{xLabel}</text>
      <text transform={'translate(16 '+(pad.y+pad.base)/2+') rotate(-90)'} textAnchor="middle">{yLabel}</text>
    </svg>
    <figcaption>{curves.map((curve,i)=><span key={curve.name} style={{color:palette[i%palette.length]}}>{curve.name}</span>)}</figcaption>
  </figure>;
}
