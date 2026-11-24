import {describe,expect,it} from 'vitest';
import {G,assembleModel,dampingCoefficients,duration,engineeringPreset,importCsv,pga,resample,runSimulation,SimulationCancelled,toSI,waveform,type GroundMotion,type Model} from '../../src/engine';

const floor={massKg:1000,heightM:3,stiffnessNPerM:100000};
const model:Model={storeys:[floor],damping:{kind:'none'}};
function zero(dt=.002,seconds=2):GroundMotion{
  return {dt,label:'Analytical check',acceleration:new Float64Array(Math.round(seconds/dt)+1)};
}
const withInitial=(u:number,v=0):Model=>({...model,storeys:[{...floor,initialDisplacementM:u,initialVelocityMPerS:v}]});
const max=(a:Float64Array)=>a.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0);
function exactError(result:ReturnType<typeof runSimulation>,reference:(t:number)=>number){
  return max(result.time.map((t,i)=>result.traces.displacement[i]-reference(t)));
}

describe('Phase 1 analytical validation',()=>{
  it('SDOF frequency equals sqrt(k/m) and period is reciprocal Hz',()=>{
    const [mode]=assembleModel(model).modes;
    expect(mode.omega).toBeCloseTo(10,12);expect(mode.period).toBeCloseTo(Math.PI/5,12);
  });
  it('undamped free vibration matches analytic response with initial velocity',()=>{
    const result=runSimulation(withInitial(.04,.19),zero());
    const error=exactError(result,t=>.04*Math.cos(10*t)+.019*Math.sin(10*t));
    console.info('undamped_max_m',error);
    expect(error).toBeLessThan(3e-5);
  });
  it('damped free vibration matches the underdamped analytical solution',()=>{
    const result=runSimulation({...withInitial(.04,.19),damping:{kind:'viscous',ratio:.07}},zero());
    const wd=10*Math.sqrt(1-.07**2);
    const error=exactError(result,t=>Math.exp(-.7*t)*(.04*Math.cos(wd*t)+(.19+.7*.04)/wd*Math.sin(wd*t)));
    console.info('damped_max_m',error);
    expect(error).toBeLessThan(1.5e-5);
  });
  it('harmonic base excitation matches the zero-state analytical response',()=>{
    const ground=waveform({dt:.001,seconds:3,frequencyHz:4/(2*Math.PI),amplitude:2,unit:'m/s²',kind:'sine'});
    const result=runSimulation(model,ground);
    const error=exactError(result,t=>-2/84*(Math.sin(4*t)-.4*Math.sin(10*t)));
    console.info('harmonic_max_m',error);
    expect(error).toBeLessThan(4e-6);
  });
  it('zero motion and zero initial state produce exactly zero traces',()=>{
    const result=runSimulation(model,zero());
    expect(max(result.packed.subarray(0,7*result.time.length))).toBe(0);
  });
  const two:Model={...model,storeys:[floor,{...floor,massKg:2000,stiffnessNPerM:60000}]};
  it('assembles nonuniform lumped mass including configurable roof mass',()=>{
    const result=assembleModel(two);
    expect(Array.from(result.M)).toEqual([1000,0,0,2000]);expect(result.totalMassKg).toBe(3000);
  });
  it('assembles two independent springs and enforces fixed-base boundary',()=>{
    expect(Array.from(assembleModel(two).K)).toEqual([160000,-60000,-60000,60000]);
  });
  it('stiffness is symmetric and positive definite',()=>{
    const K=assembleModel(two).K;
    expect(K[1]).toBe(K[2]);expect(K[0]).toBeGreaterThan(0);expect(K[0]*K[3]-K[1]**2).toBeGreaterThan(0);
  });
  it('matches independently expanded two-storey characteristic polynomial',()=>{
    const result=assembleModel(two);
    const expected=[(190-Math.sqrt(24100))/2,(190+Math.sqrt(24100))/2];
    let error=0;
    result.modes.forEach((m,i)=>{
      error=Math.max(error,Math.abs(m.omega**2-expected[i]));
      expect(result.mass.reduce((sum,mass,j)=>sum+mass*m.shape[j]**2,0)).toBeCloseTo(1,12);
    });
    console.info('two_storey_eigenvalue_max_rad2_s2',error);
    expect(error).toBeLessThan(1e-10);
    expect(result.modes.reduce((sum,m)=>sum+m.effectiveMassRatio,0)).toBeCloseTo(1,12);
  });
  it('Rayleigh, mass and stiffness damping recover selected modal ratios',()=>{
    const modes=assembleModel(two).modes;
    const {alpha,beta}=dampingCoefficients({kind:'rayleigh',first:{mode:0,ratio:.04},second:{mode:1,ratio:.05}},modes);
    modes.forEach(({omega},i)=>expect(alpha/(2*omega)+beta*omega/2).toBeCloseTo(i?.05:.04,12));
    expect(dampingCoefficients({kind:'mass',mode:0,ratio:.04},modes).alpha).toBeCloseTo(.08*modes[0].omega,12);
    expect(dampingCoefficients({kind:'stiffness',mode:1,ratio:.05},modes).beta).toBeCloseTo(.1/modes[1].omega,12);
  });
  it('Newmark average acceleration converges at second order',()=>{
    const u=withInitial(.04);
    const errors=[.02,.01,.005].map(dt=>exactError(runSimulation(u,zero(dt)),t=>.04*Math.cos(10*t)));
    console.info('convergence_max_m',errors);
    expect(errors[0]/errors[1]).toBeGreaterThan(3.8);expect(errors[1]/errors[2]).toBeGreaterThan(3.8);
  });
  it('uses adjacent relative displacements and independent heights for drift',()=>{
    const result=runSimulation({...two,storeys:[{...two.storeys[0],initialDisplacementM:.03},{...two.storeys[1],initialDisplacementM:.05,heightM:4}]},zero());
    expect(result.traces.drift[0]).toBeCloseTo(.01,12);expect(result.traces.drift[1]).toBeCloseTo(.005,12);
    expect(result.traces.restoringForce[1]).toBeCloseTo(1200,10);
  });
  it('adds input motion to relative acceleration and initializes from equilibrium',()=>{
    const ground=zero();ground.acceleration.fill(2);
    const result=runSimulation(withInitial(.04),ground);
    expect(result.traces.relativeAcceleration[0]).toBe(-6);expect(result.traces.absoluteAcceleration[0]).toBe(-4);
    expect(result.baseShear[0]).toBe(4000);
  });
  it('conserves undamped free-vibration energy',()=>{
    const result=runSimulation(withInitial(.04,.19),zero());
    console.info('undamped_energy_max_J',result.peak.energyResidual);
    expect(result.peak.energyResidual).toBeLessThan(1e-9);
  });
  it('accounts for damped energy dissipation and external work',()=>{
    const config={...withInitial(.04),damping:{kind:'viscous',ratio:.1}} as Model;
    const result=runSimulation(config,zero(.002,5));
    const energy=result.energy;
    expect(energy.dissipation.at(-1)).toBeGreaterThan(.99*energy.initialEnergy);
    expect(energy.dissipation.every((x,i)=>i===0||x>=energy.dissipation[i-1])).toBe(true);
    expect(result.peak.energyResidual).toBeLessThan(1e-9);
    const forced=runSimulation(config,waveform({dt:.002,seconds:3,frequencyHz:2,amplitude:.3,unit:'g',kind:'envelope'}));
    console.info('forced_energy_max_J',forced.peak.energyResidual);
    expect(forced.peak.energyResidual).toBeLessThan(1e-8);
  });
  it('rejects invalid mass, stiffness, damping, acceleration and output allocation',()=>{
    for(const massKg of [0,-1,NaN,Infinity])expect(()=>assembleModel({...model,storeys:[{...floor,massKg}]})).toThrow(/Mass/);
    expect(()=>assembleModel({...model,storeys:[{...floor,stiffnessNPerM:0}]})).toThrow(/Stiffness/);
    expect(()=>assembleModel({...model,damping:{kind:'mass',ratio:-1,mode:0}})).toThrow(/Damping/);
    expect(()=>runSimulation(model,{...zero(),acceleration:Float64Array.of(1,NaN)})).toThrow(/invalid sample/);
    expect(()=>runSimulation(model,zero(),{maxOutputBytes:512})).toThrow(/memory budget/);
  });
  it('parses source-labelled CSV and rejects invalid spacing',()=>{
    const motion=importCsv('time_s,accel_m_s2\n12,0\n12.01,-3\n12.02,1','file','station');
    expect(duration(motion)).toBeCloseTo(.02,12);expect(pga(motion)).toBe(3);
    expect(()=>importCsv('time_s,accel_g\n0,0\n.01,1\n.03,2','file','station')).toThrow(/uniform/);
    expect(()=>importCsv('time_s,accel_g\n0,0\n.01,1','file','')).toThrow(/station/);
  });
  it('converts g consistently, reproduces seeded samples and resamples',()=>{
    expect(toSI(1,'g')).toBe(G);
    expect(importCsv('time_s,accel_g\n0,0\n.02,-1','file','station').acceleration[1]).toBe(-G);
    const seed={dt:.01,seconds:3,frequencyHz:2,amplitude:.2,unit:'g',kind:'seeded',seed:11} as const;
    const a=waveform(seed);
    expect(waveform(seed).acceleration).toEqual(a.acceleration);
    expect(waveform({...seed,seed:12}).acceleration).not.toEqual(a.acceleration);
    expect(pga(a)).toBeCloseTo(.2*G,12);
    expect(resample(a,.02).acceleration.length).toBe(151);
  });
  it('reports progress and cooperatively cancels an active integration',()=>{
    let progress=0;
    expect(()=>runSimulation(model,zero(.001,10),{onProgress:v=>progress=v,cancelled:()=>progress>.1})).toThrow(SimulationCancelled);
    expect(progress).toBeGreaterThan(.1);expect(progress).toBeLessThan(1);
  });
  it('20-storey run preserves peaks, samples final step and fits bounded storage',()=>{
    const preset=engineeringPreset('Soft storey');
    const config={...preset,storeys:Array.from({length:20},(_,i)=>preset.storeys[i%3])};
    const motion=waveform({dt:.005,seconds:30,frequencyHz:2,amplitude:.3,unit:'g',kind:'seeded'});
    const result=runSimulation(config,motion,{stride:7});
    expect(result.time.at(-1)).toBe(30);expect(result.peak.roofDisplacement).toBeGreaterThan(0);
    expect(result.diagnostics.bytes).toBeLessThan(1.1e6);
    expect(result.peak).toEqual(runSimulation(config,motion).peak);
    console.info('20_storey_ms_bytes',result.diagnostics.elapsedMs,result.diagnostics.bytes);
    expect(result.diagnostics.elapsedMs).toBeLessThan(5000);
  });
});
