import {expect,it} from 'vitest';
import {G,runSimulation} from '../../src/engine';
import {presetVariant} from '../../src/protection/model';
import {analysisDefaults,analyze,axisValues,refine,scan,sensitivity} from '../../src/research/compute';
import {elasticSpectrum,fourier,intensity,spectrogram} from '../../src/research/signal';
import {manifest,researchRows} from '../../src/research/export';
import {reportPdf} from '../../src/research/pdf';

const motion={dt:.01,label:'Test motion',acceleration:Float64Array.from({length:501},(_,i)=>Math.sin(2*Math.PI*i/100))};
it('computes Arias and exact significant fractions for constant acceleration',()=>{
  const r=intensity(new Float64Array(101).fill(2),.01);
  expect(r.arias).toBeCloseTo(Math.PI*2/G,12);
  expect(r.rms).toBeCloseTo(2,12);
  expect(r.d595).toBeCloseTo(.9,12);expect(r.d575).toBeCloseTo(.7,12);
  expect(r.bracket).toBe(1);
});
it('marks zero-motion durations as unavailable and rejects invalid inputs',()=>{
  const r=intensity(new Float64Array(3),.02);
  expect(r.d595).toBeNull();expect(r.bracket).toBeNull();
  expect(()=>intensity(new Float64Array([0,NaN]),.02)).toThrow();
});
it('recovers a bin-aligned sinusoid and conserves power with rectangular window',()=>{
  const samples=Float64Array.from({length:1024},(_,i)=>3*Math.sin(2*Math.PI*32*i/1024));
  const r=fourier(samples,1/128,'Rectangular',false);
  expect(r.dominant).toBe(4);expect(r.amplitude[32]).toBeCloseTo(3,11);
  expect(r.psd.reduce((a,b)=>a+b,0)*r.bin).toBeCloseTo(4.5,11);
  expect(fourier(samples,1/128,'Hann',true,4).resolution).toBe(r.resolution);
});
it('STFT shows distinct active bands before and after a frequency switch',()=>{
  const data=Float64Array.from({length:1024},(_,i)=>Math.sin(2*Math.PI*(i<512?4:12)*i/128));
  const r=spectrogram(data,1/128,256,.5);
  const peak=(p:Float64Array)=>r.frequency[p.indexOf(Math.max(...p))];
  expect(peak(r.frames[0])).toBe(4);expect(peak(r.frames.at(-1)!)).toBe(12);
});
it('matches independent SDOF Newmark response and pseudo relationships',()=>{
  const period=1,k=(2*Math.PI)**2,ratio=.05;
  const reference=runSimulation({storeys:[{heightM:3,massKg:1,stiffnessNPerM:k}],damping:{kind:'viscous',ratio}},motion);
  const s=elasticSpectrum(motion,[period],[ratio])[0].points[0];
  expect(s.Sd).toBeCloseTo(reference.peak.roofDisplacement,12);
  expect(s['Relative velocity']).toBeCloseTo(reference.peak.velocity,12);
  expect(s['Absolute acceleration']).toBeCloseTo(reference.peak.floorAcceleration,12);
  expect(s.PSA).toBeCloseTo(s.Sd*k,12);expect(s.PSV).toBeCloseTo(s.Sd*Math.sqrt(k),12);
});
it('elastic spectra scale linearly with the exact input amplitude',()=>{
  const a=elasticSpectrum(motion,[.2,1],[.02,.2]);
  const b=elasticSpectrum({...motion,acceleration:motion.acceleration.map(v=>3*v)},[.2,1],[.02,.2]);
  a.forEach((row,i)=>row.points.forEach((p,j)=>expect(b[i].points[j].PSA).toBeCloseTo(3*p.PSA,10)));
});
it('captures every original integration row and preserves source metadata',()=>{
  const vars=[presetVariant('Isolated institutional')];
  const input={...motion,provenance:'station checksum'};
  const study=analyze(input,vars,analysisDefaults);
  const rows=Array.from(researchRows(study));
  const n=study.cases[0].run.structure.mass.length;
  expect(rows.length).toBe(1+motion.acceleration.length*(n+1));
  const record=rows[1+40*(n+1)].trim().split(',');
  expect(+record[3]).toBe(.4);expect(+record[4]).toBe(motion.acceleration[40]);
  expect(+record[5]).toBe(study.cases[0].run.traces.displacement[40*n]);
  expect(manifest(input,vars,study,1).provenance).toBe('station checksum');
  expect(Array.from(researchRows(study,10)).length).toBe(1+51*(n+1));
});
it('preserves the summed modal effective mass and energy channels',()=>{
  const vars=[presetVariant('Isolated institutional')];
  vars[0].devices.tmd=true;vars[0].devices.viscous=true;
  const [{run,split}]=analyze(motion,vars,analysisDefaults).cases;
  expect(run.structure.modes.reduce((s,m)=>s+m.effectiveMassRatio,0)).toBeCloseTo(1,12);
  expect(Object.values(split).reduce((s,a)=>s+a.at(-1)!,0)).toBeCloseTo(run.energy.dissipation.at(-1)!,9);
});
it('runs bounded one- and two-variable sweeps and returns sensitivity changes',()=>{
  const x={parameter:'Storey stiffness multiplier',min:.5,max:2,count:3,log:true} as const;
  const y={parameter:'Floor mass multiplier',min:.8,max:1.2,count:3,log:false} as const;
  expect(axisValues(x)).toEqual([.5,1,2]);
  const v=presetVariant('Ordinary reinforced concrete');
  const grid=scan(v,motion,x,y,'roofDisplacement');
  expect(grid.observed).toHaveLength(3);expect(grid.max).toBeGreaterThan(grid.min);
  expect(sensitivity(v,motion,'superstructureDrift')).toHaveLength(3);
  expect(()=>scan(v,motion,x,x,'roofDisplacement')).toThrow();
});
it('quantifies time-history convergence on the common original sample grid',()=>{
  const r=refine(presetVariant('Ordinary reinforced concrete'),motion);
  expect(r[0].maxHistoryDifference).toBeGreaterThan(r[1].maxHistoryDifference);
  expect(r[2].maxHistoryDifference).toBe(0);
  expect(r[2].peakDifference).toBe(0);
});
it('writes an application-derived three-page PDF with correct cross-reference offset',()=>{
  const vars=[presetVariant('Ordinary reinforced concrete')];
  const text=new TextDecoder().decode(reportPdf('Verified results',motion,analyze(motion,vars,analysisDefaults),vars));
  expect(text).toContain('/Count 3');expect(text).toContain('Arias intensity');expect(text).toContain('Verified results');
  const offset=Number(/startxref\n(\d+)/.exec(text)?.[1]);
  expect(text.slice(offset,offset+4)).toBe('xref');
});
it('matches the closed-form SDOF unit-step spectrum independently',()=>{
  const result=elasticSpectrum({dt:.001,label:'Unit step',acceleration:new Float64Array(1001).fill(1)},[1],[0])[0].points[0];
  expect(result.Sd).toBeCloseTo(2/(2*Math.PI)**2,6);
  expect(result['Relative velocity']).toBeCloseTo(1/(2*Math.PI),5);
  expect(result['Absolute acceleration']).toBeCloseTo(2,5);
});
