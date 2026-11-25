import {readProject} from '../constructor/model';
import {makeMotion} from './motion';
import type {Job,Output} from './jobs';
export type Scenario={version:1;id:string;name:string;job:Job};
export type Saved=Scenario&{output?:Output};
export function readScenario(raw:string):Scenario{
  if(raw.length>2_000_000)throw Error('Scenario files are limited to 2 MB.');
  const input=JSON.parse(raw) as Scenario;
  if(!input||input.version!==1||typeof input.id!=='string'||!/^[\w-]{1,80}$/.test(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>80||!Array.isArray(input.job?.buildings)||input.job.buildings.length<1||input.job.buildings.length>2||!input.job.settings)throw Error('Expected a valid version 1 simulation configuration.');
  const buildings=input.job.buildings.map(item=>readProject(JSON.stringify(item)));
  makeMotion(input.job.settings,input.job.recording);
  return {version:1,id:input.id,name:input.name.trim(),job:{...input.job,buildings}};
}
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('seismonepal-simulations',2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      const store=db.objectStoreNames.contains('runs')?request.transaction!.objectStore('runs'):db.createObjectStore('runs',{keyPath:'id'});
      if(!store.indexNames.contains('name'))store.createIndex('name','name');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function storage<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await openDb();
  try{return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction('runs',mode),request=operation(tx.objectStore('runs'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error??Error('Storage transaction was aborted.'));
  });}finally{db.close();}
}
export async function listScenarios():Promise<{id:string;name:string}[]>{
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const names:{id:string;name:string}[]=[];
    const request=db.transaction('runs','readonly').objectStore('runs').index('name').openKeyCursor();
    request.onsuccess=()=>{
      const cursor=request.result;
      if(!cursor){resolve(names);return;}
      names.push({id:String(cursor.primaryKey),name:String(cursor.key)});cursor.continue();
    };
    request.onerror=()=>reject(request.error);
  });}finally{db.close();}
}
export const loadScenario=(id:string)=>storage<Saved|undefined>('readonly',store=>store.get(id));
export const saveScenario=(saved:Saved)=>storage('readwrite',store=>store.put(saved));
export const deleteScenario=(id:string)=>storage('readwrite',store=>store.delete(id));

export function checkedOutput(scenario:Scenario,output:Output|undefined):Output|null{
  if(!output)return null;
  const count=scenario.job.buildings.length;
  if(!Array.isArray(output.results)||output.results.length!==count||!Array.isArray(output.offsets)||output.offsets.length!==count)return null;
  for(let i=0;i<count;i++){
    const config=scenario.job.buildings[i].config,r=output.results[i],offset=Number(config.isolation),n=config.levels.length+offset;
    if(!r||output.offsets[i]!==offset||!(r.time instanceof Float64Array)||r.time.length<2||r.time.length>18001||r.structure?.mass?.length!==n||
      !(r.ground instanceof Float64Array)||r.ground.length!==r.time.length||!(r.baseShear instanceof Float64Array)||r.baseShear.length!==r.time.length||
      !(r.groundDisplacement instanceof Float64Array)||r.groundDisplacement.length!==r.time.length||!r.energy||!r.peak||!r.diagnostics||!Array.isArray(r.warnings))return null;
    for(const key of ['displacement','velocity','relativeAcceleration','absoluteAcceleration','interstoreyDisplacement','drift','restoringForce'] as const){
      if(!(r.traces?.[key] instanceof Float64Array)||r.traces[key].length!==r.time.length*n)return null;
    }
    for(const key of ['kinetic','strain','dissipation','work','residual'] as const){
      if(!(r.energy[key] instanceof Float64Array)||r.energy[key].length!==r.time.length)return null;
    }
  }
  if(output.hasGroundDisplacement&&(!(output.groundVelocity instanceof Float64Array)||output.groundVelocity.length!==output.results[0].time.length))return null;
  return output;
}
