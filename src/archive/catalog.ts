export type Event={id:string;name:string;place:string;year:number;date:string|null;dateText?:string;mag:number|null;magType:string|null;lat:number|null;lon:number|null;depth:number|null;intensity:number|null;source:string;url:string;kind:'Mainshock'|'Aftershock'|'Unclassified';note?:string;featured?:boolean};
export type RecordingMeta={id:string;event:string;station:string;latitude:number;longitude:number;elevation:number;hz:number;start:string;duration:number;asset:string;sha256:string;samples:number;path:string};
export type RegionalCatalog={features:{id:string;geometry:{coordinates:number[]};properties:{place:string;mag:number;magType:string;time:number;mmi?:number}}[]};
const usgs='https://earthquake.usgs.gov/earthquakes/eventpage/';
const paper='https://doi.org/10.1038/s41597-022-01634-6';
const archive='https://cires1.colorado.edu/~bilham/1833_Nepal.htm';
const named:Record<string,{name:string;kind:Event['kind'];note?:string}>={
  iscgem904745:{name:'Bihar–Nepal earthquake',kind:'Mainshock',note:'The ISC-GEM origin is a historical reconstruction. Published studies report alternative magnitudes and locations.'},
  usp0003k6t:{name:'Udayapur earthquake',kind:'Mainshock'},
  usp000j88b:{name:'Sikkim–Nepal border earthquake',kind:'Mainshock'},
  us20002926:{name:'Gorkha earthquake',kind:'Mainshock',note:'The mainshock has official ShakeMap contours here. The bundled Kathmandu Valley dataset covers aftershocks.'},
  us2000292y:{name:'Gorkha sequence · 25 April aftershock',kind:'Aftershock',note:'The published Kathmandu Valley array files are linked by the UTC origin minute.'},
  us200029bt:{name:'Gorkha sequence · 26 April aftershock',kind:'Aftershock',note:'This aftershock was recorded by the permanent Kathmandu Valley stations.'},
  us20002ejl:{name:'Dolakha earthquake',kind:'Aftershock',note:'ComCat origin and magnitude appear here. The recording paper reports the same event at 07:05:20 UTC after rounding.'},
  us7000incn:{name:'Doti earthquake',kind:'Unclassified',note:'8 November in UTC, 9 November in Nepal.'},
  us7000l8p5:{name:'Jajarkot earthquake',kind:'Unclassified',note:'ComCat magnitude and Nepal’s local-magnitude reports come from different measurement scales.'},
};
export const specialEvents:Event[]=[
  {id:'h1255',name:'1255 Nepal earthquake',place:'Central Nepal · historical accounts',year:1255,date:null,dateText:'7 June 1255 (historical date)',mag:null,magType:null,lat:null,lon:null,depth:null,intensity:null,source:'Sapkota et al. (historical study)',url:'https://doi.org/10.1002/2014JB010970',kind:'Unclassified',note:'Historical date only. No instrumental origin is assigned.',featured:true},
  {id:'h1833',name:'1833 Nepal earthquake',place:'Nepal · historical reconstruction',year:1833,date:null,dateText:'26 August 1833 (historical date)',mag:null,magType:null,lat:null,lon:null,depth:null,intensity:null,source:'Bilham (1995)',url:archive,kind:'Unclassified',note:'Published reconstructions depend on interpretations of reported damage. Instrumental coordinates and a precise UTC origin are unavailable here.',featured:true},
];
type Row=[string,string|null,number,number|null,string|null,number,number,number,number|null];
export function parseCatalog(data:unknown):Event[]{
  if(!Array.isArray(data))throw Error('Invalid catalogue file.');
  return data.flatMap((raw):Event[]=>{
    if(!Array.isArray(raw))return [];
    const [id,place,ms,mag,magType,lon,lat,depth,intensity]=raw as Row;
    if(typeof id!=='string'||!Number.isFinite(ms)||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90||Math.abs(lon)>180)return [];
    const date=new Date(ms);if(!Number.isFinite(date.getTime()))return [];
    const entry=named[id];
    const knownPlace=typeof place==='string'?place:'Location unavailable';
    return [{id,name:entry?.name??knownPlace,place:knownPlace,year:date.getUTCFullYear(),date:date.toISOString(),
      mag:Number.isFinite(mag)?mag:null,magType:typeof magType==='string'?magType:null,lon,lat,depth:Number.isFinite(depth)?depth:null,
      intensity:Number.isFinite(intensity)?intensity:null,source:id.startsWith('iscgem')?'ISC-GEM via USGS':'USGS ComCat',url:usgs+encodeURIComponent(id),
      kind:entry?.kind??'Unclassified',note:entry?.note,featured:!!entry}];
  });
}
export function parseRecent(data:RegionalCatalog){
  if(!Array.isArray(data.features))throw Error('Invalid regional catalogue.');
  return parseCatalog(data.features.map(f=>[f.id,f.properties?.place,f.properties?.time,f.properties?.mag,f.properties?.magType,
    f.geometry?.coordinates?.[0],f.geometry?.coordinates?.[1],f.geometry?.coordinates?.[2],f.properties?.mmi]));
}
export function formatTime(event:Event,zone:'UTC'|'Asia/Kathmandu'){
  return event.date?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:zone}).format(new Date(event.date)):event.dateText??'Unavailable';
}
export type Filters={query:string;since:string;until:string;minimum:string;maximum:string;depth:string;province:string;district:string;source:string;recorded:boolean};
export const initialFilters:Filters={query:'',since:'',until:'',minimum:'',maximum:'',depth:'',province:'',district:'',source:'',recorded:false};
export function filterEvents(events:Event[],f:Filters,recorded:Set<string>,region:(item:Event)=>{province:string;name:string}|undefined){
  const query=f.query.trim().toLowerCase();
  return events.filter(e=>{
    if(query&&![e.name,e.place,e.id,String(e.year)].some(v=>v.toLowerCase().includes(query)))return false;
    if(f.since&&e.year<Number(f.since)||f.until&&e.year>Number(f.until))return false;
    if(f.minimum&&(e.mag===null||e.mag<Number(f.minimum))||f.maximum&&(e.mag===null||e.mag>Number(f.maximum)))return false;
    if(f.depth&&(e.depth===null||e.depth>Number(f.depth))||f.source&&e.source!==f.source||f.recorded&&!recorded.has(e.id))return false;
    if(f.province||f.district){const match=region(e);if(f.province&&match?.province!==f.province||f.district&&match?.name!==f.district)return false;}
    return true;
  });
}
export const archiveAsset=(path:string)=>import.meta.env.BASE_URL+'archive/'+path;
export const sources={paper,figshare:'https://doi.org/10.6084/m9.figshare.19809052',comcat:'https://earthquake.usgs.gov/fdsnws/event/1/',boundaries:'https://localboundries.oknp.org/',nepal:'https://seismonepal.gov.np/',dmg:'https://www.dmgnepal.gov.np/',cesmd:'https://www.strongmotioncenter.org/',isc:'https://www.isc.ac.uk/iscgem/'};
