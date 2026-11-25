export type ColourMode='Depth'|'Magnitude';
export const markerBands={
  Depth:[[15,'#81e1f1','≤15 km'],[35,'#abafff','15–35 km'],[Infinity,'#f290bb','>35 km']],
  Magnitude:[[6,'#81e1f1','<6'],[7,'#abafff','6–<7'],[Infinity,'#f290bb','≥7']],
} as const;
export function markerRadius(magnitude:number|null){return magnitude===null?4:Math.max(4,Math.min(13,3+(magnitude-3)*1.6));}
export function markerColour(mode:ColourMode,value:number|null){
  if(value===null)return '#9baeb8';
  return markerBands[mode].find(([limit])=>mode==='Depth'?value<=limit:value<limit)?.[1]??markerBands[mode][2][1];
}
export function mergeEvents<T extends {id:string}>(...groups:T[][]){
  return [...new Map(groups.flat().map(item=>[item.id,item])).values()];
}
export function originDistance(lat:number,lon:number,targetLat:number,targetLon:number){
  const radians=Math.PI/180,deltaLat=(targetLat-lat)*radians,deltaLon=(targetLon-lon)*radians;
  const a=Math.sin(deltaLat/2)**2+Math.cos(lat*radians)*Math.cos(targetLat*radians)*Math.sin(deltaLon/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,a)));
}
export function secondsBetween(first:string,second:string){
  return (Date.parse(first)-Date.parse(second))/1000;
}
export function advanceIllustration(time:number,elapsed:number,speed:number,duration:number){
  return Math.min(duration,Math.max(0,time+elapsed*speed));
}
