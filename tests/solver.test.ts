import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assemble,simulate,synthetic,parseMotion,G} from '../src/solver';
import {presets} from '../src/presets';
const building={...presets['Concrete frame'],floors:1,mass:1,stiffness:.1,damping:0};
test('SI assembly and fixed-base boundary',()=>{
  const {mass,K}=assemble({...building,floors:3});
  assert.deepEqual(mass,[1000,1000,1000]);
  assert.deepEqual(K,[[200000,-100000,0],[-100000,200000,-100000],[0,-100000,100000]]);
});
test('undamped SDOF agrees with analytical free vibration',()=>{
  const dt=.002;
  const result=simulate(building,{dt,label:'test',acceleration:Array(1001).fill(0)},[.04]);
  assert.ok(Math.abs(result.modal[0].omega-10)<1e-9);
  for(const sample of result.samples)assert.ok(Math.abs(sample.displacement[0]-.04*Math.cos(10*sample.t))<.000025);
});
test('forced SDOF step response and base shear',()=>{
  const dt=.002;
  const result=simulate(building,{dt,label:'test',acceleration:Array(501).fill(2)});
  const sample=result.samples[500];
  assert.ok(Math.abs(sample.displacement[0]+.02*(1-Math.cos(10)))<.000008);
  assert.ok(Math.abs(sample.shear-100000*sample.displacement[0])<1e-7);
});
test('20 floors plus isolation stay finite under sustained motion',()=>{
  const result=simulate({...building,floors:20,system:'Base isolation',damping:5},synthetic(.6,1.4,40));
  assert.equal(result.modal.length,21);
  assert.equal(result.samples[100].drift.length,20);
  assert.ok(result.samples.every(s=>s.displacement.every(Number.isFinite)));
  assert.ok(result.modal.every((m,i)=>m.hz>0&&(i===0||m.hz>result.modal[i-1].hz)));
});
test('recording units, provenance and sample spacing',()=>{
  assert.deepEqual(parseMotion('time_s,accel_g\n0,0\n0.01,1','Station','Archive').acceleration,[0,G]);
  assert.throws(()=>parseMotion('time_s,accel_g\n0,0\n0.01,1\n0.03,0','Station','Archive'));
  assert.throws(()=>parseMotion('time_s,accel_g\n0,0\n0.01,1','Station',''));
});
test('modal eigenvectors satisfy MDOF equilibrium',()=>{
  const config={...building,floors:7,system:'Base isolation'} as const;
  const {mass,K}=assemble(config);
  const {modal}=simulate(config,{dt:.01,label:'zero',acceleration:[0,0]});
  for(const {shape,omega} of modal)K.forEach((row,i)=>{
    const ku=row.reduce((total,k,j)=>total+k*shape[j],0);
    const mu=mass[i]*shape[i]*omega**2;
    assert.ok(Math.abs(ku-mu)<1e-6);
  });
});
test('response spectrum is zero for zero input and linear in amplitude',async()=>{
  const {responseSpectrum}=await import('../src/solver');
  assert.ok(responseSpectrum({dt:.01,label:'zero',acceleration:[0,0]}).every(p=>p.pseudoAcceleration===0));
  const motion=synthetic(.2,1.25,8);
  const first=responseSpectrum(motion),second=responseSpectrum(motion,.05,2);
  assert.ok(first.every((p,i)=>p.pseudoAcceleration>0&&Math.abs(second[i].pseudoAcceleration-p.pseudoAcceleration*2)<1e-12));
});
