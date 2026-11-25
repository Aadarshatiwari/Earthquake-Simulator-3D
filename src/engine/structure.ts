import {addLink,chain,cholesky,finite} from './matrix';
import {modal} from './modal';
import type {Damping,Mode,Model} from './types';

export function dampingCoefficients(damping:Damping,modes:Mode[]){
  const frequency=(mode:number)=>{
    if(!Number.isInteger(mode)||!modes[mode])throw new RangeError('Damping mode index is outside the model.');
    return modes[mode].omega;
  };
  const ratio=(v:number)=>finite(v,'Damping ratio',0,1);
  switch(damping.kind){
    case 'none':return {alpha:0,beta:0};
    case 'viscous':
      if(modes.length!==1)throw new Error('Use viscous ratio damping with one DOF or assign individual storey dashpots.');
      return {alpha:2*ratio(damping.ratio)*modes[0].omega,beta:0};
    case 'mass':return {alpha:2*ratio(damping.ratio)*frequency(damping.mode),beta:0};
    case 'stiffness':return {alpha:0,beta:2*ratio(damping.ratio)/frequency(damping.mode)};
    case 'rayleigh':{
      const a=frequency(damping.first.mode),b=frequency(damping.second.mode);
      if(a===b)throw new Error('Rayleigh fitting requires two distinct modal frequencies.');
      const za=ratio(damping.first.ratio),zb=ratio(damping.second.ratio);
      const beta=2*(zb*b-za*a)/((b-a)*(b+a));
      const alpha=2*za*a-beta*a*a;
      if(alpha< -1e-12||beta< -1e-12)throw new Error('The requested modal ratios require negative Rayleigh coefficients.');
      return {alpha:Math.max(0,alpha),beta:Math.max(0,beta)};
    }
  }
}
export function assembleModel(model:Model){
  if(!Number.isInteger(model.storeys.length)||model.storeys.length<1||model.storeys.length>20)throw new RangeError('Use 1–20 storeys.');
  const storeys=model.foundation?.kind==='isolation'?[model.foundation.bearing,...model.storeys]:[...model.storeys];
  const structuralCount=storeys.length;
  const isolated=model.foundation?.kind==='isolation';
  const attachment=model.attachment;
  if(attachment&&(!Number.isInteger(attachment.floor)||attachment.floor<0||attachment.floor>=model.storeys.length))throw new RangeError('Damper attachment must be on a structural floor.');
  if(attachment)storeys.push({...attachment,heightM:1});
  const n=storeys.length;
  const parent=Int32Array.from(storeys,(_,i)=>i===structuralCount&&attachment?attachment.floor+Number(isolated):i-1);
  const linked=(values:Float64Array)=>{
    if(!attachment)return chain(values);
    const result=new Float64Array(n*n);
    values.forEach((value,i)=>addLink(result,n,i,parent[i],value));
    return result;
  };
  const mass=Float64Array.from(storeys,(s,i)=>finite(s.massKg,'Mass DOF '+(i+1),.001,1e12));
  const height=Float64Array.from(storeys,(s,i)=>finite(s.heightM,'Height DOF '+(i+1),.001,1e4));
  const springs=Float64Array.from(storeys,(s,i)=>finite(s.stiffnessNPerM,'Stiffness DOF '+(i+1),.001,1e15));
  const dashpots=Float64Array.from(storeys,s=>finite(s.damperNsPerM??0,'Storey damping',0,1e14));
  const initialDisplacement=Float64Array.from(storeys,s=>finite(s.initialDisplacementM??0,'Initial displacement'));
  const initialVelocity=Float64Array.from(storeys,s=>finite(s.initialVelocityMPerS??0,'Initial velocity'));
  for(const storey of storeys)for(const member of [...(storey.beams??[]),...(storey.columns??[])]){
    finite(member.elasticModulusPa,'Elastic modulus',1,1e13);
    finite(member.secondMomentM4,'Second moment of area',1e-18,1e8);
    if(member.areaM2!==undefined)finite(member.areaM2,'Area',1e-12,1e6);
  }
  if(model.influence&&model.influence.length!==n)throw new Error('Ground influence vector length must match active DOFs.');
  const influence=Float64Array.from(model.influence??Array(n).fill(1),v=>finite(v,'Ground influence',-100,100));
  if(!influence.some(x=>x!==0))throw new Error('Ground influence vector must have a nonzero entry.');
  const M=new Float64Array(n*n);mass.forEach((m,i)=>M[i*n+i]=m);
  const K=linked(springs);
  cholesky(K,n);
  const modes=modal(K,mass,influence);
  const {alpha,beta}=dampingCoefficients(model.damping,modes);
  const localC=linked(dashpots);
  const C=K.map((k,i)=>alpha*M[i]+beta*k+localC[i]);
  return {M,K,C,mass,height,springs,parent,structuralCount,isolated,influence,modes,alpha,beta,initialDisplacement,initialVelocity,totalMassKg:mass.reduce((sum,m)=>sum+m,0)};
}
