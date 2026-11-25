import type {RecordingMeta} from './catalog';
export const components=['NS','EW','UD'] as const;
export type Component=typeof components[number];
export type Trace={dt:number;components:Record<Component,Float64Array>;pga:Record<Component,number>;duration:number};
export function parseArrayRecord(text:string,meta:RecordingMeta):Trace{
  const rows=text.trimEnd().split(/\r?\n/);
  const takai=meta.format==='Takai2016';
  const headerSize=takai?rows.findIndex(row=>row.includes('Acceleration(cm/s/s): North East Up'))+1:10;
  const header=rows.slice(0,headerSize);
  const valid=takai
    ? headerSize>0&&header.some(row=>row.startsWith('# Station CODE')&&row.trim().split(/\s+/).at(-1)===meta.station)
    : header[1]?.split('\t').at(-1)===meta.station&&header[9]?.includes('cm/s/s, NS/EW/UD');
  if(!valid||rows.length-headerSize!==meta.samples)throw Error('Recording header or sample count does not match its manifest.');
  const dt=1/meta.hz;
  const result={NS:new Float64Array(meta.samples),EW:new Float64Array(meta.samples),UD:new Float64Array(meta.samples)};
  const pga={NS:0,EW:0,UD:0};
  for(let i=0;i<meta.samples;i++){
    const fields=rows[headerSize+i].trim().split(/\s+/);
    const values=fields.map(Number);
    if(values.length!==4||values.some(a=>!Number.isFinite(a))||Math.abs(values[0]-i*dt)>1e-6)throw Error('Invalid data row '+(i+1)+'.');
    components.forEach((channel,j)=>{
      const value=values[j+1]*.01;
      result[channel][i]=value;
      pga[channel]=Math.max(pga[channel],Math.abs(value));
    });
  }
  return {dt,components:result,pga,duration:(meta.samples-1)*dt};
}
export const horizontal=(direction:Component):direction is 'NS'|'EW'=>direction!=='UD';
export function sampleAt(trace:Float64Array,dt:number,time:number){
  const i=Math.max(0,Math.min(trace.length-1,time/dt)),j=Math.floor(i);
  return trace[j]+(i-j)*((trace[j+1]??trace[j])-trace[j]);
}
/** Hann-windowed amplitude spectrum, zero-padded radix-2 FFT. */
export function spectrum(samples:Float64Array,dt:number){
  const n=2**Math.ceil(Math.log2(samples.length));
  const real=new Float64Array(n),imag=new Float64Array(n);
  const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
  let sumWindow=0;
  for(let i=0,j=0;i<n;i++){
    if(i<samples.length){const w=.5-.5*Math.cos(2*Math.PI*i/(samples.length-1));sumWindow+=w;real[j]=(samples[i]-mean)*w;}
    let bit=n>>1;
    while(bit&&(j&bit)){j^=bit;bit>>=1;}
    j^=bit;
  }
  for(let size=2;size<=n;size*=2)for(let start=0;start<n;start+=size)for(let i=0;i<size/2;i++){
    const a=start+i,b=a+size/2,angle=-2*Math.PI*i/size;
    const x=real[b]*Math.cos(angle)-imag[b]*Math.sin(angle),y=real[b]*Math.sin(angle)+imag[b]*Math.cos(angle);
    real[b]=real[a]-x;imag[b]=imag[a]-y;real[a]+=x;imag[a]+=y;
  }
  return {frequency:Array.from({length:n/2+1},(_,i)=>i/n/dt),
    amplitude:Array.from({length:n/2+1},(_,i)=>Math.hypot(real[i],imag[i])*(i===0||i===n/2?1:2)/sumWindow)};
}
