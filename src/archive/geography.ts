import type {FeatureCollection,MultiPolygon,Polygon,Position} from 'geojson';
export type Bounds=FeatureCollection<Polygon|MultiPolygon,{name:string;province:string}>;
function ringContains(ring:Position[],x:number,y:number){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [a,b]=ring[i],[c,d]=ring[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}
export function districtAt(shapes:Bounds|null,lon:number|null,lat:number|null){
  if(!shapes||lon===null||lat===null)return;
  return shapes.features.find(feature=>{
    const geometry=feature.geometry;
    const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
    return polygons.some(([outer,...holes])=>ringContains(outer,lon,lat)&&!holes.some(hole=>ringContains(hole,lon,lat)));
  })?.properties;
}
export const nepalBounds:[[number,number],[number,number]]=[[26.28,80.02],[30.48,88.24]];
export const cities=[['Kathmandu',27.7172,85.324],['Pokhara',28.2096,83.9856],['Biratnagar',26.4525,87.2718],['Janakpur',26.7288,85.9263],['Birgunj',27.0104,84.8774],['Nepalgunj',28.05,81.6167],['Dhangadhi',28.7014,80.5715],['Birendranagar',28.601,81.633],['Lumbini',27.48,83.28]] as const;
export function localKilometres(lon:number,lat:number):[number,number]{
  return [(lon-84.1)*111.195*Math.cos(28.4*Math.PI/180),(28.4-lat)*111.195];
}
