import type {Mode} from './types';

export function modal(K:Float64Array,mass:Float64Array,influence:Float64Array):Mode[]{
  const n=mass.length,A=K.map((x,i)=>x/Math.sqrt(mass[Math.floor(i/n)]*mass[i%n]));
  const V=new Float64Array(n*n);
  const tolerance=Math.max(...A.map(Math.abs))*1e-14;
  const participatingMass=mass.reduce((s,m,i)=>s+m*influence[i]**2,0);
  for(let i=0;i<n;i++)V[i*n+i]=1;
  let converged=false;
  for(let sweep=0;sweep<70;sweep++){
    let peak=0;
    for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){
      const off=A[p*n+q];
      peak=Math.max(peak,Math.abs(off));
      if(Math.abs(off)<=tolerance)continue;
      const a=A[p*n+p],b=A[q*n+q],theta=.5*Math.atan2(2*off,b-a);
      const c=Math.cos(theta),s=Math.sin(theta);
      for(let i=0;i<n;i++){
        if(i!==p&&i!==q){
          const x=A[i*n+p],y=A[i*n+q];
          A[i*n+p]=A[p*n+i]=c*x-s*y;
          A[i*n+q]=A[q*n+i]=s*x+c*y;
        }
        const x=V[i*n+p],y=V[i*n+q];
        V[i*n+p]=c*x-s*y;
        V[i*n+q]=s*x+c*y;
      }
      A[p*n+p]=c*c*a-2*s*c*off+s*s*b;
      A[q*n+q]=s*s*a+2*s*c*off+c*c*b;
      A[p*n+q]=A[q*n+p]=0;
    }
    if(peak<=tolerance){converged=true;break;}
  }
  if(!converged)throw new Error('Modal eigensolver did not converge.');
  return Array.from({length:n},(_,i)=>{
    const omega=Math.sqrt(A[i*n+i]);
    if(!(omega>0)||!Number.isFinite(omega))throw new Error('Model has a nonpositive or unresolved modal frequency.');
    const shape=mass.map((m,j)=>V[j*n+i]/Math.sqrt(m)*(V[(n-1)*n+i]<0?-1:1));
    const participation=shape.reduce((sum,x,j)=>sum+x*mass[j]*influence[j],0);
    const effectiveMassKg=participation**2;
    return {omega,hz:omega/(2*Math.PI),period:2*Math.PI/omega,shape,participation,effectiveMassKg,effectiveMassRatio:effectiveMassKg/participatingMass};
  }).sort((a,b)=>a.omega-b.omega);
}
