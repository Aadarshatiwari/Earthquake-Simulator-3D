import {Component,useEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Html,Line,OrbitControls,PerspectiveCamera} from '@react-three/drei';
import {Vector3} from 'three';
import type {OrbitControls as Controls} from 'three-stdlib';
import {archiveAsset,type Event,type RecordingMeta} from './catalog';
import {cities,localKilometres,type Bounds} from './geography';
import {buildRelief,elevationBands,scientificBands,heightAt,overviewDistance,parseElevation,type ElevationGrid,type ReliefStyle} from './relief';

type Point=[number,number,number];
type Contour={properties:{color:string;value:number;units:string};geometry:{type:'LineString'|'MultiLineString';coordinates:number[][]|number[][][]}};
type Props={event:Event|null;provinces:Bounds|null;districts:Bounds|null;stations:RecordingMeta[];section:boolean;focus:boolean;fit:number;shake:string|null;opacity:number;onFallback:()=>void};

class TerrainBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function Camera({point,section,focus,fit,top,compass}:{compass:RefObject<HTMLSpanElement|null>;point:Point|null;section:boolean;focus:boolean;fit:number;top:boolean}){
  const controls=useRef<Controls>(null);
  const {camera,size,invalidate}=useThree();
  const destination=useRef<{position:Vector3;target:Vector3}|null>(null);
  const first=useRef(true);
  useEffect(()=>{
    if(!controls.current)return;
    const target=new Vector3(...(focus&&point?point:[0,0,0]));
    if(section)target.y-=24;
    const distance=focus&&point?(section?132:125):overviewDistance(size.width/Math.max(1,size.height));
    const offset=top?new Vector3(0,distance,.01):new Vector3(section?.13:.22,section?.24:.67,1).normalize().multiplyScalar(distance);
    const next={position:target.clone().add(offset),target};
    if(first.current||matchMedia('(prefers-reduced-motion: reduce)').matches){
      camera.position.copy(next.position);controls.current.target.copy(target);controls.current.update();
    }else destination.current=next;
    first.current=false;
    invalidate();
  },[camera,fit,focus,invalidate,point,section,size.height,size.width,top]);
  useFrame((_,delta)=>{
    const next=destination.current,control=controls.current;
    if(compass.current&&control){
      const angle=Math.atan2(camera.position.x-control.target.x,camera.position.z-control.target.z);
      compass.current.style.transform='rotate('+(-angle)+'rad)';
    }
    if(!next||!control)return;
    const blend=1-Math.exp(-7*delta);
    camera.position.lerp(next.position,blend);
    control.target.lerp(next.target,blend);
    if(camera.position.distanceTo(next.position)<.1){
      camera.position.copy(next.position);control.target.copy(next.target);destination.current=null;
    }
    control.update();invalidate();
  });
  return <OrbitControls ref={controls} makeDefault minDistance={18} maxDistance={2500} maxPolarAngle={section?Math.PI*.58:Math.PI*.475}
    onStart={()=>{destination.current=null;}}/>;
}

function RenderLifecycle({onReady,onLost,onRestored,drawn}:{drawn:RefObject<boolean>;onReady:()=>void;onLost:()=>void;onRestored:()=>void}){
  const {gl,invalidate}=useThree();
  const frame=useRef(0),reported=useRef(false);
  useFrame(({gl,scene,camera})=>{
    gl.render(scene,camera);
    if(!reported.current&&drawn.current&&!gl.getContext().isContextLost()){
      reported.current=true;
      frame.current=requestAnimationFrame(()=>{performance.mark('nepal-terrain-first-frame');onReady();});
    }
  },1);
  useEffect(()=>{
    const canvas=gl.domElement;
    const lost=(e:EventInit&{preventDefault:()=>void})=>{e.preventDefault();cancelAnimationFrame(frame.current);reported.current=false;onLost();};
    const restored=()=>{onRestored();invalidate();};
    canvas.addEventListener('webglcontextlost',lost);
    canvas.addEventListener('webglcontextrestored',restored);
    return ()=>{cancelAnimationFrame(frame.current);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);};
  },[gl,invalidate,onLost,onRestored]);
  return null;
}

function Profile({grid,event}:{grid:ElevationGrid;event:Event}){
  if(event.lat===null||event.lon===null||event.depth===null||event.depth<0)return null;
  const lon=event.lon,lat=event.lat,depth=event.depth;
  const west=grid.west,east=west+(grid.w-1)*grid.step;
  if(lon<west||lon>east||lat<grid.south||lat>grid.south+(grid.h-1)*grid.step)return null;
  const span=Math.min(.65,lon-west,east-lon);
  if(span<=0)return null;
  const surface=heightAt(grid,lon,lat),bottom=surface-depth-4;
  const scale=(v:number)=>22+110*(9-v)/(9-bottom);
  const points=Array.from({length:91},(_,i)=>[25+550*i/90,scale(heightAt(grid,lon+span*(i/45-1),lat))].join(',')).join(' ');
  return <figure className="terrain-profile">
    <figcaption>West–east elevation profile through the epicentre · modelled depth reference</figcaption>
    <svg viewBox="0 0 600 158" role="img" aria-label={'Terrain profile and '+depth+' kilometre focal depth'}>
      <path d={'M25 140 L'+points.replaceAll(' ',' L')+' L575 140 Z'} fill="#315568"/>
      <polyline points={points} fill="none" stroke="#8edddd" strokeWidth="2"/>
      <line x1="300" x2="300" y1={scale(surface)} y2={scale(surface-depth)} stroke="#ff9078" strokeDasharray="4 3"/>
      <circle cx="300" cy={scale(surface)} r="4" fill="#ffd28d"/><circle cx="300" cy={scale(surface-depth)} r="5" fill="#ff9078"/>
      <text x="312" y={scale(surface-depth)+4} fill="#ffd4bc">{depth.toFixed(2)} km</text>
      <text x="25" y="154" fill="#a9c5d4">West</text><text x="272" y="154" fill="#a9c5d4">{(2*span*111.195*Math.cos(lat*Math.PI/180)).toFixed(0)} km</text><text x="544" y="154" fill="#a9c5d4">East</text>
    </svg>
  </figure>;
}

export default function Terrain({event,provinces,districts,stations,section,focus,fit,shake,opacity,onFallback}:Props){
  const [grid,setGrid]=useState<ElevationGrid|null>(null);
  const [phase,setPhase]=useState<'Loading elevation'|'Rendering terrain'|'Terrain rendered'|'Context lost'|'Elevation unavailable'>('Loading elevation');
  const [style,setStyle]=useState<ReliefStyle>('Relief'),[vertical,setVertical]=useState(5),[top,setTop]=useState(false);
  const drawn=useRef(false);
  const compass=useRef<HTMLSpanElement>(null);
  const [slow,setSlow]=useState(false);
  const [rivers,setRivers]=useState<Contour[]>([]);
  const [faults,setFaults]=useState<Contour[]>([]);
  const [faultError,setFaultError]=useState(false);
  const [contours,setContours]=useState<Contour[]>([]);
  const [failedContours,setFailedContours]=useState(false);
  const lifecycle=useMemo(()=>({
    onReady:()=>setPhase('Terrain rendered'),
    onLost:()=>setPhase('Context lost'),
    onRestored:()=>setPhase('Rendering terrain'),
  }),[]);
  useEffect(()=>{setTop(false);},[fit]);
  useEffect(()=>{
    setSlow(false);
    if(phase!=='Rendering terrain')return;
    const timer=setTimeout(()=>setSlow(true),9000);
    return ()=>clearTimeout(timer);
  },[phase]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(archiveAsset('rivers.json'),{signal:controller.signal}).then(r=>r.ok?r.json():null)
      .then(data=>{if(data&&!controller.signal.aborted)setRivers(data.features);}).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    const load=async(name:string)=>{
      const r=await fetch(archiveAsset(name),{signal:controller.signal});
      if(!r.ok)throw Error('Unavailable elevation');
      return parseElevation(await r.json());
    };
    load('relief.json').catch(error=>{if(controller.signal.aborted)throw error;return load('terrain.json');})
      .then(value=>{setGrid(value);setPhase('Rendering terrain');})
      .catch(()=>{if(!controller.signal.aborted)setPhase('Elevation unavailable');});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(style!=='Geology'||faults.length)return;
    const controller=new AbortController();
    fetch(archiveAsset('gem-active-faults.json'),{signal:controller.signal})
      .then(r=>{if(!r.ok)throw Error();return r.json();})
      .then(data=>{if(!controller.signal.aborted){setFaultError(false);setFaults(data.features);}})
      .catch(()=>{if(!controller.signal.aborted)setFaultError(true);});
    return ()=>controller.abort();
  },[style,faults.length]);
  useEffect(()=>{
    setContours([]);setFailedContours(false);
    if(!shake)return;
    const controller=new AbortController();
    fetch(archiveAsset('shakemap/'+shake+'.json'),{signal:controller.signal})
      .then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>setContours(data.features))
      .catch(()=>{if(!controller.signal.aborted)setFailedContours(true);});
    return ()=>controller.abort();
  },[shake]);
  const geometry=useMemo(()=>grid?buildRelief(grid,style):null,[grid,style]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  const lon=event?.lon,lat=event?.lat;
  const point=useMemo<Point|null>(()=>{
    if(!grid||lon==null||lat==null||lon<grid.west||lat<grid.south||lon>grid.west+(grid.w-1)*grid.step||lat>grid.south+(grid.h-1)*grid.step)return null;
    const [x,z]=localKilometres(lon,lat);
    return [x,heightAt(grid,lon,lat)*vertical,z];
  },[grid,lat,lon,vertical]);
  const depth=event?.depth!=null&&event.depth>=0?event.depth:null;
  const outlines=useMemo(()=>{
    const bounds=style==='Boundaries'?districts:provinces;
    return bounds?.features.flatMap(f=>f.geometry.type==='MultiPolygon'?f.geometry.coordinates.map(p=>p[0]):[f.geometry.coordinates[0]])??[];
  },[districts,provinces,style]);
  const lines=useMemo(()=>{
    if(!grid)return [];
    return contours.flatMap(entry=>{
      const paths=entry.geometry.type==='LineString'?[entry.geometry.coordinates as number[][]]:entry.geometry.coordinates as number[][][];
      return paths.flatMap(path=>{
        const clipped:Point[][]=[];
        let segment:Point[]=[];
        for(const [x,y] of path){
          if(x<grid.west||y<grid.south||x>grid.west+(grid.w-1)*grid.step||y>grid.south+(grid.h-1)*grid.step){
            if(segment.length>1)clipped.push(segment);
            segment=[];
          }else{
            const [east,north]=localKilometres(x,y);
            segment.push([east,heightAt(grid,x,y)*vertical+1.3,north]);
          }
        }
        if(segment.length>1)clipped.push(segment);
        return clipped.map(points=>({points,color:entry.properties.color}));
      });
    });
  },[contours,grid,vertical]);
  const fallback=<div className="archive-blank terrain-message" role="status"><span>3D terrain is unavailable on this browser.</span><button onClick={onFallback}>Open the offline 2D map</button></div>;
  return <>
    <div className="archive-map terrain-viewport" aria-label="Interactive 3D Nepal relief">
      {grid&&geometry?<TerrainBoundary fallback={fallback}>
        <Canvas frameloop="demand" dpr={[1,1.35]} fallback={fallback}>
          <color attach="background" args={['#11283a']}/>
          <fog attach="fog" args={['#11283a',650,1700]}/>
          <PerspectiveCamera makeDefault position={[120,450,650]} fov={47} near={.2} far={4000}/>
          <Camera compass={compass} point={point} focus={focus} section={section} fit={fit} top={top}/>
          <hemisphereLight args={['#e8f5ff','#49525e',1.7]}/>
          <directionalLight position={[-360,430,-160]} intensity={2.4}/>
          <mesh geometry={geometry} dispose={null} scale={[1,vertical,1]} onAfterRender={()=>{drawn.current=true;}}>
            <meshStandardMaterial vertexColors roughness={.95} transparent={section} opacity={section?.43:1} depthWrite={!section}/>
          </mesh>
          {outlines.map((ring,i)=><Line key={i} points={ring.map(([x,y])=>{
            const [east,north]=localKilometres(x,y);
            return [east,heightAt(grid,x,y)*vertical+1,north] as Point;
          })} color="#97e9ef" transparent opacity={style==='Boundaries'?.75:.36} lineWidth={1}/>)}
          {style==='Boundaries'&&rivers.map((entry,i)=><Line key={i} points={(entry.geometry.coordinates as number[][]).map(([x,y])=>{
            const [east,north]=localKilometres(x,y);
            return [east,heightAt(grid,x,y)*vertical+.8,north] as Point;
          })} color="#73bee5" transparent opacity={.85} lineWidth={1.15}/>)}
          {style==='Geology'&&faults.map((entry,i)=><Line key={i} points={(entry.geometry.coordinates as number[][]).map(([x,y])=>{
            const [east,north]=localKilometres(x,y);
            return [east,heightAt(grid,x,y)*vertical+1.3,north] as Point;
          })} color="#ffad81" transparent opacity={.94} lineWidth={1.65}/>)}
          {style==='Boundaries'&&cities.map(([name,y,x])=>{
            const [east,north]=localKilometres(x,y);
            return <Html key={name} position={[east,heightAt(grid,x,y)*vertical+2,north]} center style={{pointerEvents:'none'}}><span className="terrain-city">{name}</span></Html>;
          })}
          {lines.map((line,i)=><Line key={i} points={line.points} color={line.color} transparent opacity={opacity} lineWidth={1.8}/>)}
          {stations.map(station=>{
            const [x,z]=localKilometres(station.longitude,station.latitude);
            return <mesh key={station.id} position={[x,heightAt(grid,station.longitude,station.latitude)*vertical+2,z]}>
              <octahedronGeometry args={[focus?1.5:3]}/><meshBasicMaterial color="#85ebfb"/>
            </mesh>;
          })}
          {point&&<>
            <mesh position={[point[0],point[1]+2,point[2]]}><sphereGeometry args={[focus?2.7:5.2,18,12]}/><meshBasicMaterial color="#ffd28d"/></mesh>
            {section&&depth!==null&&<>
              <mesh renderOrder={20} position={[point[0],point[1]-depth*vertical/2,point[2]]}><cylinderGeometry args={[.55,.55,depth*vertical,8]}/><meshBasicMaterial color="#ff9f82" depthTest={false} depthWrite={false} transparent/></mesh>
              <mesh renderOrder={21} position={[point[0],point[1]-depth*vertical,point[2]]}><sphereGeometry args={[4,18,12]}/><meshBasicMaterial color="#ff775f" depthTest={false} depthWrite={false} transparent/></mesh>
            </>}
          </>}
          <RenderLifecycle {...lifecycle} drawn={drawn}/>
        </Canvas>
      </TerrainBoundary>:null}
      {phase!=='Terrain rendered'&&<div className="terrain-loading" role="status">{slow?'A terrain frame has not arrived.':phase}{(phase==='Elevation unavailable'||phase==='Context lost'||slow)&&<button onClick={onFallback}>Open the offline 2D map</button>}</div>}
      {phase==='Terrain rendered'&&<span className="terrain-ready" role="status">Terrain rendered · {grid?.step.toFixed(3)}° grid</span>}
      <span className="terrain-compass" title="Approximate north bearing" aria-label="North compass"><span ref={compass}>↑ N</span></span>
      {event&&<span className="terrain-event">{event.name} · {event.mag===null?'Magnitude unavailable':'M '+event.mag.toFixed(1)}{depth===null?'':' · '+depth.toFixed(2)+' km deep'}</span>}
    </div>
    <div className="archive-toolbar">
      <label>Terrain layer<select value={style} onChange={e=>setStyle(e.target.value as ReliefStyle)}><option>Relief</option><option>Elevation</option><option>Boundaries</option><option>Geology</option></select></label>
      <button aria-pressed={top} onClick={()=>setTop(v=>!v)}>{top?'Perspective view':'Top-down view'}</button>
      <label>Vertical scale {vertical}×<input aria-label="Terrain vertical scale" type="range" min="1" max="8" value={vertical} onChange={e=>setVertical(+e.target.value)}/></label>
    </div>
    <p className="archive-note archive-inset">{section&&'Amber marks the epicentre and coral marks the hypocentre below the modelled surface. '}{style==='Relief'?'Illustrative surface colours from elevation. Snow tint begins at 4,600 m.':style==='Elevation'?'Elevation gradient from low blue to high cream.':style==='Geology'?(faultError?'Fault traces are unavailable.':faults.length?'Orange lines are mapped regional active-fault traces. They show surface locations only.':'Loading regional active faults…'):'District outlines and regional rivers are generalized. City markers show reference locations.'} {failedContours&&'ShakeMap contours could not be loaded.'}</p>
    {style!=='Boundaries'&&style!=='Geology'&&<div className="terrain-swatches">{(style==='Elevation'?scientificBands:elevationBands).map(([m,color])=><span key={m}><i style={{background:color}}/>{m.toLocaleString('en')} m</span>)}</div>}
    <p className="archive-note archive-inset"><a href="https://registry.opendata.aws/terrain-tiles/">Mapzen Terrain Tiles</a> · SRTM elevation courtesy of USGS{style==='Boundaries'&&<> · <a href="https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/">Natural Earth rivers</a></>}{style==='Geology'&&<> · <a href="https://www.globalquakemodel.org/product/active-faults-database">GEM Global Active Faults Database</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></>}</p>
    {grid&&section&&event&&<Profile grid={grid} event={event}/>}
  </>;
}
