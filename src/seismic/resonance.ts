import {assembleModel,type Model} from '../engine';
import {cholesky} from '../engine/matrix';

/** Complex harmonic solution to (K − w²M + i w C) u = −Mr for unit input acceleration. */
export function resonanceCurve(model:Model,min:number,max:number,points=150){
  const {K,M,C,mass,influence,modes}=assembleModel(model),n=mass.length;
  const load=mass.map((value,i)=>-value*influence[i]);
  const stat=new Float64Array(n);cholesky(K,n)(load,stat);
  const denominator=Math.max(Math.abs(stat[n-1]),1e-14);
  return Array.from({length:points},(_,i)=>{
    const hz=min+(max-min)*i/(points-1),omega=2*Math.PI*hz;
    const real=K.map((value,j)=>value-omega*omega*M[j]),imag=C.map(value=>omega*value);
    const re=load.slice(),im=new Float64Array(n);
    for(let p=0;p<n;p++){
      let pivot=p;
      for(let j=p+1;j<n;j++)if(Math.hypot(real[j*n+p],imag[j*n+p])>Math.hypot(real[pivot*n+p],imag[pivot*n+p]))pivot=j;
      if(pivot!==p){
        for(let k=p;k<n;k++){
          [real[p*n+k],real[pivot*n+k]]=[real[pivot*n+k],real[p*n+k]];
          [imag[p*n+k],imag[pivot*n+k]]=[imag[pivot*n+k],imag[p*n+k]];
        }
        [re[p],re[pivot]]=[re[pivot],re[p]];[im[p],im[pivot]]=[im[pivot],im[p]];
      }
      const a=real[p*n+p],b=imag[p*n+p],d=a*a+b*b;
      if(d<=1e-24)return {hz,amplification:null,firstHz:modes[0].hz};
      for(let j=p+1;j<n;j++){
        const x=real[j*n+p],y=imag[j*n+p],u=(x*a+y*b)/d,v=(y*a-x*b)/d;
        for(let k=p+1;k<n;k++){
          const qr=real[p*n+k],qi=imag[p*n+k];
          real[j*n+k]-=u*qr-v*qi;imag[j*n+k]-=u*qi+v*qr;
        }
        re[j]-=u*re[p]-v*im[p];im[j]-=u*im[p]+v*re[p];
      }
    }
    const diagonal=(n-1)*n+n-1;
    return {hz,amplification:Math.hypot(re[n-1],im[n-1])/Math.hypot(real[diagonal],imag[diagonal])/denominator,firstHz:modes[0].hz};
  });
}
