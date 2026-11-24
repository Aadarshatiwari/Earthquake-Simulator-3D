import type {Model,Storey} from '../engine';

export const materials=['Concrete','Brick','Stone','Steel','Timber','Glass','Plaster','Tile','Asphalt','Soil','Gravel'] as const;
export type Surface=typeof materials[number];
export const presets=['Himalayan stone','Newari brick','Concrete residence','Soft storey','Modern apartment','Cross-braced frame','Shear-wall frame','Base-isolated frame'] as const;
export type Preset=typeof presets[number];
export type Level={heightM:number;massKg:number;stiffnessNPerM:number};
export type Config={
  preset:Preset; width:number; length:number; baysX:number; baysZ:number;
  columnWidth:number; columnDepth:number; beamWidth:number; beamDepth:number; slab:number; wall:number; footing:number; overhang:number;
  roof:'Flat'|'Gable'; finish:Surface; balconies:boolean; stairs:boolean; openGround:boolean; glazing:number; entryBay:number; windows:'All sides'|'Front and rear'|'Front only';
  reinforcement:'None'|'Bracing'|'Shear walls'; reinforcementBay:number; damping:number; isolation:boolean; bearingMass:number; bearingStiffness:number; levels:Level[];
};
export type Project={version:1;id:string;name:string;config:Config};
const clone=<T>(object:T):T=>structuredClone(object);
export function presetConfig(preset:Preset):Config{
  const masonry=preset==='Himalayan stone'||preset==='Newari brick';
  const modern=preset==='Modern apartment', stone=preset==='Himalayan stone';
  const n=stone?2:preset==='Newari brick'?3:modern?8:5;
  const openGround=preset==='Soft storey';
  return {
    preset,width:stone?8:modern?17:11,length:masonry?7:modern?13:9,baysX:modern?3:2,baysZ:2,
    columnWidth:masonry?.32:.48,columnDepth:masonry?.32:.48,beamWidth:masonry?.26:.38,beamDepth:masonry?.27:.46,
    slab:masonry?.17:.23,wall:masonry?.28:.19,footing:.48,overhang:.65,
    roof:masonry?'Gable':'Flat',finish:stone?'Stone':masonry?'Brick':modern?'Plaster':'Brick',
    balconies:!masonry,stairs:!masonry,openGround,glazing:stone?.35:masonry?.52:modern?.80:.67,
    entryBay:1,windows:'All sides',
    reinforcement:preset==='Cross-braced frame'?'Bracing':preset==='Shear-wall frame'?'Shear walls':'None',
    reinforcementBay:1,damping:5,isolation:preset==='Base-isolated frame',bearingMass:85000,bearingStiffness:3.5e6,
    levels:Array.from({length:n},(_,i)=>({heightM:masonry?2.75:3.2,massKg:modern?145000:masonry?62000:85000,
      stiffnessNPerM:openGround&&i===0?22e6:modern?135e6:masonry?32e6:preset==='Cross-braced frame'||preset==='Shear-wall frame'?115e6:75e6})),
  };
}
export const numberLimits={
  width:[4,35],length:[4,35],baysX:[1,5],baysZ:[1,5],columnWidth:[.18,1.2],columnDepth:[.18,1.2],
  beamWidth:[.12,1],beamDepth:[.18,1],slab:[.10,.60],wall:[.10,.60],footing:[.2,1.5],
  overhang:[.25,1.5],glazing:[.2,.86],entryBay:[1,5],reinforcementBay:[1,5],damping:[0,30],bearingMass:[1000,1e7],bearingStiffness:[1e4,1e10],
} as const;
const inRange=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateConfig(value:unknown):asserts value is Config{
  if(!isObject(value))throw Error('Missing building configuration.');
  for(const [key,[min,max]] of Object.entries(numberLimits)){
    if(!inRange(value[key],min,max))throw Error(key+' must be between '+min+' and '+max+'.');
  }
  for(const key of ['baysX','baysZ','entryBay','reinforcementBay'] as const)if(!Number.isInteger(value[key]))throw Error(key+' must be an integer.');
  for(const key of ['balconies','stairs','openGround','isolation'])if(typeof value[key]!=='boolean')throw Error('Invalid '+key+'.');
  for(const [key,options] of Object.entries({preset:presets,finish:materials,roof:['Flat','Gable'],windows:['All sides','Front and rear','Front only'],reinforcement:['None','Bracing','Shear walls']})){
    if(!options.includes(value[key] as never))throw Error('Invalid '+key+'.');
  }
  const c=value as unknown as Config;
  if(c.entryBay>c.baysX||c.reinforcementBay>c.baysX)throw Error('Entry and reinforcement need an existing bay.');
  if(c.width/c.baysX<Math.max(1.8,c.columnWidth+.9)||c.length/c.baysZ<Math.max(1.8,c.columnDepth+.9))throw Error('Increase the plan or reduce the bay count to leave clear space between columns.');
  if(c.beamWidth>Math.min(c.columnWidth,c.columnDepth))throw Error('Beam width must fit the supporting columns.');
  if(!Array.isArray(c.levels)||c.levels.length<1||c.levels.length>20)throw Error('Use 1–20 storeys.');
  for(const [i,l] of c.levels.entries()){
    if(!isObject(l)||!inRange(l.heightM,2.3,6)||!inRange(l.massKg,1000,1e7)||!inRange(l.stiffnessNPerM,1e4,1e10))throw Error('Invalid height, mass or stiffness at storey '+(i+1)+'.');
    if(l.heightM-Math.max(c.slab,c.beamDepth)<1.95)throw Error('Storey '+(i+1)+' needs at least 1.95 m below the beam.');
  }
}
export function toModel(c:Config):Model{
  validateConfig(c);
  const storeys:Storey[]=c.levels.map(l=>({...l}));
  const ratio=c.damping/100,n=storeys.length+Number(c.isolation);
  return {storeys,damping:n===1?{kind:'viscous',ratio}:{kind:'rayleigh',first:{mode:0,ratio},second:{mode:Math.min(2,n-1),ratio}},
    foundation:c.isolation?{kind:'isolation',bearing:{massKg:c.bearingMass,stiffnessNPerM:c.bearingStiffness,heightM:.45}}:{kind:'fixed'}};
}
export function resize(c:Config,length:number):Config{
  if(!Number.isInteger(length)||length<1||length>20)throw Error('Use 1–20 storeys.');
  return {...c,levels:Array.from({length},(_,i)=>({...c.levels[Math.min(i,c.levels.length-1)]}))};
}
export function readProject(raw:string):Project{
  if(raw.length>200000)throw Error('Project exceeds 200 KB.');
  const value:unknown=JSON.parse(raw);
  if(!isObject(value)||value.version!==1||typeof value.name!=='string'||!value.name.trim()||value.name.length>70||typeof value.id!=='string'||!(/^[a-zA-Z0-9-]{1,70}$/).test(value.id))throw Error('Expected a named SeismoNepal version 1 project.');
  validateConfig(value.config);
  return {version:1,id:value.id,name:value.name.trim(),config:clone(value.config)};
}
export function writeProject(p:Project){return JSON.stringify(p,null,2);}
export function readLibrary(raw:string):Project[]{
  const items:unknown=JSON.parse(raw);
  if(!Array.isArray(items)||items.length>40)throw Error('Invalid local project library.');
  return items.map(item=>readProject(JSON.stringify(item)));
}
export type History={past:Project[];current:Project;future:Project[]};
export function editHistory(h:History,current:Project):History{
  if(JSON.stringify(h.current)===JSON.stringify(current))return h;
  return {past:[...h.past.slice(-39),h.current],current,future:[]};
}
export function moveHistory(h:History,direction:'undo'|'redo'):History{
  if(direction==='undo')return h.past.length?{past:h.past.slice(0,-1),current:h.past.at(-1)!,future:[h.current,...h.future]}:h;
  return h.future.length?{past:[...h.past,h.current],current:h.future[0],future:h.future.slice(1)}:h;
}
