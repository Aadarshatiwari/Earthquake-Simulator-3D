import type {GroundMotion} from '../engine';
import type {Variant} from '../protection/model';
import type {Study} from './compute';

export function* researchRows(study:Study,stride=1){
  if(!Number.isInteger(stride)||stride<1)throw Error('Invalid sample stride.');
  yield 'case,dof,kind,time_s,ground_m_s2,relative_displacement_m,base_relative_displacement_m,relative_velocity_m_s,absolute_acceleration_m_s2,interstorey_displacement_m,drift_ratio,elastic_link_force_N,base_reaction_N,device_travel_m,device_axial_force_N\n';
  for(const [c,{run,devices}] of study.cases.entries()){
    const {mass,isolated,structuralCount}=run.structure,n=mass.length;
    for(let i=0;i<run.time.length;i++){
      if(i%stride!==0&&i!==run.time.length-1)continue;
      for(let j=0;j<n;j++){
        const k=i*n+j,kind=j>=structuralCount?'tuned_mass':isolated&&j===0?'base':'floor';
        const relativeBase=run.traces.displacement[k]-(isolated?run.traces.displacement[i*n]:0);
        yield [c+1,j+1,kind,run.time[i],run.ground[i],run.traces.displacement[k],relativeBase,
          run.traces.velocity[k],run.traces.absoluteAcceleration[k],run.traces.interstoreyDisplacement[k],run.traces.drift[k],run.traces.restoringForce[k],run.baseShear[i],'',''].join(',')+'\n';
      }
      for(const device of devices)yield [c+1,'',device.kind,run.time[i],run.ground[i],'','','','','','','',run.baseShear[i],device.travel[i],device.force[i]].join(',')+'\n';
    }
  }
}

export function manifest(input:GroundMotion,cases:Variant[],study:Study,stride:number){
  return {schema:'seismonepal-research',version:1,units:'SI',source:input.label,provenance:input.provenance,dtSeconds:input.dt,
    outputStride:stride,originalSamples:input.acceleration.length,configurations:cases,columns:researchRows(study,stride).next().value?.trim(),note:'DOFs count from 1 in solver order. Base reaction follows the engine inertial sign convention. Device force is the per-device axial dashpot force.'};
}
export function saveBlob(name:string,blob:Blob){
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
