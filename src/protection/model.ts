import {presetConfig,validateConfig,type Config,type Preset} from '../constructor/model';
import {finite} from '../engine/matrix';
import type {Model} from '../engine';

export const bearings=['Laminated rubber','Lead-rubber','High-damping rubber','Friction pendulum'] as const;
export const braceKinds=['X','Diagonal','V','Inverted V','K · illustration'] as const;
export const walls=['Central core','External walls','Distributed walls','Elevator core'] as const;
export const dampers=['Suspended mass','Pendulum-inspired','Spring and mass','Rooftop mechanical'] as const;
export const retrofits=['None','Concrete jacketing','Steel jacketing','Soft-storey strengthening','Masonry reinforcement','Horizontal seismic bands','Improved connections'] as const;
export const archetypes=['Ordinary reinforced concrete','Traditional stone','Traditional brick','Newari residence','Open-ground commercial','Soft-storey apartment','Braced concrete','Shear-wall residence','Isolated institutional','Retrofitted rural home','Custom'] as const;
export type Archetype=typeof archetypes[number];
export type Protection={
  isolation:boolean;bearing:typeof bearings[number];baseMass:number;period:number;bearingK:number;bearingC:number;bearingRatio:number;capacity:number;
  brace:boolean;braceKind:typeof braceKinds[number];braceFirst:number;braceLast:number;braceBays:number;braceArea:number;braceE:number;tensionOnly:boolean;
  wall:boolean;wallKind:typeof walls[number];wallFirst:number;wallLast:number;wallLength:number;wallThickness:number;wallE:number;wallFactor:number;
  tmd:boolean;tmdKind:typeof dampers[number];tmdFloor:number;tmdMass:number;tmdHz:number;tmdRatio:number;
  viscous:boolean;viscousStorey:number;viscousCount:number;viscousC:number;viscousAngle:number;
  retrofit:typeof retrofits[number];retrofitK:number;retrofitMass:number;
};
export type Variant={name:string;archetype:Archetype;building:Config;devices:Protection};
export type Dashpot={from:number;to:number;c:number;axialC:number;cosine:number;count:number;kind:'Structural'|'Isolation'|'Tuned mass'|'Viscous'};

export function defaultsFor(building:Config):Protection{
  return {isolation:false,bearing:bearings[0],baseMass:85000,period:2.5,bearingK:0,bearingC:0,bearingRatio:.15,capacity:.35,
    brace:false,braceKind:'X',braceFirst:1,braceLast:building.levels.length,braceBays:1,braceArea:.002,braceE:200e9,tensionOnly:false,
    wall:false,wallKind:walls[0],wallFirst:1,wallLast:building.levels.length,wallLength:2.8,wallThickness:.24,wallE:25e9,wallFactor:.35,
    tmd:false,tmdKind:dampers[0],tmdFloor:building.levels.length,tmdMass:24000,tmdHz:1.35,tmdRatio:.12,
    viscous:false,viscousStorey:1,viscousCount:2,viscousC:750000,viscousAngle:35,retrofit:'None',retrofitK:.4,retrofitMass:.05};
}
export function presetVariant(archetype:Archetype):Variant{
  const mapping:Partial<Record<Archetype,Preset>>={'Traditional stone':'Himalayan stone','Traditional brick':'Newari brick','Newari residence':'Newari brick','Open-ground commercial':'Soft storey','Soft-storey apartment':'Modern apartment','Retrofitted rural home':'Himalayan stone'};
  const building=presetConfig(mapping[archetype]??'Concrete residence');
  if(archetype==='Traditional brick'){building.levels=building.levels.slice(0,2);building.balconies=false;}
  if(archetype==='Soft-storey apartment'){building.openGround=true;building.levels[0].stiffnessNPerM=35e6;}
  const devices=defaultsFor(building);
  if(archetype==='Braced concrete')devices.brace=true;
  if(archetype==='Shear-wall residence')devices.wall=true;
  if(archetype==='Isolated institutional')devices.isolation=true;
  if(archetype==='Retrofitted rural home')devices.retrofit='Horizontal seismic bands';
  return {name:archetype,archetype,building,devices};
}
export function axialBrace(e:number,a:number,run:number,rise:number){
  finite(e,'Brace modulus',1,1e13);finite(a,'Brace area',0,1);
  finite(run,'Brace horizontal run',.001,100);finite(rise,'Brace rise',.001,100);
  const length=Math.hypot(run,rise),cosine=run/length;
  return {k:e*a/length*cosine**2,length,angle:Math.atan2(rise,run)*180/Math.PI};
}
export function equivalentWall(e:number,length:number,thickness:number,height:number,factor:number){
  finite(e,'Concrete modulus',1,1e13);finite(length,'Wall length',.1,30);finite(thickness,'Wall thickness',.05,5);
  finite(height,'Wall height',.1,150);finite(factor,'Effective stiffness factor',0,1);
  const area=length*thickness,inertia=thickness*length**3/12,shearModulus=e/2.4;
  return factor/(height**3/(3*e*inertia)+height/((5/6)*shearModulus*area));
}
export function tunedDevice(mass:number,hz:number,ratio:number){
  finite(mass,'Tuned mass',1,1e7);finite(hz,'Tuning frequency',.05,30);finite(ratio,'Tuned damper ratio',0,1);
  const omega=2*Math.PI*hz;
  return {k:mass*omega**2,c:2*ratio*mass*omega};
}
function integer(value:number,label:string,min:number,max:number){
  finite(value,label,min,max);if(!Number.isInteger(value))throw Error(label+' must be a whole number.');return value;
}
const pick=<T extends string>(value:T,options:readonly T[],label:string)=>{
  if(!options.includes(value))throw Error('Invalid '+label+'.');
};
export function buildVariant(variant:Variant){
  const {building:b,devices:d}=variant;
  validateConfig(b);
  if(!d||typeof variant.name!=='string'||!variant.name.trim()||variant.name.length>80)throw Error('A named protection configuration is required.');
  pick(variant.archetype,archetypes,'archetype');
  pick(d.bearing,bearings,'bearing');pick(d.braceKind,braceKinds,'brace');pick(d.wallKind,walls,'wall');pick(d.tmdKind,dampers,'damper');pick(d.retrofit,retrofits,'retrofit');
  for(const key of ['isolation','brace','wall','tmd','viscous','tensionOnly'] as const)if(typeof d[key]!=='boolean')throw Error('Invalid '+key+' setting.');
  const n=b.levels.length,offset=Number(d.isolation);
  const storeys=b.levels.map(level=>({...level,damperNsPerM:0}));
  const floor=(value:number,label:string)=>integer(value,label,1,n);
  const retrofitAnalytical=['Concrete jacketing','Steel jacketing','Soft-storey strengthening'].includes(d.retrofit);
  if(retrofitAnalytical){
    const mass=finite(d.retrofitMass,'Retrofit mass fraction',0,1);
    const stiffness=finite(d.retrofitK,'Retrofit stiffness fraction',0,5);
    for(const level of d.retrofit==='Soft-storey strengthening'?storeys.slice(0,1):storeys){
      level.massKg*=1+mass;level.stiffnessNPerM*=1+stiffness;
    }
  }
  const structural=storeys.map(level=>2*(b.damping/100)*Math.sqrt(level.massKg*level.stiffnessNPerM));
  const braces=Array(n).fill(0) as number[],wallSprings=Array(n).fill(0) as number[];
  if(d.brace){
    const first=floor(d.braceFirst,'First braced storey'),last=integer(d.braceLast,'Last braced storey',first,n);
    const bays=integer(d.braceBays,'Braced bays',1,b.baysX);
    const pair=['X','V','Inverted V'].includes(d.braceKind),active=d.braceKind==='K · illustration'?0:pair&&!d.tensionOnly?2:1;
    const span=b.width/b.baysX/(d.braceKind==='V'||d.braceKind==='Inverted V'?2:1);
    for(let i=first-1;i<last;i++){
      braces[i]=active*bays*axialBrace(d.braceE,d.braceArea,span,storeys[i].heightM).k;
      storeys[i].stiffnessNPerM+=braces[i];
    }
  }
  if(d.wall){
    const first=floor(d.wallFirst,'First wall storey'),last=integer(d.wallLast,'Last wall storey',first,n);
    if(d.wallLength>b.width)throw Error('Wall length exceeds the building width.');
    const levels=storeys.slice(first-1,last);
    const height=levels.reduce((sum,level)=>sum+level.heightM,0);
    const systemK=equivalentWall(d.wallE,d.wallLength,d.wallThickness,height,d.wallFactor);
    // Match the equivalent cantilever's overall top-load compliance with shear springs in series.
    for(let i=first-1;i<last;i++){
      wallSprings[i]=systemK*height/storeys[i].heightM;
      storeys[i].stiffnessNPerM+=wallSprings[i];
    }
  }
  const total=storeys.reduce((sum,level)=>sum+level.massKg,0);
  const links:Dashpot[]=structural.map((c,i)=>({from:i+offset-1,to:i+offset,c,axialC:c,cosine:1,count:1,kind:'Structural'}));
  structural.forEach((c,i)=>{storeys[i].damperNsPerM=c;});
  let foundation:Model['foundation']={kind:'fixed'};
  let bearingPeriod:number|null=null;
  if(d.isolation){
    const massKg=finite(d.baseMass,'Base mass',100,1e7),period=finite(d.period,'Isolation target period',.2,12);
    const attachedMass=d.tmd?finite(d.tmdMass,'Tuned mass',1,1e7):0;
    const moving=massKg+total+attachedMass;
    finite(d.bearingK,'Direct bearing stiffness',0,1e12);finite(d.bearingC,'Direct bearing damping',0,1e12);
    const k=d.bearingK||moving*(2*Math.PI/period)**2;
    const ratio=finite(d.bearingRatio,'Bearing damping ratio',0,1);
    const c=d.bearingC||2*ratio*Math.sqrt(k*moving);
    finite(d.capacity,'Reference bearing stroke',.001,10);
    foundation={kind:'isolation',bearing:{massKg,heightM:.45,stiffnessNPerM:k,damperNsPerM:c}};
    bearingPeriod=2*Math.PI*Math.sqrt(moving/k);
    links.push({from:-1,to:0,c,axialC:c,cosine:1,count:1,kind:'Isolation'});
  }
  if(d.viscous){
    const i=floor(d.viscousStorey,'Viscous damper storey')-1;
    const count=integer(d.viscousCount,'Viscous device count',1,20);
    const axialC=finite(d.viscousC,'Viscous coefficient',0,1e12);
    const cosine=Math.cos(finite(d.viscousAngle,'Viscous device angle',0,90)*Math.PI/180);
    const c=count*axialC*cosine**2;
    storeys[i].damperNsPerM+=c;
    links.push({from:i+offset-1,to:i+offset,c,axialC,cosine,count,kind:'Viscous'});
  }
  const model:Model={storeys,foundation,damping:{kind:'none'}};
  if(d.tmd){
    const i=floor(d.tmdFloor,'Tuned damper floor')-1;
    const {k,c}=tunedDevice(d.tmdMass,d.tmdHz,d.tmdRatio);
    model.attachment={floor:i,massKg:d.tmdMass,stiffnessNPerM:k,damperNsPerM:c};
    links.push({from:i+offset,to:n+offset,c,axialC:c,cosine:1,count:1,kind:'Tuned mass'});
  }
  return {model,links,total,bearingPeriod,braces,wallSprings,offset};
}
