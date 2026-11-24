import {describe,expect,it} from 'vitest';
import {G,defaults,forms,makeMotion,pga,groundDisplacement,baselineCorrect} from '../../src/seismic/motion';
import {ready,transition,peakAt,scaleFor,storeyTransform,heatMagnitude,type Clock} from '../../src/seismic/controller';
import {presetConfig,type Project} from '../../src/constructor/model';
import {floorDisplacement} from '../../src/constructor/geometry';
import {solveJob,type Job} from '../../src/seismic/jobs';
import {resonanceCurve} from '../../src/seismic/resonance';
import {readScenario} from '../../src/seismic/projects';
import {responseCsv} from '../../src/seismic/export';
import {WorkerSlot} from '../../src/seismic/workerSlot';
import {SimulationCancelled} from '../../src/engine';
const a:Project={id:'phase-three-a',name:'Example A',version:1,config:presetConfig('Concrete residence')};
const b:Project={id:'phase-three-b',name:'Example B',version:1,config:presetConfig('Soft storey')};
const input={...defaults,duration:5};
const job:Job={buildings:[a,b],settings:input};
describe('Phase 3 seismic simulation',()=>{
  it('generates every synthetic form with finite labelled output',()=>{
    for(const form of forms.slice(0,-1)){
      const {motion}=makeMotion({...input,form});
      expect(motion.label).toMatch(/^Synthetic/);expect(motion.acceleration).toHaveLength(501);
      expect(motion.acceleration.every(Number.isFinite)).toBe(true);
    }
  });
  it('normalizes synthetic input to the requested measured PGA',()=>{
    const {motion}=makeMotion({...input,pgaG:.41});
    expect(pga(motion)/G).toBeCloseTo(.41,14);
  });
  it('converts g and preserves sourced SI CSV input without ground offset',()=>{
    expect(G).toBe(9.80665);
    const record={label:'Imported · sample',provenance:'User station',dt:.01,samples:[0,.4*G,0]};
    const {motion,hasGroundDisplacement}=makeMotion({...input,form:'Imported CSV'},record);
    expect(pga(motion)/G).toBeCloseTo(.4,14);expect(motion.provenance).toBe('User station');
    expect(hasGroundDisplacement).toBe(false);
  });
  it('supports ready, play, pause, restart, stop and terminal states',()=>{
    const play=transition(ready,{type:'play'},8);
    expect(play).toEqual({time:0,status:'playing'});
    expect(transition(play,{type:'tick',seconds:8,speed:1,loop:false},8)).toEqual({time:8,status:'ended'});
    expect(transition({status:'ended',time:8},{type:'play'},8)).toEqual(play);
    expect(transition({status:'paused',time:5},{type:'restart'},8)).toEqual(play);
    expect(transition(play,{type:'stop'},8)).toEqual({status:'stopped',time:0});
  });
  it('maps numerical DOF displacements without disconnecting adjacent levels',()=>{
    const result=solveJob(job).results[0],n=result.structure.mass.length,t=2.032,k=2;
    const previous=floorDisplacement(result.traces.displacement,result.time,n,k-1,t);
    const next=floorDisplacement(result.traces.displacement,result.time,n,k,t);
    const h=result.structure.height[k],g=storeyTransform(previous,next,h,1);
    const adjacent=storeyTransform(next,0,h,1);
    expect(g.shift+g.slope*h).toBeCloseTo(adjacent.shift,14);
  });
  it('uses a shared timeline for every building and displayed history',()=>{
    const output=solveJob(job),[a,b]=output.results;
    expect(a.time).toEqual(b.time);expect(a.ground).toEqual(b.ground);
    const sample=113,t=a.time[sample];
    expect(floorDisplacement(a.ground,a.time,1,0,t)).toEqual(a.ground[sample]);
  });
  it('playback speed only changes elapsed display time',()=>{
    const start:Clock={status:'playing',time:0};
    const a=transition(start,{type:'tick',seconds:1,speed:2,loop:false},10);
    const b=transition(start,{type:'tick',seconds:4,speed:.5,loop:false},10);
    expect(a).toEqual(b);
    const first=solveJob(job),second=solveJob(job);
    expect(second.results[0].packed).toEqual(first.results[0].packed);
  });
  it('holds the playhead while paused and resumes from the same position',()=>{
    const initial={status:'playing',time:2} as const;
    const paused=transition(initial,{type:'pause'},8);
    expect(transition(paused,{type:'tick',seconds:3,speed:4,loop:false},8)).toBe(paused);
    expect(transition(paused,{type:'play'},8)).toEqual(initial);
  });
  it('scrubs within limits and replays loops across the endpoint',()=>{
    expect(transition(ready,{type:'seek',time:-1},8).time).toBe(0);
    expect(transition(ready,{type:'seek',time:20},8)).toEqual({status:'paused',time:8});
    expect(transition({status:'playing',time:7},{type:'tick',seconds:1,speed:2,loop:true},8).time).toBe(1);
  });
  it('amplifies visual displacement and leaves the native model quantities unchanged',()=>{
    const base=storeyTransform(.004,.018,3,1),amplified=storeyTransform(.004,.018,3,8);
    expect(amplified.shift).toBe(base.shift*8);expect(amplified.slope).toBe(base.slope*8);
  });
  it('maps absolute interstorey drift to a shared percent legend',()=>{
    const output=solveJob(job);
    const drift=Math.max(...output.results.map(r=>r.peak.drift));
    expect(heatMagnitude('Drift',-.023)).toBeCloseTo(2.3,12);
    expect(scaleFor(output.results,'Drift')).toBeCloseTo(100*drift,12);
  });
  it('locates the true roof peak in the calculated time history',()=>{
    const result=solveJob(job).results[0];
    const peak=peakAt(result,'roof'),n=result.structure.mass.length;
    expect(peak.value).toBe(result.peak.roofDisplacement);
    expect(Math.abs(floorDisplacement(result.traces.displacement,result.time,n,n-1,peak.time))).toBe(peak.value);
  });
  it('keeps identical comparison models numerically identical under shared input',()=>{
    const [first,second]=solveJob({...job,buildings:[a,a]}).results;
    expect(first.packed).toEqual(second.packed);
  });
  it('matches the analytic SDOF dynamic magnification factor',()=>{
    const omega=2*Math.PI*2,zeta=.05;
    const curve=resonanceCurve({storeys:[{heightM:3,massKg:1000,stiffnessNPerM:1000*omega**2}],damping:{kind:'viscous',ratio:zeta}},1,3,3);
    const error=curve.reduce((max,p)=>Math.max(max,Math.abs(p.amplification!-1/Math.hypot(1-(p.hz/2)**2,2*zeta*p.hz/2))),0);
    console.info('SDOF frequency-response max absolute error',error);
    expect(error).toBeLessThan(1e-12);
    expect(curve[1].amplification).toBeCloseTo(1/(2*zeta),12);
  });
  it('round-trips config and emits unit-labelled numerical CSV',()=>{
    const scenario={id:'study-1',name:'Ground motion study',version:1,job};
    expect(readScenario(JSON.stringify(scenario))).toEqual(scenario);
    const csv=responseCsv(solveJob(job));
    expect(csv[0]).toMatch(/ground_acceleration_m_s2/);expect(csv[0]).toMatch(/B_storey_1_absoluteAcceleration_m_s2/);
    expect(csv).toHaveLength(502);
  });
  it('rejects oversized, invalid and incompatible inputs',()=>{
    expect(()=>makeMotion({...input,dt:.001,duration:120})).toThrow(/12,001/);
    expect(()=>makeMotion({...input,form:'Imported CSV'})).toThrow(/CSV/);
    expect(()=>readScenario('{"version":2}')).toThrow(/version 1/);
    expect(()=>makeMotion({...input,hz:20,dt:.1})).toThrow(/sampling/);
  });
  it('cancels an integration and does not publish completion',()=>{
    let progress=0;
    expect(()=>solveJob(job,{onProgress:f=>progress=f,cancelled:()=>progress>.2})).toThrow(SimulationCancelled);
    expect(progress).toBeLessThan(1);
  });
  it('releases worker resources once and discards stale replies after cancellation or replacement',()=>{
    const slot=new WorkerSlot();
    const ended:string[]=[];
    const one={terminate:()=>ended.push('one')},two={terminate:()=>ended.push('two')};
    slot.take(one);slot.take(two);
    expect(slot.owns(one)).toBe(false);expect(slot.owns(two)).toBe(true);
    slot.close();slot.close();
    expect(slot.owns(two)).toBe(false);expect(ended).toEqual(['one','two']);
  });
  it('returns corrected synthetic ground to rest and zero offset',()=>{
    const corrected=baselineCorrect(Float64Array.from({length:300},(_,i)=>.2+Math.sin(i*.081)),.01);
    const {motion}=makeMotion(input);
    const result=solveJob(job).results[0];
    const offset=groundDisplacement({...motion,acceleration:corrected},Float64Array.of(0,2.99)).at(-1)!;
    console.info('synthetic final ground offset (m)',result.groundDisplacement.at(-1));
    expect(Math.abs(offset)).toBeLessThan(1e-12);
    expect(Math.abs(result.groundDisplacement.at(-1)!)).toBeLessThan(1e-11);
  });
});
