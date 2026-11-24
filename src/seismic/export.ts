import type {Output} from './jobs';
const traces=['displacement','velocity','relativeAcceleration','absoluteAcceleration','interstoreyDisplacement','drift','restoringForce'] as const;
const units=['m','m_s','m_s2','m_s2','m','ratio','N'];
export function responseCsv(output:Output){
  const header=['time_s','ground_acceleration_m_s2',...(output.hasGroundDisplacement?['ground_velocity_m_s','ground_displacement_m']:[])];
  for(let b=0;b<output.results.length;b++){
    const n=output.results[b].structure.mass.length,prefix=b?'B_':'A_';
    header.push(...['base_shear_N','kinetic_J','strain_J','dissipated_J','input_work_J','energy_residual_J'].map(s=>prefix+s));
    for(let f=0;f<n;f++)header.push(...traces.map((trace,i)=>prefix+(f<output.offsets[b]?'bearing':'storey_'+(f-output.offsets[b]+1))+'_'+trace+'_'+units[i]));
  }
  const first=output.results[0];
  const rows=[header.join(',')+'\n'];
  for(let j=0;j<first.time.length;j++){
    const row=[first.time[j],first.ground[j]];
    if(output.hasGroundDisplacement)row.push(output.groundVelocity![j],first.groundDisplacement[j]);
    for(const r of output.results){
      row.push(r.baseShear[j],r.energy.kinetic[j],r.energy.strain[j],r.energy.dissipation[j],r.energy.work[j],r.energy.residual[j]);
      const n=r.structure.mass.length;
      for(let i=0;i<n;i++)for(const trace of traces)row.push(r.traces[trace][j*n+i]);
    }
    rows.push(row.join(',')+'\n');
  }
  return rows;
}
