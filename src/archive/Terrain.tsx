import {useEffect,useMemo,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls,PerspectiveCamera} from '@react-three/drei';
import {BufferGeometry,Float32BufferAttribute,Color,DoubleSide} from 'three';
import {archiveAsset,type Event} from './catalog';
import {localKilometres,type Bounds} from './geography';
type DEM={w:number;h:number;west:number;south:number;step:number;elevations:number[]};
const vertical=3;
function heightAt(dem:DEM,lon:number,lat:number){
  const x=Math.max(0,Math.min(dem.w-1.0001,(lon-dem.west)/dem.step)),y=Math.max(0,Math.min(dem.h-1.0001,(lat-dem.south)/dem.step));
  const i=Math.floor(x),j=Math.floor(y),f=x-i,g=y-j;
  const a=dem.elevations[j*dem.w+i]*(1-f)+dem.elevations[j*dem.w+i+1]*f;
  const b=dem.elevations[(j+1)*dem.w+i]*(1-f)+dem.elevations[(j+1)*dem.w+i+1]*f;
  return vertical*(a+(b-a)*g)/1000;
}
export default function Terrain({event,provinces,section,focus,fit}:{event:Event|null;provinces:Bounds|null;section:boolean;focus:boolean;fit:number}){
  const [dem,setDem]=useState<DEM|null>(null),[error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(archiveAsset('terrain.json'),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setDem).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[]);
  const geometry=useMemo(()=>{
    if(!dem)return;
    const positions:number[]=[],colors:number[]=[],indices:number[]=[];
    const low=new Color('#345858'),high=new Color('#d9ebed');
    for(let j=0;j<dem.h;j++)for(let i=0;i<dem.w;i++){
      const index=j*dem.w+i,elev=dem.elevations[index];
      const [x,z]=localKilometres(dem.west+i*dem.step,dem.south+j*dem.step);
      positions.push(x,elev*vertical/1000,z);
      const c=low.clone().lerp(high,Math.max(0,Math.min(1,elev/6500)));
      colors.push(c.r,c.g,c.b);
      if(j&&i)indices.push(index,index-1,index-dem.w,index-1,index-dem.w-1,index-dem.w);
    }
    const mesh=new BufferGeometry();
    mesh.setAttribute('position',new Float32BufferAttribute(positions,3));mesh.setAttribute('color',new Float32BufferAttribute(colors,3));
    mesh.setIndex(indices);mesh.computeVertexNormals();return mesh;
  },[dem]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  if(!geometry||!dem)return <div className="archive-blank">{error?'Terrain data is unavailable. Return to the offline map.':'Loading elevation grid…'}</div>;
  const point=event?.lon!=null&&event?.lat!=null?localKilometres(event.lon,event.lat):null;
  const y=point&&event?.lon!=null&&event.lat!=null?heightAt(dem,event.lon,event.lat):0;
  const depth=event?.depth!=null&&event.depth>=0?event.depth*vertical:null;
  const target:[number,number,number]=point&&(focus||section)?[point[0],section?-13:0,point[1]]:[0,0,0];
  const position:[number,number,number]=section?[target[0]+67,target[1]+24,target[2]+180]:focus?[target[0]+95,125,target[2]+180]:[240,530,730];
  const borders=provinces?.features.flatMap(f=>f.geometry.type==='MultiPolygon'?f.geometry.coordinates.map(p=>p[0]):[f.geometry.coordinates[0]])??[];
  return <div className="archive-map">
    <Canvas frameloop="demand" dpr={[1,1.5]} fallback={<div className="archive-blank">3D needs WebGL. The offline map is available.</div>}>
      <color attach="background" args={['#0c2131']}/>
      <PerspectiveCamera key={'camera-'+fit+'-'+section+'-'+focus+'-'+event?.id} makeDefault position={position} fov={47} near={.5} far={2400}/>
      <OrbitControls key={'orbit-'+fit+'-'+section+'-'+focus+'-'+event?.id} target={target} minDistance={25} maxDistance={1600} maxPolarAngle={Math.PI*.65}/>
      <hemisphereLight args={['#e3f2ff','#344d4b',1.9]}/><directionalLight position={[120,300,-280]} intensity={2}/>
      <mesh geometry={geometry} dispose={null}><meshStandardMaterial vertexColors side={DoubleSide} transparent={section} opacity={section?.30:1}/></mesh>
      {borders.map((ring,i)=><lineLoop key={i}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(ring.flatMap(([lon,lat])=>{const [x,z]=localKilometres(lon,lat);return [x,heightAt(dem,lon,lat)+1.4,z];})),3]}/></bufferGeometry>
        <lineBasicMaterial color="#6cd3e0" transparent opacity={.52}/>
      </lineLoop>)}
      {point&&<><mesh position={[point[0],y+2,point[1]]}><sphereGeometry args={[focus?3:6,12,10]}/><meshBasicMaterial color="#ffd197"/></mesh>
      {depth!==null&&<><mesh position={[point[0],y-depth/2,point[1]]}><cylinderGeometry args={[.60,.60,depth,6]}/><meshBasicMaterial color="#f68170"/></mesh><mesh position={[point[0],y-depth,point[1]]}><sphereGeometry args={[focus?4:7,12,10]}/><meshBasicMaterial color="#ff765c"/></mesh></>}</>}
    </Canvas>
  </div>;
}
