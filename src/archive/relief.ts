import {BufferGeometry, Color, Float32BufferAttribute} from 'three';
import {localKilometres} from './geography';

export type ElevationGrid={w:number;h:number;west:number;south:number;step:number;elevations:number[]};
export type ReliefStyle='Relief'|'Elevation'|'Boundaries'|'Geology';
export const elevationBands=[
  [0,'#557a48'],[400,'#7c944e'],[1400,'#4a704d'],
  [3000,'#85796b'],[4600,'#958991'],[5600,'#e2eff8'],[7500,'#f7fbfc'],
] as const;
export const scientificBands=[[0,'#203b66'],[1400,'#2c968f'],[3000,'#a5bc66'],[4600,'#d48e52'],[7500,'#f6e8e2']] as const;

export function parseElevation(value:unknown):ElevationGrid {
  const grid=value as Partial<ElevationGrid>|null;
  if(!grid||!Number.isInteger(grid.w)||!Number.isInteger(grid.h)||grid.w!<2||grid.h!<2||
    grid.w!*grid.h!>200000||!Number.isFinite(grid.west)||!Number.isFinite(grid.south)||
    !Number.isFinite(grid.step)||grid.step!<=0||!Array.isArray(grid.elevations)||
    grid.elevations.length!==grid.w!*grid.h!||grid.elevations.some(e=>!Number.isFinite(e)||e< -500||e>9500)){
    throw Error('The elevation grid is invalid.');
  }
  return grid as ElevationGrid;
}

export function heightAt(grid:ElevationGrid,lon:number,lat:number) {
  const x=Math.max(0,Math.min(grid.w-1,(lon-grid.west)/grid.step));
  const y=Math.max(0,Math.min(grid.h-1,(lat-grid.south)/grid.step));
  const i=Math.min(grid.w-2,Math.floor(x)),j=Math.min(grid.h-2,Math.floor(y));
  const f=x-i,g=y-j;
  const a=grid.elevations[j*grid.w+i]*(1-f)+grid.elevations[j*grid.w+i+1]*f;
  const b=grid.elevations[(j+1)*grid.w+i]*(1-f)+grid.elevations[(j+1)*grid.w+i+1]*f;
  return (a+(b-a)*g)/1000;
}

export function buildRelief(grid:ElevationGrid,style:ReliefStyle){
  const positions=new Float32Array(grid.w*grid.h*3),colors=new Float32Array(positions.length);
  const indices:number[]=[];
  const bands=(style==='Elevation'?scientificBands:elevationBands).map(([level,hex])=>({level,color:new Color(hex)}));
  const color=new Color(),neutral=new Color('#546878');
  for(let j=0;j<grid.h;j++)for(let i=0;i<grid.w;i++){
    const k=j*grid.w+i,elev=grid.elevations[k];
    const [x,z]=localKilometres(grid.west+i*grid.step,grid.south+j*grid.step);
    positions.set([x,elev/1000,z],3*k);
    if(style==='Boundaries'||style==='Geology')color.copy(neutral);
    else{
      const next=bands.findIndex(band=>band.level>elev);
      if(next<=0)color.copy(bands[next===0?0:bands.length-1].color);
      else{
        const a=bands[next-1],b=bands[next];
        color.copy(a.color).lerp(b.color,(elev-a.level)/(b.level-a.level));
      }
    }
    color.toArray(colors,3*k);
    if(i&&j){const a=k-grid.w-1,b=k-grid.w,c=k-1;indices.push(a,b,c,b,k,c);}
  }
  const mesh=new BufferGeometry();
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3));
  mesh.setAttribute('color',new Float32BufferAttribute(colors,3));
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

export function overviewDistance(aspect:number){
  return Math.max(790,510/(Math.max(.3,aspect)*Math.tan(47*Math.PI/360)));
}
