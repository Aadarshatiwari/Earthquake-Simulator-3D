import type {GroundMotion} from '../engine';
import type {Study} from './compute';
import type {Variant} from '../protection/model';

const clean=(v:string)=>v.normalize('NFKD').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,' ').replace(/[\\()]/g,'\\$&');
export type ReportOptions={format?:'Compact'|'Comprehensive';signals?:boolean;comparison?:boolean;parameters?:boolean};
const shades=['0.04 0.43 0.58','0.75 0.33 0.09','0.38 0.27 0.68','0.08 0.45 0.28','0.63 0.18 0.36'];
export function reportPdf(title:string,input:GroundMotion,study:Study,variants:Variant[],notes='',date=new Date(),options:ReportOptions={}){
  const comprehensive=options.format==='Comprehensive';
  const pages:string[]=[];
  const reduction=(a:number,b:number)=>Math.abs(a)<1e-10?'unavailable':(100*(a-b)/a).toFixed(1)+'%';
  let page='',y=0;
  function line(s:string,size=10,x=46){
    page+='BT /F1 '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+clean(s)+') Tj ET\n';y-=size+6;
  }
  function start(section:string){
    if(page)pages.push(page);
    page='0.06 0.15 0.22 rg 0 708 612 84 re f\n1 1 1 rg\n';y=754;
    line('SeismoNepal 3D | Research Laboratory',19);line(section,11);
    page+='0.07 0.16 0.23 rg\n';y=679;
  }
  function para(s:string){
    for(const row of s.match(/.{1,96}(?:\s|$)|.{1,96}/g)??[])line(row.trim());
    y-=4;
  }
  type Plot={x:ArrayLike<number>;values:ArrayLike<number>;name:string};
  function graph(sets:Plot[],caption:string,xUnit:string){
    line(caption,12);
    const x=82,top=y-4,w=474,h=117,bottom=top-h;
    let lo=Infinity,hi=-Infinity;
    const xMax=Math.max(...sets.map(s=>s.x[s.x.length-1])),xMin=Math.min(...sets.map(s=>s.x[0]));
    for(const {values} of sets)for(let i=0;i<values.length;i++){lo=Math.min(lo,values[i]);hi=Math.max(hi,values[i]);}
    if(hi===lo)hi=lo+1;
    for(let i=0;i<=4;i++){
      const py=bottom+h*i/4,px=x+w*i/4;
      page+='0.82 0.87 0.90 RG .5 w '+x+' '+py+' m '+(x+w)+' '+py+' l S '+px+' '+bottom+' m '+px+' '+top+' l S\n';
      y=py-3;line(Number((lo+(hi-lo)*i/4).toPrecision(3)).toString(),8,45);
      y=bottom-15;line(Number((xMin+(xMax-xMin)*i/4).toPrecision(3)).toString(),8,px-7);
    }
    for(const [j,set] of sets.entries()){
      page+=shades[j%shades.length]+' RG 1 w\n';
      for(let i=0;i<set.x.length;i+=Math.max(1,Math.floor(set.x.length/520))){
        const px=x+w*(set.x[i]-xMin)/(xMax-xMin||1);
        const py=bottom+h*(set.values[i]-lo)/(hi-lo);
        page+=px.toFixed(2)+' '+py.toFixed(2)+(i?' l\n':' m\n');
      }
      page+='S\n';
      const legend=x+j*(sets.length>4?94:115);y=bottom-40;
      page+=shades[j%shades.length]+' RG 2 w '+legend+' '+(y+3)+' m '+(legend+14)+' '+(y+3)+' l S\n';
      line(set.name.slice(0,22),8,legend+18);
    }
    y=bottom-27;line(xUnit,8,x+192);y=bottom-64;
  }
  start('Input and response spectra');
  line((title||'Historical engineering experiment').slice(0,53),18);para('Created '+date.toISOString()+' UTC | Application 1.0.0 | Research schema 1');
  para(input.label);para(input.provenance??'Synthetic input from the local motion engine.');
  const m=study.intensity;
  para('Samples '+input.acceleration.length+' | dt '+input.dt+' s | PGA '+m.pga.toFixed(4)+' m/s^2 | RMS '+m.rms.toFixed(4)+' m/s^2');
  para('Arias intensity '+m.arias.toPrecision(4)+' m/s | D5-95 '+(m.d595?.toFixed(2)??'unavailable')+' s | D5-75 '+(m.d575?.toFixed(2)??'unavailable')+' s');
  para('Objective: compare structural demands under one prescribed ground-motion input.');
  if(options.signals!==false){
    graph([{x:study.cases[0].run.time,values:input.acceleration,name:'Ground acceleration'}],'Ground acceleration (m/s^2)','Time (s)');
    const series=study.spectra.slice(0,5);
    if(series.length)graph(series.map(s=>({x:s.points.map(p=>p.period),values:s.points.map(p=>p.PSA),name:(s.ratio*100)+'% damping'})), 'Pseudo-spectral acceleration (m/s^2)','Oscillator period (s)');
  }
  start('Structural response and numerical verification');
  for(const [i,c] of study.cases.entries()){
    line(String.fromCharCode(65+i)+'  '+c.name,14);
    const r=c.run,v=variants[i];
    para(r.structure.mass.length+' DOFs | Roof '+r.peak.roofDisplacement.toPrecision(4)+' m | Peak floor drift '+(100*r.peak.superstructureDrift).toPrecision(4)+'% | Peak floor acceleration '+r.peak.floorAcceleration.toPrecision(4)+' m/s^2');
    para('First modes (s): '+r.structure.modes.slice(0,3).map(z=>z.period.toFixed(4)).join(', ')+' | Base reaction '+(r.peak.baseShear/1000).toPrecision(4)+' kN | Dissipation '+r.energy.dissipation.at(-1)?.toPrecision(4)+' J | Peak residual '+r.peak.energyResidual.toExponential(2)+' J');
    const active=Object.entries(v.devices).filter(([,a])=>a===true).map(([key])=>key);
    para('Case parameters: '+v.building.levels.length+' storeys, '+v.building.damping+'% local damping proxy; active devices: '+(active.join(', ')||'none')+'.');
  }
  para('Average-acceleration Newmark integration; beta = 0.25, gamma = 0.5. Linear one-axis educational model. Real building safety, nonlinear failure and code compliance are outside this model.');
  para('References: Takai et al. doi:10.1186/s40623-016-0383-7; USGS Open-File Report 2017-1008. '+notes.slice(0,240));
  if(options.comparison!==false){
    const compare=(selector:(r:Study['cases'][number]['run'],i:number)=>number,caption:string)=>
      graph(study.cases.map((c,j)=>({x:c.run.time,values:Float64Array.from(c.run.time,(_,i)=>selector(c.run,i)),name:'Case '+String.fromCharCode(65+j)})),caption,'Time (s)');
    function peakFloor(r:Study['cases'][number]['run'],i:number,channel:'drift'|'absoluteAcceleration'){
      const n=r.structure.mass.length;
      let max=0;
      for(let j=Number(r.structure.isolated);j<r.structure.structuralCount;j++)max=Math.max(max,Math.abs(r.traces[channel][i*n+j]));
      return max;
    }
    start('Synchronized comparative response');
    compare((r,i)=>r.traces.displacement[i*r.structure.mass.length+r.structure.structuralCount-1],'Roof displacement relative to ground (m)');
    if(comprehensive){
      compare((r,i)=>100*peakFloor(r,i,'drift'),'Maximum storey drift magnitude (%)');
      compare((r,i)=>peakFloor(r,i,'absoluteAcceleration'),'Maximum floor acceleration magnitude (m/s^2)');
      start('Foundation demand and energy');
      compare((r,i)=>r.baseShear[i]/1000,'Base reaction (kN)');
    }
    compare((r,i)=>r.energy.dissipation[i]/1000,'Cumulative damping energy (kJ)');
  }
  if(comprehensive&&options.parameters!==false){
    for(const [i,v] of variants.entries()){
      if(i%2===0)start('Model parameters | SI units');
      line('Case '+String.fromCharCode(65+i)+' | '+v.name.slice(0,67),14);
      const r=study.cases[i].run;
      para('Storeys shown bottom to top. Geometry inputs and assembled stiffness use SI units.');
      para('Heights (m): '+v.building.levels.map(l=>l.heightM).join(', '));
      para('Masses (kg): '+v.building.levels.map(l=>l.massKg).join(', '));
      para('Original stiffness (MN/m): '+v.building.levels.map(l=>l.stiffnessNPerM/1e6).join(', '));
      para('Assembled springs (MN/m), optional base and damper included: '+Array.from(r.structure.springs,k=>Number((k/1e6).toPrecision(5))).join(', '));
      if(v.devices.isolation)para('Isolation: base mass '+v.devices.baseMass+' kg, ground-connected damping '+r.structure.C.slice(0,r.structure.mass.length).reduce((sum,c)=>sum+c,0).toPrecision(5)+' N s/m.');
      if(v.devices.tmd)para('Tuned mass: '+v.devices.tmdMass+' kg at floor '+v.devices.tmdFloor+', '+v.devices.tmdHz+' Hz, damping ratio '+v.devices.tmdRatio);
      if(v.devices.viscous)para('Viscous: '+v.devices.viscousCount+' devices, '+v.devices.viscousC+' N s/m axial coefficient, storey '+v.devices.viscousStorey+', '+v.devices.viscousAngle+' degrees.');
      const baseline=study.cases[0].run.peak;
      if(i)para('Against case A, signed reductions: roof '+reduction(baseline.roofDisplacement,r.peak.roofDisplacement)+', drift '+reduction(baseline.superstructureDrift,r.peak.superstructureDrift)+', acceleration '+reduction(baseline.floorAcceleration,r.peak.floorAcceleration)+'. Negative values indicate increases.');
    }
  }
  pages.push(page);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const ids:number[]=[];
  for(const [i,content] of pages.entries()){
    const index=objects.length+1;ids.push(index);
    const stream='q .970588 0 0 1.063131 0 0 cm\n'+content+'BT /F1 9 Tf 1 0 0 1 46 28 Tm (SeismoNepal 3D | '+(i+1)+' / '+pages.length+') Tj ET\nQ\n';
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 594.999 841.999] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(index+1)+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  }
  objects[1]='<< /Type /Pages /Count '+ids.length+' /Kids ['+ids.map(i=>i+' 0 R').join(' ')+'] >>';
  let pdf='%PDF-1.4\n';const index=[0];
  objects.forEach((object,i)=>{index.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';});
  const xref=pdf.length;
  pdf+='xref\n0 '+index.length+'\n0000000000 65535 f \n'+index.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+index.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new TextEncoder().encode(pdf);
}
