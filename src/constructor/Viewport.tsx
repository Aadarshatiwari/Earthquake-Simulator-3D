import {lazy,Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {OrbitControls,OrthographicCamera,PerspectiveCamera,ContactShadows,AdaptiveDpr} from '@react-three/drei';
import {ACESFilmicToneMapping,Color,Mesh,MeshBasicMaterial,DoubleSide,BoxGeometry,ExtrudeGeometry,Shape,Group,InstancedMesh,MeshStandardMaterial,Object3D,Plane,PMREMGenerator,Vector3,type CanvasTexture} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import type {OrbitControls as Controls} from 'three-stdlib';
import type {ConstructorResult} from './analysis';
const Valley=lazy(()=>import('../Valley'));
import type {Mode} from '../engine';
import {materials,type Config,type Surface} from './model';
import {surfaceSpec,makeSurface} from './materials';
import {floorDisplacement,type generate,type Part} from './geometry';

import {qualities,type Options} from './viewOptions';
import {channels,heatMagnitude,heatStops,storeyTransform,type Heat} from '../seismic/controller';
type Comparison={geometry:ReturnType<typeof generate>;config:Config;selected:string|null;result:ConstructorResult|null;mode:Mode|null;onSelect:(part:Part)=>void};
type Props={geometry:ReturnType<typeof generate>;config:Config;options:Options;selected:string|null;onSelect:(part:Part)=>void;fit:number;time:RefObject<number>;mode:Mode|null;result:ConstructorResult|null;playing:boolean;motion:'modal'|'seismic'|null;onLost:(lost:boolean)=>void;onFps:(fps:number)=>void;comparison?:Comparison;heat?:Heat;heatMax?:number;direction?:number;showGround?:boolean;reference?:boolean;waves?:boolean;frameTime?:number;onReady?:()=>void};
const box=new BoxGeometry(1,1,1);
const triangle=new Shape();
triangle.moveTo(-.5,0);triangle.lineTo(.5,0);triangle.lineTo(0,1);triangle.closePath();
const gable=new ExtrudeGeometry(triangle,{depth:1,bevelEnabled:false});
gable.translate(0,0,-.5);
gable.rotateY(Math.PI/2);
function cameraPosition(name:Options['camera'],size:number,height:number):[number,number,number]{
  const k=size*1.85,t=height*.45;
  switch(name){
    case 'Front':return [0,t,k];
    case 'Rear':return [0,t,-k];
    case 'Left':return [-k,t,0];
    case 'Right':return [k,t,0];
    case 'Top':return [0,t+k,.001];
    case 'Foundation':return [size*.65,2,size*.86];
    case 'Isometric':return [k,t+k,k];
    default:return [k*.72,t+k*.39,k];
  }
}
function Rig({options,geometry,fit}:{options:Options;geometry:Props['geometry'];fit:number}){
  const size=useThree(state=>state.size);
  const aspect=size.width/Math.max(1,size.height);
  const controls=useRef<Controls>(null);
  const invalidate=useThree(state=>state.invalidate);
  const transition=useRef<{start:Vector3;end:Vector3;targetStart:Vector3;targetEnd:Vector3;started:number}|null>(null);

  const h=geometry.height+(options.view==='Exploded'?options.gap*geometry.elevations.length:0);
  const extent=Math.max(h,geometry.width,geometry.length);
  const foundation=options.camera==='Foundation', ortho=options.camera!=='Perspective'&&!foundation;
  const focus=foundation?.35:options.view==='Floor isolation'?geometry.elevations[options.floor]+1.3:h*.48;
  const position=cameraPosition(options.camera,extent*Math.max(1,.86/aspect),h);
  const zoom=Math.min(size.width,size.height)/(extent*1.34);
  useLayoutEffect(()=>{
    const control=controls.current;
    if(!control)return;
    transition.current={start:control.object.position.clone(),end:new Vector3(...position),
      targetStart:control.target.clone(),targetEnd:new Vector3(0,focus,0),started:performance.now()};
    invalidate();
  },[options.camera,position[0],position[1],position[2],focus,fit,invalidate]);
  useFrame(()=>{
    const control=controls.current,move=transition.current;
    if(!control||!move)return;
    const reduced=document.documentElement.dataset.reduceInterface==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t=reduced?1:Math.min(1,(performance.now()-move.started)/230),eased=t*t*(3-2*t);
    control.object.position.lerpVectors(move.start,move.end,eased);
    control.target.lerpVectors(move.targetStart,move.targetEnd,eased);
    control.update();
    if(t<1)invalidate();
    else transition.current=null;
  });
  return <>
    {ortho?<OrthographicCamera makeDefault zoom={zoom} near={.05} far={500} position={position}/>:<PerspectiveCamera makeDefault fov={40} near={.08} far={500} position={position}/>}
    <OrbitControls ref={controls} target={[0,focus,0]} onStart={()=>{transition.current=null;}} enableDamping regress minDistance={foundation?Math.max(geometry.width,geometry.length)*.7:extent*.66} maxDistance={extent*5}
      minZoom={zoom*.4} maxZoom={zoom*4} maxPolarAngle={Math.PI*.495} enablePan={true}/>
  </>;
}
function Lighting({enabled}:{enabled:boolean}){
  const {gl,scene}=useThree();
  useEffect(()=>{
    if(!enabled)return;
    const room=new RoomEnvironment();
    const generator=new PMREMGenerator(gl);
    const env=generator.fromScene(room,.08);
    scene.environment=env.texture;
    scene.environmentIntensity=.43;
    room.dispose();
    return ()=>{scene.environment=null;env.dispose();generator.dispose();};
  },[enabled,gl,scene]);
  return null;
}
function Stage({options,level,footing}:{options:Options;level:number;footing:number}){
  const foundation=options.camera==='Foundation';
  const studio=foundation||options.environment==='Architectural studio'||options.environment==='Engineering lab';
  const rural=options.environment==='Himalayan village'||options.environment==='Himalayan foothills';
  const neighborhood=options.environment==='Kathmandu neighbourhood'||options.environment==='Urban Nepal';
  const terai=options.environment==='Terai plains';
  const golden=options.lighting==='Golden hour',overcast=options.lighting==='Overcast',neutral=options.lighting==='Neutral lab';
  const sky=studio||neutral?'#162d40':golden?'#e1a98b':overcast?'#b2c0c5':'#88aabb';
  return <>
    <color attach="background" args={[sky]}/>
    <fog attach="fog" args={[sky,48,230]}/>
    <hemisphereLight args={[overcast?'#e4ebef':'#e3f2ff','#8c867b',overcast?2:.95]}/>
    <directionalLight position={golden?[-42,16,26]:[-24,40,24]} intensity={overcast?.8:golden?3.2:2.65} color={golden?'#ffc993':'#fff1d7'} castShadow={level>0}
      shadow-mapSize={[512*2**(level-1),512*2**(level-1)]} shadow-camera-left={-35} shadow-camera-right={35}
      shadow-camera-top={45} shadow-camera-bottom={-35} shadow-normalBias={.06}/>
    <Lighting enabled={level>=2}/>
    <mesh position={[0,foundation?-footing-.025:-.014,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[360,360]}/><meshStandardMaterial roughness={.95} color={studio?'#26353c':terai?'#687b46':rural?'#697556':'#788074'}/></mesh>
    {studio&&<gridHelper args={[140,70,'#4c717f','#384e58']} position={[0,foundation?-footing-.014:.002,0]}/>}
    {!studio&&options.details&&(neighborhood||rural||terai)&&<>
      {!terai&&<Suspense fallback={null}><Valley/></Suspense>}
      {neighborhood&&<><mesh position={[0,.005,20]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[145,7]}/><meshStandardMaterial color="#474947"/></mesh>
      {Array.from({length:17},(_,i)=><mesh key={i} position={[(i-8)*7,.011,20]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2.4,.08]}/><meshStandardMaterial color="#d3bf95"/></mesh>)}</>}
      {Array.from({length:terai?4:rural?5:level===0?6:12},(_,i)=>{
        const x=(i%6-2.5)*11,z=-30-Math.floor(i/6)*13,y=rural||terai?2.7:options.environment==='Urban Nepal'?5+i%7:3+i%5;
        return <group key={i} position={[x,0,z]}><mesh position={[0,y/2,0]} receiveShadow><boxGeometry args={[5,y,5]}/><meshStandardMaterial color={['#a78063','#b3a482','#97735d'][i%3]}/></mesh>
          <mesh position={[0,y+(rural?.30:.1),0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[3.75,rural?1.4:.4,4]}/><meshStandardMaterial color="#584739"/></mesh>
          {!rural&&Array.from({length:Math.max(1,Math.floor(y/2))},(_,j)=><group key={j} position={[0,1.1+j*1.85,0]}>
            <mesh position={[0,0,2.512]}><planeGeometry args={[3.7,.64]}/><meshStandardMaterial color="#354a50" roughness={.42}/></mesh>
            <mesh position={[2.512,0,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[3.5,.64]}/><meshStandardMaterial color="#354a50" roughness={.42}/></mesh>
          </group>)}</group>;
      })}
    </>}
    {!studio&&options.details&&level>0&&Array.from({length:terai?16:10},(_,i)=>{
      const x=(i%8-3.5)*7.5,z=-19-Math.floor(i/8)*14;
      return <group key={i} position={[x,0,z]}><mesh position={[0,1.1,0]}><cylinderGeometry args={[.1,.16,2.2,5]}/><meshStandardMaterial color="#645039"/></mesh>
        <mesh position={[0,2.5,0]} scale={[1.2,1.55,1.2]}><icosahedronGeometry args={[.9,0]}/><meshStandardMaterial color={i%2?'#53754d':'#456545'} roughness={1}/></mesh></group>;
    })}
    {level===3&&!foundation&&<ContactShadows position={[0,.006,0]} scale={48} opacity={.27} blur={2.1} far={9} frames={1}/>}
  </>;
}
function Batch({parts,origin,material,plane,onSelect}:{parts:Part[];origin:number;material:MeshStandardMaterial;plane:Plane|null;onSelect:(part:Part)=>void}){
  const mesh=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    const instance=mesh.current;
    if(!instance)return;
    const transform=new Object3D();
    parts.forEach((part,i)=>{
      transform.position.set(part.center[0],part.center[1]-origin,part.center[2]);
      transform.rotation.set(...(part.rotation??[0,0,0]));
      transform.scale.set(...part.size);transform.updateMatrix();
      instance.setMatrixAt(i,transform.matrix);
    });
    instance.instanceMatrix.needsUpdate=true;
    instance.computeBoundingSphere();
  },[parts,origin]);
  return <instancedMesh key={parts.length} ref={mesh} args={[box,material,parts.length]} castShadow={!material.transparent} receiveShadow
    onClick={event=>{
      if(event.delta>5||event.instanceId===undefined||plane&&plane.distanceToPoint(event.point)<0)return;
      event.stopPropagation();onSelect(parts[event.instanceId]);
    }}/>;
}

type TextureSet=Partial<Record<Surface,CanvasTexture>>;
function Structure({config,geometry,options,selected,onSelect,time,mode,result,motion,heat='None',heatMax=1,direction=0,showGround=true,textures}:Props&{textures:TextureSet}){
  const floorGroups=useRef<(Group|null)[]>([]);
  const platform=useRef<Group>(null);
  const bands=useRef<(Mesh<BoxGeometry,MeshBasicMaterial>|null)[]>([]);
  const gradient=useMemo(()=>heatStops.map(stop=>new Color(stop)),[]);
  const radians=direction*Math.PI/180,dx=Math.cos(radians),dz=Math.sin(radians);
  const plane=useMemo(()=>new Plane(),[]);
  const {view}=options;
  const storeyParts=useMemo(()=>{
    const byStorey=Array.from({length:config.levels.length+1},()=>[] as Part[]);
    geometry.parts.forEach(part=>byStorey[part.storey+1].push(part));
    return byStorey;
  },[geometry,config.levels.length]);
  const liveMaterials=useMemo(()=>{
    const clippingPlanes=view==='Section'?[plane]:null;
    return Object.fromEntries(materials.map(surface=>{
      const [color,roughness,metalness]=surfaceSpec(surface);
      return [surface,new MeshStandardMaterial({color:textures[surface]?'#fff':color,map:textures[surface]??null,
        bumpMap:textures[surface]??null,bumpScale:surface==='Brick'||surface==='Stone'?.021:.005,roughness,metalness,
        clippingPlanes,wireframe:view==='Wireframe'})];
    })) as Record<Surface,MeshStandardMaterial>;
  },[textures,plane,view]);
  const glass=useMemo(()=>new MeshStandardMaterial({color:'#8daeb8',roughness:.4,metalness:.1,transparent:true,opacity:.23,depthWrite:false}),[]);
  const highlight=useMemo(()=>new MeshStandardMaterial({color:'#35dbea',emissive:'#117386',emissiveIntensity:.45,roughness:.45}),[]);
  const original=useMemo(()=>new MeshStandardMaterial({color:'#a6e6ff',wireframe:true,transparent:true,opacity:.24,depthWrite:false}),[]);
  useEffect(()=>()=>Object.values(liveMaterials).forEach(material=>material.dispose()),[liveMaterials]);
  useEffect(()=>()=>{glass.dispose();highlight.dispose();original.dispose();},[glass,highlight,original]);
  const dimension=options.axis==='Height'?geometry.height:options.axis==='Width'?geometry.width:geometry.length;
  plane.normal.set(options.axis==='Width'?-1:0,options.axis==='Height'?-1:0,options.axis==='Depth'?-1:0);
  plane.constant=options.axis==='Height'?options.clip*dimension:(options.clip-.5)*dimension;
  original.clippingPlanes=view==='Section'?[plane]:null;
  highlight.clippingPlanes=view==='Section'?[plane]:null;
  const isolated=Number(config.isolation);
  const clipped=view==='Section'?plane:null;
  const n=config.levels.length+isolated;
  const modeScale=mode?Math.max(...mode.shape.map(Math.abs)):1;
  function displacement(dof:number,t:number){
    if(dof<0)return 0;
    if(motion==='modal'&&mode)return Math.sin(t*2*Math.PI*Math.min(mode.hz,1.4))*mode.shape[dof]/modeScale*.07;
    if(motion==='seismic'&&result)return floorDisplacement(result.traces.displacement,result.time,n,dof,t);
    return 0;
  }
  useFrame(()=>{
    const t=time.current;
    // Absolute ground offset is a separate trace integrated in the worker.
    const ground=showGround&&motion==='seismic'&&result?.groundDisplacement
      ?floorDisplacement(result.groundDisplacement,result.time,1,0,t)*options.exaggeration:0;
    if(platform.current)platform.current.position.set(ground*dx,0,ground*dz);
    floorGroups.current.forEach((group,index)=>{
      if(!group)return;
      const storey=index-1;
      const previous=displacement(storey+isolated-1,t),next=displacement(storey+isolated,t);
      const y=storey<0?0:geometry.elevations[storey]+(view==='Exploded'?options.gap*index:0);
      const {shift,slope}=storeyTransform(storey<0?next:previous,next,storey<0?1:config.levels[storey].heightM,options.exaggeration);
      group.matrix.set(1,slope*dx,0,shift*dx, 0,1,0,y, 0,slope*dz,1,shift*dz, 0,0,0,1);
      group.matrixWorldNeedsUpdate=true;
      const band=bands.current[index];
      if(!band||heat==='None')return;
      const dof=storey+isolated;
      const value=heat==='Modal displacement'&&mode?Math.abs(mode.shape[dof])/modeScale:
        heat!=='Modal displacement'&&result?heatMagnitude(heat,floorDisplacement(result.traces[channels[heat]],result.time,n,dof,t)):0;
      const indexColor=Math.min(1,value/heatMax)*(gradient.length-1), lower=Math.floor(indexColor);
      band.material.color.copy(gradient[lower]).lerp(gradient[Math.min(lower+1,gradient.length-1)],indexColor-lower);
    });
  });
  const visibleParts=useMemo(()=>storeyParts.map(parts=>parts.filter(part=>{
    if(view==='Floor isolation'&&part.storey!==options.floor)return false;
    if((view==='Structural skeleton'||view==='Mode shape')&&part.nonstructural)return false;
    return true;
  })),[storeyParts,view,options.floor]);
  const renderGroups=useMemo(()=>visibleParts.map(parts=>{
    const batches=new Map<MeshStandardMaterial,Part[]>();
    for(const part of parts){
      if(part.id==='base/footing'||part.id===selected||part.shape)continue;
      const material=view==='X-ray'&&part.nonstructural?glass:liveMaterials[part.surface];
      const list=batches.get(material)??[];list.push(part);batches.set(material,list);
    }
    return {batches:[...batches],active:parts.filter(part=>part.id!=='base/footing'&&(part.id===selected||part.shape))};
  }),[visibleParts,selected,view,glass,liveMaterials]);
  function draw(part:Part,ghost=false,origin=0){
    const mat=ghost?original:part.id===selected?highlight:view==='X-ray'&&part.nonstructural?glass:liveMaterials[part.surface];
    return <mesh key={part.id} geometry={part.shape==='gable'?gable:box} material={mat} position={[part.center[0],part.center[1]-origin,part.center[2]]} scale={part.size} rotation={part.rotation}
      castShadow={!ghost&&mat!==glass} receiveShadow={!ghost} raycast={ghost?()=>{}:undefined}
      onClick={ghost?undefined:event=>{if(event.delta>5||clipped&&clipped.distanceToPoint(event.point)<0)return;event.stopPropagation();onSelect(part);}}/>;
  }
  return <>
    <group ref={platform} dispose={null}>
      {visibleParts[0].filter(part=>part.id==='base/footing').map(part=>draw(part))}
      {renderGroups.map(({batches,active},i)=>{
        const origin=i===0?0:geometry.elevations[i-1];
        return <group key={i} matrixAutoUpdate={false} ref={el=>{floorGroups.current[i]=el;}}>
          {batches.map(([material,parts])=><Batch key={material.uuid} {...{parts,origin,material,plane:clipped,onSelect}}/>)}
                    {active.map(part=>draw(part,false,origin))}
          {heat!=='None'&&i>0&&view!=='Section'&&(view!=='Floor isolation'||options.floor===i-1)&&<mesh ref={node=>{bands.current[i]=node as Mesh<BoxGeometry,MeshBasicMaterial>|null;}}
            position={[0,config.levels[i-1].heightM-.14,geometry.length*.5+.11]}
            onClick={event=>{if(event.delta>5)return;event.stopPropagation();const slab=geometry.parts.find(part=>part.storey===i-1&&(part.type==='Slab'||part.type==='Roof'));if(slab)onSelect(slab);}}>
            <boxGeometry args={[geometry.width,.16,.12]}/><meshBasicMaterial toneMapped={false}/>
          </mesh>}
        </group>;
      })}
    </group>
    {options.ghost&&motion&&<group dispose={null}>{visibleParts.flat().filter(part=>!part.nonstructural).map(part=>draw(part,true))}</group>}
  </>;
}
function SeismicReference({time,direction=0,extent,waves}:{time:RefObject<number>;direction?:number;extent:number;waves:boolean}){
  const ring=useRef<Mesh>(null);
  const angle=direction*Math.PI/180;
  useFrame(()=>{
    if(!ring.current)return;
    const phase=1+(time.current%3)*8;
    ring.current.scale.setScalar(phase);
  });
  return <>
    <gridHelper args={[Math.max(40,extent*2),24,'#72baca','#486b72']} position={[0,.015,0]}/>
    <group position={[0,.06,extent*.58]} rotation={[0,-angle,0]}>
      <mesh><boxGeometry args={[extent*.38,.035,.09]}/><meshBasicMaterial color="#73efff"/></mesh>
      <mesh position={[extent*.22,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.25,.72,12]}/><meshBasicMaterial color="#73efff"/></mesh>
    </group>
    {waves&&<mesh ref={ring} position={[0,.028,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.93,1,64]}/><meshBasicMaterial transparent opacity={.33} color="#66e6f7" side={DoubleSide} depthWrite={false}/></mesh>}
  </>;
}
function FrameInvalidator({time}:{time?:number}){
  const invalidate=useThree(state=>state.invalidate);
  useEffect(()=>invalidate(),[time,invalidate]);
  return null;
}
function Monitor({active,onFps,onLost,onReady}:{active:boolean;onFps:Props['onFps'];onLost:Props['onLost'];onReady?:Props['onReady']}){
  const gl=useThree(state=>state.gl);
  useEffect(()=>{
    if(!onReady)return;
    let frame=0;
    const check=()=>{
      if(gl.domElement.width>1&&gl.domElement.height>1&&gl.info.render.triangles>0)onReady();
      else frame=requestAnimationFrame(check);
    };
    frame=requestAnimationFrame(check);
    return ()=>cancelAnimationFrame(frame);
  },[gl,onReady]);
  const callback=useRef(onLost);
  callback.current=onLost;
  useEffect(()=>{
    const canvas=gl.domElement;
    const lost=(e:Event)=>{e.preventDefault();callback.current(true);};
    const restored=()=>callback.current(false);
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    return ()=>{canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);};
  },[gl]);
  const frame=useRef({count:0,time:0,at:0});
  const profile=useMemo(()=>new URLSearchParams(location.search).has('profile'),[]);
  useFrame((_,delta)=>{
    if(profile&&performance.now()-frame.current.at>500){
      frame.current.at=performance.now();
      const {calls,triangles}=gl.info.render,{textures,geometries}=gl.info.memory;
      gl.domElement.dataset.renderStats=JSON.stringify({calls,triangles,textures,geometries});
    }
    if(!active||delta>.35){frame.current.count=0;frame.current.time=0;return;}
    frame.current.count++;
    frame.current.time+=delta;
    if(frame.current.time>=1){onFps(Math.round(frame.current.count/frame.current.time));frame.current.count=0;frame.current.time=0;}
  });
  return null;
}
function Structures({props,spacing,level}:{props:Props;spacing:number;level:number}){
  const second=props.comparison;
  const names=useMemo(()=>[...new Set([...props.geometry.parts,...(second?.geometry.parts??[])].map(part=>part.surface))]
    .filter(surface=>surface!=='Glass').sort().join(','),[props.geometry,second?.geometry]);
  const textures=useMemo<TextureSet>(()=>Object.fromEntries(names.split(',').filter(Boolean)
    .map(s=>[s,makeSurface(s as Surface,level===0?64:128)])),[names,level===0]);
  useEffect(()=>()=>Object.values(textures).forEach(texture=>texture.dispose()),[textures]);
  return <>
    <group position={[-spacing,0,0]}><Structure {...props} textures={textures}/></group>
    {second&&<group position={[spacing,0,0]}><Structure {...props} {...second} textures={textures} options={{...props.options,floor:Math.min(props.options.floor,second.config.levels.length-1)}}/></group>}
  </>;
}
export default function Viewport(props:Props){
  const level=props.options.quality==='Automatic'?(devicePixelRatio>1.5||navigator.hardwareConcurrency<=4?1:2):qualities.indexOf(props.options.quality)-1;
  const second=props.comparison;
  const spacing=second?(props.geometry.width+second.geometry.width)/4+2.4:0;
  const fitGeometry=useMemo(()=>second?{...props.geometry,width:spacing*2+(props.geometry.width+second.geometry.width)/2,height:Math.max(props.geometry.height,second.geometry.height),length:Math.max(props.geometry.length,second.geometry.length)}:props.geometry,[props.geometry,second?.geometry,spacing]);
  const [ready,setReady]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [waiting,setWaiting]=useState(false);
  const notifyReady=useMemo(()=>()=>{
    setReady(true);
    props.onReady?.();
  },[props.onReady]);
  useEffect(()=>{
    if(ready)return;
    const timer=window.setTimeout(()=>setWaiting(true),8000);
    return ()=>window.clearTimeout(timer);
  },[ready,attempt]);
  return <div className="building-renderer" data-building-ready={ready}><Canvas key={attempt} frameloop={props.playing?'always':'demand'} dpr={level===0?1:[1,level===1?1.25:level===2?1.65:2]}
    shadows={level>0} gl={{antialias:true,toneMapping:ACESFilmicToneMapping,localClippingEnabled:true}} fallback={<p className="constructor-fallback">WebGL 2 is unavailable. Building configuration and project tools remain available.</p>}>
    <Stage options={props.options} level={level} footing={props.config.footing}/>{props.options.quality==='Automatic'&&<AdaptiveDpr/>}<Rig options={props.options} geometry={fitGeometry} fit={props.fit}/>
        {props.reference&&<SeismicReference time={props.time} direction={props.direction} extent={Math.max(fitGeometry.width,fitGeometry.length)} waves={Boolean(props.waves)}/>}
    <Structures props={props} spacing={spacing} level={level}/>
    <FrameInvalidator time={props.frameTime}/>
    <Monitor active={props.playing} onFps={props.onFps} onLost={props.onLost} onReady={notifyReady}/>
  </Canvas>
    {!ready&&<div role="status" className="building-render-status">
      {waiting?<><span>The building has not rendered. Check WebGL support or retry.</span><button onClick={()=>{setWaiting(false);setAttempt(n=>n+1);}}>Retry 3D view</button></>:'Preparing interactive building…'}
    </div>}
  </div>;
}
