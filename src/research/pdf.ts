import type {GroundMotion} from '../engine';
import type {Study} from './compute';
import type {Variant} from '../protection/model';

const clean=(v:string)=>v.normalize('NFKD').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,' ').replace(/[\\()]/g,'\\$&');
export function reportPdf(title:string,input:GroundMotion,study:Study,variants:Variant[],notes='',date=new Date()){
  const pages:string[]=[];
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
  function graph(xValues:ArrayLike<number>,yValues:ArrayLike<number>,caption:string){
    line(caption,12);const x=48,top=y,w=507,h=145,bottom=top-h;
    let lo=Infinity,hi=-Infinity;
    for(let i=0;i<yValues.length;i++){lo=Math.min(lo,yValues[i]);hi=Math.max(hi,yValues[i]);}
    page+='0.73 0.81 0.85 RG '+x+' '+bottom+' '+w+' '+h+' re S\n0.05 0.46 0.60 RG 1.2 w\n';
    for(let i=0;i<xValues.length;i+=Math.max(1,Math.floor(xValues.length/420))){
      const px=x+w*(xValues[i]-xValues[0])/(xValues[xValues.length-1]-xValues[0]||1);
      const py=bottom+h*(yValues[i]-lo)/(hi-lo||1);
      page+=px.toFixed(2)+' '+py.toFixed(2)+(i?' l\n':' m\n');
    }
    page+='S\n';y=bottom-15;line('x: '+xValues[0].toPrecision(3)+' to '+xValues[xValues.length-1].toPrecision(3)+'    y: '+lo.toPrecision(4)+' to '+hi.toPrecision(4));
  }
  start('Input and response spectra');
  line(title||'Historical engineering experiment',18);para('Created '+date.toISOString()+' UTC | Application 1.0.0 | Research schema 1');
  para(input.label);para(input.provenance??'Synthetic input from the local motion engine.');
  const m=study.intensity;
  para('Samples '+input.acceleration.length+' | dt '+input.dt+' s | PGA '+m.pga.toFixed(4)+' m/s^2 | RMS '+m.rms.toFixed(4)+' m/s^2');
  para('Arias intensity '+m.arias.toPrecision(4)+' m/s | D5-95 '+(m.d595?.toFixed(2)??'unavailable')+' s | D5-75 '+(m.d575?.toFixed(2)??'unavailable')+' s');
  graph(study.cases[0].run.time,input.acceleration,'Ground acceleration (m/s^2) versus time (s)');
  const series=study.spectra.find(s=>s.ratio===.05)??study.spectra[0];
  if(series)graph(series.points.map(p=>p.period),series.points.map(p=>p.PSA),'Pseudo-acceleration (m/s^2) versus period (s), '+(series.ratio*100)+'% damping');
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
  start('Time histories and model parameters');
  const first=study.cases[0].run,n=first.structure.mass.length;
  graph(first.time,Float64Array.from(first.time,(_,i)=>first.traces.displacement[i*n+first.structure.structuralCount-1]),'Case A roof displacement (m) versus time (s)');
  graph(first.time,first.energy.dissipation,'Case A cumulative dissipation (J) versus time (s)');
  para('Case A floor mass (kg): '+variants[0].building.levels.map(l=>l.massKg).join(', '));
  para('Case A storey stiffness (N/m): '+variants[0].building.levels.map(l=>l.stiffnessNPerM).join(', '));
  pages.push(page);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const ids:number[]=[];
  for(const [i,content] of pages.entries()){
    const index=objects.length+1;ids.push(index);
    const stream=content+'BT /F1 9 Tf 1 0 0 1 46 28 Tm (SeismoNepal 3D | '+(i+1)+' / '+pages.length+') Tj ET\n';
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(index+1)+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  }
  objects[1]='<< /Type /Pages /Count '+ids.length+' /Kids ['+ids.map(i=>i+' 0 R').join(' ')+'] >>';
  let pdf='%PDF-1.4\n';const index=[0];
  objects.forEach((object,i)=>{index.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';});
  const xref=pdf.length;
  pdf+='xref\n0 '+index.length+'\n0000000000 65535 f \n'+index.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+index.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new TextEncoder().encode(pdf);
}
