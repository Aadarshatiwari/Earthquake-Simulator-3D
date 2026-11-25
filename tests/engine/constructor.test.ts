import {describe,expect,it} from 'vitest';
import {assembleModel,runSimulation,waveform} from '../../src/engine';
import {floorDisplacement,generate} from '../../src/constructor/geometry';
import {editHistory,materials,moveHistory,presetConfig,presets,readLibrary,readProject,resize,toModel,validateConfig,writeProject,type History,type Project} from '../../src/constructor/model';
import {groundDisplacement} from '../../src/constructor/analysis';

describe('parametric building constructor',()=>{
  const base=presetConfig('Concrete residence');
  for(const length of [1,5,10,20])it('generates '+length+' storeys with valid components and stable IDs',()=>{
    const c=resize(base,length),b=generate(c);
    expect(b.elevations).toHaveLength(length);
    expect(b.height).toBeCloseTo(length*base.levels[0].heightM,10);
    expect(b.parts.filter(x=>x.type==='Column')).toHaveLength(length*(c.baysX+1)*(c.baysZ+1));
    expect(new Set(b.parts.map(x=>x.id)).size).toBe(b.parts.length);
    expect(b.parts.map(x=>x.id)).toEqual(generate(c).parts.map(x=>x.id));
    expect(b.parts.every(x=>x.size.every(n=>n>0&&Number.isFinite(n))&&materials.includes(x.surface))).toBe(true);
  });
  it('calculates bay pitches and perimeter dimensions in metres',()=>{
    const c={...base,width:12,length:8,columnWidth:.5,columnDepth:.4};
    const b=generate(c);
    expect(b.width).toBe(12.5);expect(b.length).toBe(8.4);
    expect(b.parts.find(p=>p.id==='L1/column-0-0')?.center[0]).toBe(-6);
    expect(b.parts.find(p=>p.id==='L1/beam-x-0-0')?.size[0]).toBe(5.5);
  });
  it('validates all presets and gives each a specific geometry or material feature',()=>{
    for(const p of presets){
      const config=presetConfig(p);
      expect(()=>validateConfig(config)).not.toThrow();
      const b=generate(config);
      expect(assembleModel(toModel(config)).modes[0].hz).toBeGreaterThan(0);
      if(p==='Himalayan stone')expect(b.parts.some(part=>part.surface==='Stone')).toBe(true);
      if(p==='Newari brick')expect(b.parts.some(part=>part.type==='Trim'&&part.surface==='Timber')).toBe(true);
      if(p==='Soft storey')expect(b.parts.some(part=>part.storey===0&&part.type==='Wall')).toBe(false);
      if(p==='Cross-braced frame')expect(b.parts.filter(part=>part.type==='Brace')).toHaveLength(config.levels.length*2);
      if(p==='Shear-wall frame')expect(b.parts.filter(part=>part.type==='Shear wall')).toHaveLength(config.levels.length);
      if(p==='Base-isolated frame')expect(b.parts.some(part=>part.type==='Bearing')).toBe(true);
    }
  });
  it('slopes both pitched roof panels upward toward a common ridge',()=>{
    const building=generate(presetConfig('Newari brick'));
    const roofs=building.parts.filter(part=>part.id.includes('/pitch-'));
    expect(roofs).toHaveLength(2);
    const ridge=roofs.map(part=>{
      const [,,z]=part.center;
      const a=part.rotation![0];
      const ridgeLocalZ=-z/Math.cos(a);
      return part.center[1]-Math.sin(a)*ridgeLocalZ;
    });
    expect(ridge[0]).toBeCloseTo(ridge[1],12);
    expect(ridge[0]).toBeCloseTo(building.height,12);
    expect(ridge[0]).toBeGreaterThan(roofs[0].center[1]);
  });
  it('rejects incompatible bays, dimensions, members, and invalid inputs',()=>{
    for(const config of [{...base,baysX:5,width:4},{...base,beamWidth:1},{...base,entryBay:4},{...base,length:NaN},
      {...base,levels:[]},{...base,finish:'fake'},{...base,levels:[{heightM:3,massKg:0,stiffnessNPerM:1e6}]}])expect(()=>validateConfig(config)).toThrow();
  });
  it('maps nonuniform storey heights, masses, stiffness and isolation to the same ordered DOFs',()=>{
    const c=resize(presetConfig('Base-isolated frame'),2);
    c.levels[1]={heightM:2.9,massKg:94000,stiffnessNPerM:91e6};
    const model=toModel(c);
    const a=assembleModel(model);
    expect(Array.from(a.mass)).toEqual([c.bearingMass,c.levels[0].massKg,94000]);
    expect(Array.from(a.height)).toEqual([.45,c.levels[0].heightM,2.9]);
    expect(Array.from(a.springs)).toEqual([c.bearingStiffness,c.levels[0].stiffnessNPerM,91e6]);
    expect(generate(c).elevations).toEqual([.45,.45+c.levels[0].heightM]);
    expect(assembleModel(toModel({...c,finish:'Glass'})).K).toEqual(a.K);
  });
  it('interpolates the selected DOF, including the final nonuniform saved interval',()=>{
    const trace=Float64Array.of(0,10,2,20,5,50),times=Float64Array.of(0,.2,.3);
    expect(floorDisplacement(trace,times,2,1,.25)).toBeCloseTo(35,10);
    expect(floorDisplacement(trace,times,2,0,-1)).toBe(0);
    expect(floorDisplacement(trace,times,2,1,10)).toBe(50);
  });
  it('uses actual normalized eigenvectors and displacement history from the Phase 1 solver',()=>{
    const model=toModel(resize(base,5));
    const result=runSimulation(model,waveform({dt:.005,seconds:3,kind:'envelope',frequencyHz:1.45,amplitude:.28,unit:'g'}));
    expect(result.peak.roofDisplacement).toBeGreaterThan(0);
    expect(result.structure.modes[0].shape).toEqual(assembleModel(model).modes[0].shape);
    const md=result.structure.modes[0],m=result.structure.mass;
    expect(md.shape.reduce((value,x,i)=>value+x*x*m[i],0)).toBeCloseTo(1,12);
  });
  it('integrates constant input acceleration into ground displacement',()=>{
    const motion={dt:.1,label:'Constant analytical check',acceleration:new Float64Array(11).fill(2)};
    const times=Float64Array.of(0,.2,.5,1);
    expect(Array.from(groundDisplacement(motion,times)).map(v=>+v.toFixed(10))).toEqual([0,.04,.25,1]);
  });
  it('serializes and restores a named project and local library',()=>{
    const p:Project={version:1,id:'demo-1',name:'Kathmandu test',config:base};
    expect(readProject(writeProject(p))).toEqual(p);
    expect(readLibrary(JSON.stringify([p]))).toEqual([p]);
    expect(()=>readProject(JSON.stringify({...p,version:2}))).toThrow();
    expect(()=>readProject(JSON.stringify({...p,config:{...base,levels:[null]}}))).toThrow();
    expect(()=>readLibrary('{')).toThrow();
  });
  it('undoes and redoes edits, and clears the redo branch after a new edit',()=>{
    const project:Project={version:1,id:'demo-1',name:'Original',config:base};
    const h:History={current:project,past:[],future:[]};
    const changed=editHistory(h,{...project,name:'Renamed'});
    const undone=moveHistory(changed,'undo');
    expect(undone.current).toEqual(project);
    expect(moveHistory(undone,'redo').current.name).toBe('Renamed');
    expect(editHistory(undone,{...project,name:'Alternative'}).future).toEqual([]);
  });
});
