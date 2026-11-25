import {G,type GroundMotion} from '../engine';
export type WindowName='Rectangular'|'Hann'|'Hamming';
function check(a:Float64Array,dt:number){
  if(a.length<2||a.length>65536||!Number.isFinite(dt)||dt<=0||a.some(v=>!Number.isFinite(v)))throw Error('Expected 2–65,536 finite samples at a positive interval.');
}
export function intensity(a:Float64Array,dt:number,threshold=.05*G){
  check(a,dt);
  if(!Number.isFinite(threshold)||threshold<=0)throw Error('Threshold must be positive.');
  const cumulative=new Float64Array(a.length);
  let pga=0,first=-1,last=-1;
  for(let i=0;i<a.length;i++){
    const abs=Math.abs(a[i]);pga=Math.max(pga,abs);
    if(abs>=threshold){if(first<0)first=i;last=i;}
    if(i)cumulative[i]=cumulative[i-1]+dt*Math.PI/(4*G)*(a[i]**2+a[i-1]**2);
  }
  const arias=cumulative.at(-1)!,duration=(a.length-1)*dt;
  function crossing(f:number){
    const target=f*arias,i=cumulative.findIndex(x=>x>=target);
    return i>0?dt*(i-1+(target-cumulative[i-1])/(cumulative[i]-cumulative[i-1])):0;
  }
  return {pga,arias,cumulative,duration,rms:Math.sqrt(arias*2*G/(Math.PI*duration)),
    d595:arias>0?crossing(.95)-crossing(.05):null,d575:arias>0?crossing(.75)-crossing(.05):null,
    bracket:first<0?null:(last-first)*dt,threshold};
}
export function fourier(a:Float64Array,dt:number,window:WindowName='Hann',demean=true,pad=1){
  check(a,dt);
  if(!['Rectangular','Hann','Hamming'].includes(window)||![1,2,4].includes(pad))throw Error('Invalid transform settings.');
  const n=2**Math.ceil(Math.log2(a.length))*pad;
  const re=new Float64Array(n),im=new Float64Array(n);
  const mean=demean?a.reduce((sum,v)=>sum+v,0)/a.length:0;
  let sumW=0,sumW2=0;
  for(let i=0,j=0;i<n;i++){
    if(i<a.length){
      const c=Math.cos(2*Math.PI*i/a.length);
      const w=window==='Hann'?.5-.5*c:window==='Hamming'?.54-.46*c:1;
      re[j]=(a[i]-mean)*w;sumW+=w;sumW2+=w*w;
    }
    let bit=n>>1;
    while(bit&&(j&bit)){j^=bit;bit>>=1;}
    j^=bit;
  }
  for(let size=2;size<=n;size*=2){
    for(let k=0;k<size/2;k++){
      const angle=-2*Math.PI*k/size,c=Math.cos(angle),s=Math.sin(angle);
      for(let j=k;j<n;j+=size){
        const q=j+size/2,r=re[q]*c-im[q]*s,z=re[q]*s+im[q]*c;
        re[q]=re[j]-r;im[q]=im[j]-z;re[j]+=r;im[j]+=z;
      }
    }
  }
  const frequency=new Float64Array(n/2+1),amplitude=new Float64Array(frequency.length),psd=new Float64Array(frequency.length);
  let peak=0;
  for(let i=0;i<frequency.length;i++){
    const square=re[i]**2+im[i]**2,oneside=i===0||i===n/2?1:2;
    frequency[i]=i/(n*dt);amplitude[i]=oneside*Math.sqrt(square)/sumW;psd[i]=oneside*square*dt/sumW2;
    if(i>0&&amplitude[i]>(amplitude[peak]&&peak>0?amplitude[peak]:0))peak=i;
  }
  return {frequency,amplitude,psd,dominant:peak?frequency[peak]:null,bin:1/(n*dt),resolution:1/(a.length*dt),nyquist:.5/dt};
}
export function spectrogram(a:Float64Array,dt:number,length=256,overlap=.5,window:WindowName='Hann'){
  check(a,dt);
  if(!Number.isInteger(length)||length<16||length>4096||overlap<0||overlap>=.95)throw Error('Invalid spectrogram window or overlap.');
  const size=Math.min(length,a.length),hop=Math.max(1,Math.floor(size*(1-overlap)),Math.ceil((a.length-size)/480));
  const frames:Array<Float64Array>=[],time:number[]=[];
  let frequency=new Float64Array(0);
  for(let i=0;i+size<=a.length;i+=hop){
    const out=fourier(a.subarray(i,i+size),dt,window);
    frames.push(out.psd);time.push((i+(size-1)/2)*dt);frequency=Float64Array.from(out.frequency);
  }
  return {frames,time,frequency,hop};
}
export const spectrumNames=['Sd','Relative velocity','Absolute acceleration','PSV','PSA'] as const;
export function elasticSpectrum(motion:GroundMotion,periods:number[],ratios:number[]){
  const {acceleration:a,dt}=motion;check(a,dt);
  if(periods.length>160||ratios.length>8||periods.some(p=>!Number.isFinite(p)||p<dt*2||p>30)||ratios.some(z=>!Number.isFinite(z)||z<0||z>=1))throw Error('Invalid periods or damping ratios.');
  return ratios.map(ratio=>({ratio,points:periods.map(period=>{
    const w=2*Math.PI/period,k=w*w,c=2*ratio*w,sub=Math.ceil(dt*24/period),h=dt/sub;
    const factor=1+h*c/2+h*h*k/4;
    let u=0,v=0,d=-a[0],sd=0,sv=0,sa=0;
    for(let i=1;i<a.length;i++)for(let j=1;j<=sub;j++){
      const ag=a[i-1]+(a[i]-a[i-1])*j/sub;
      const up=u+h*v+h*h*d/4,vp=v+h*d/2;
      d=(-ag-c*vp-k*up)/factor;u=up+h*h*d/4;v=vp+h*d/2;
      sd=Math.max(sd,Math.abs(u));sv=Math.max(sv,Math.abs(v));sa=Math.max(sa,Math.abs(d+ag));
    }
    return {period,Sd:sd,'Relative velocity':sv,'Absolute acceleration':sa,PSV:w*sd,PSA:k*sd};
  })}));
}
