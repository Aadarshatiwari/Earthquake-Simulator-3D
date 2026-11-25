import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {filterEvents,formatTime,initialFilters,parseCatalog,specialEvents,type RecordingMeta} from '../../src/archive/catalog';
import {districtAt,type Bounds} from '../../src/archive/geography';
import {components,horizontal,parseArrayRecord,sampleAt,spectrum} from '../../src/archive/waveform';
import {presetConfig,type Project} from '../../src/constructor/model';
import {defaults,G} from '../../src/seismic/motion';
import {solveJob} from '../../src/seismic/jobs';

const asset=(name:string)=>readFileSync(new URL('../../public/archive/'+name,import.meta.url));
const json=(name:string)=>JSON.parse(asset(name).toString('utf8'));
const catalogue=()=>parseCatalog(json('catalog.json'));
const recordings=json('recordings.json') as RecordingMeta[];
const traceFor=(meta:RecordingMeta)=>parseArrayRecord(asset(meta.asset).toString('utf8'),meta);

it('loads the offline catalogue, original magnitude scales, coordinates and provenance',()=>{
  const events=catalogue();
  expect(events).toHaveLength(273);
  expect(events.find(x=>x.id==='us20002ejl')).toMatchObject({mag:7.3,magType:'mww',lat:27.8087,lon:86.0655,depth:15,source:'USGS ComCat'});
  expect(events.find(x=>x.id==='iscgem904745')?.source).toBe('ISC-GEM via USGS');
  expect(events.find(x=>x.id==='us20002926')?.url).toContain('/us20002926');
  expect(new Set(events.map(x=>x.magType)).size).toBeGreaterThan(1);
});

it('uses Nepal local time and preserves historical and catalogue uncertainty',()=>{
  const dolakha=catalogue().find(x=>x.id==='us20002ejl')!;
  expect(formatTime(dolakha,'Asia/Kathmandu')).toContain('12:50:19');
  expect(formatTime(dolakha,'UTC')).toContain('07:05:19');
  expect(specialEvents[0]).toMatchObject({lat:null,lon:null,depth:null,mag:null,date:null});
  expect(parseCatalog([['broken']])).toEqual([]);
  expect(()=>parseCatalog(null)).toThrow();
});

it('locates and filters events using all seven provinces and 77 districts',()=>{
  const events=[...specialEvents,...catalogue()];
  const districts=json('districts.json') as Bounds;
  expect(districts.features).toHaveLength(77);
  expect((json('provinces.json') as Bounds).features).toHaveLength(7);
  expect(districtAt(districts,85.324,27.7172)).toMatchObject({name:'Kathmandu'});
  const locate=(e:(typeof events)[number])=>districtAt(districts,e.lon,e.lat);
  const filtered=filterEvents(events,{...initialFilters,province:'Bagmati',district:'Dolakha',minimum:'7',recorded:true},new Set(recordings.map(r=>r.event)),locate);
  expect(filtered.map(e=>e.id)).toEqual(['us20002ejl']);
  expect(filterEvents(events,{...initialFilters,query:'1255'},new Set(),locate)).toEqual([specialEvents[0]]);
});

it('verifies checksums, clock, sample counts and SI conversion for every station file',()=>{
  expect(recordings).toHaveLength(16);
  expect(new Set(recordings.map(x=>x.event)).size).toBe(3);
  for(const metadata of recordings){
    const bytes=asset(metadata.asset);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(metadata.sha256);
    const text=bytes.toString('utf8');
    const trace=parseArrayRecord(text,metadata);
    const sourceValues=text.split(/\r?\n/)[10].trim().split(/\s+/).map(Number);
    expect(trace.duration).toBeCloseTo(179.99,8);
    components.forEach((name,index)=>{
      expect(trace.components[name]).toHaveLength(18000);
      expect(trace.components[name][0]).toBeCloseTo(sourceValues[index+1]/100,14);
      expect(trace.pga[name]).toBeGreaterThan(0);
    });
  }
});

it('preserves direction and duration in two solves under identical recorded acceleration',()=>{
  const metadata=recordings.find(x=>x.event==='us20002ejl'&&x.station==='KTP')!;
  const trace=traceFor(metadata);
  expect(trace.pga.EW/G).toBeCloseTo(.0689,4);
  expect(horizontal('NS')).toBe(true);
  expect(horizontal('UD')).toBe(false);
  expect(sampleAt(trace.components.EW,trace.dt,0)).toBe(trace.components.EW[0]);
  const buildings:Project[]=['Concrete residence','Soft storey'].map((preset,index)=>({id:String(index),name:preset,version:1,config:presetConfig(preset as 'Concrete residence'|'Soft storey')}));
  const result=solveJob({buildings,settings:{...defaults,form:'Imported CSV'},recording:{label:'Recorded KTP EW',provenance:metadata.sha256,dt:trace.dt,samples:Array.from(trace.components.EW)}});
  expect(result.hasGroundDisplacement).toBe(false);
  expect(result.groundVelocity).toBeNull();
  expect(result.provenance).toBe(metadata.sha256);
  expect(result.results.map(x=>x.time.length)).toEqual([18000,18000]);
  expect(result.results[0].time.at(-1)).toBeCloseTo(179.99,8);
});

it('resolves a known 5 Hz component in the acceleration spectrum',()=>{
  const dt=.01;
  const data=Float64Array.from({length:1024},(_,i)=>Math.sin(2*Math.PI*5*i*dt));
  const {amplitude,frequency}=spectrum(data,dt);
  const peak=amplitude.indexOf(Math.max(...amplitude));
  expect(frequency[peak]).toBeCloseTo(5,1);
});
