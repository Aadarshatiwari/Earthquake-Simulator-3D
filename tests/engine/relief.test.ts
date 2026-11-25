import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {buildRelief,heightAt,overviewDistance,parseElevation} from '../../src/archive/relief';
import {advanceIllustration,markerColour,markerRadius,mergeEvents,originDistance,secondsBetween} from '../../src/archive/presentation';
import {districtAt,localKilometres} from '../../src/archive/geography';
import {parseCatalog,type RecordingMeta} from '../../src/archive/catalog';
import {parseArrayRecord} from '../../src/archive/waveform';
import {solveJob} from '../../src/seismic/jobs';
import {defaults,G} from '../../src/seismic/motion';
import {presetConfig} from '../../src/constructor/model';

const root=new URL('../../public/archive/',import.meta.url);
const bytes=(name:string)=>readFileSync(new URL(name,root));
const asset=(name:string)=>JSON.parse(bytes(name).toString());
const fixture={w:2,h:2,west:84.1,south:28.4,step:.25,elevations:[0,2000,1000,3000]};

it('interpolates the published grid in kilometres and projects east and north correctly',()=>{
  const grid=parseElevation(fixture);
  expect(heightAt(grid,84.225,28.525)).toBeCloseTo(1.5,8);
  expect(heightAt(grid,84.35,28.65)).toBeCloseTo(3,8);
  expect(localKilometres(84.1,28.4)).toEqual([0,0]);
  expect(localKilometres(84.35,28.65)[0]).toBeGreaterThan(0);
  expect(localKilometres(84.35,28.65)[1]).toBeLessThan(0);
});

it('rejects malformed or unbounded elevation data',()=>{
  for(const invalid of [null,{...fixture,w:88888},{...fixture,step:0},{...fixture,elevations:[0,1,2,Infinity]},{...fixture,elevations:[0]}]){
    expect(()=>parseElevation(invalid)).toThrow();
  }
});

it('generates a front-facing indexed mesh with positive upward normals and valid bounds',()=>{
  const mesh=buildRelief(parseElevation(fixture),'Relief');
  expect(Array.from(mesh.index!.array)).toEqual([0,1,2,1,3,2]);
  expect(mesh.attributes.normal.getY(0)).toBeGreaterThan(.9);
  expect(mesh.boundingBox?.max.y).toBe(3);
  expect(mesh.boundingSphere?.radius).toBeGreaterThan(0);
  mesh.dispose();
  const grid=parseElevation(asset('relief.json'));
  expect(grid.elevations).toHaveLength(31122);
  expect(grid.step).toBe(.035);
  expect(Math.max(...grid.elevations)).toBeGreaterThan(7500);
});

it('fits narrower viewports at a larger camera distance and keeps graphic encodings ordered',()=>{
  expect(overviewDistance(.8)).toBeGreaterThan(overviewDistance(1.8));
  expect(markerRadius(8)).toBeGreaterThan(markerRadius(5));
  expect(markerColour('Depth',15)).not.toBe(markerColour('Depth',16));
  expect(markerColour('Magnitude',6.999)).not.toBe(markerColour('Magnitude',7));
  expect(markerColour('Magnitude',null)).not.toBe(markerColour('Magnitude',7));
});

it('leaves out-of-country epicentres outside Nepal districts',()=>{
  const districts=asset('districts.json');
  expect(districtAt(districts,85.324,27.7172)?.name).toBe('Kathmandu');
  expect(districtAt(districts,85.324,26)).toBeUndefined();
  const faults=asset('gem-active-faults.json').features;
  expect(faults).toHaveLength(50);
  expect(faults.every((feature:{properties:{catalog_name:string};geometry:{type:string}})=>
    feature.properties.catalog_name==='HimaTibetMap'&&feature.geometry.type==='LineString')).toBe(true);
});

it('merges stable ComCat IDs and extends offline coverage past 2024',()=>{
  const original=parseCatalog(asset('catalog.json'));
  const extension=parseCatalog(asset('catalog-extension.json'));
  expect(extension).toHaveLength(18);
  expect(extension.every(e=>e.year>=2025)).toBe(true);
  expect(mergeEvents(original,extension,[extension[0]])).toHaveLength(291);
});

it('preserves different station start times and clamps replay at both endpoints',()=>{
  expect(secondsBetween('2015-04-25T06:11:25.95Z','2015-04-25T06:11:27.00Z')).toBeCloseTo(-1.05,8);
  expect(originDistance(27,85,28,85)).toBeCloseTo(111.19,1);
  expect(advanceIllustration(4,1,2,10)).toBe(6);
  expect(advanceIllustration(9,1,2,10)).toBe(10);
  expect(advanceIllustration(0,-1,1,10)).toBe(0);
});

it('checks the four original Gorkha records and solves their true sampling interval',()=>{
  const records=asset('gorkha-mainshock.json') as RecordingMeta[];
  expect(records.map(entry=>entry.station)).toEqual(['KTP','TVU','PTN','THM']);
  for(const record of records){
    expect(record.event).toBe('us20002926');
    expect(record.start).toBe('2015-04-25T06:11:25.95Z');
    const raw=bytes(record.asset);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(record.sha256);
    const trace=parseArrayRecord(raw.toString(),record);
    expect(trace.dt).toBe(.01);
    expect(trace.duration).toBeCloseTo(99.99,8);
    if(record.station==='KTP'){
      expect(trace.components.NS[0]).toBeCloseTo(.001652,12);
      expect(trace.pga.NS/G).toBeGreaterThan(.1);
      const solution=solveJob({buildings:[{id:'check',name:'test frame',version:1,config:presetConfig('Concrete residence')}],
        settings:{...defaults,form:'Imported CSV'},recording:{label:record.station,provenance:record.sha256,dt:trace.dt,samples:Array.from(trace.components.NS)}});
      expect(solution.results[0].time.at(-1)).toBeCloseTo(99.99,8);
      expect(solution.provenance).toBe(record.sha256);
      expect(solution.hasGroundDisplacement).toBe(false);
    }
  }
});
