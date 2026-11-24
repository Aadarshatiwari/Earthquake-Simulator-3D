import {useLayoutEffect,useRef, type RefObject} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,ContactShadows,Sky} from '@react-three/drei';
import {Physics,RigidBody,CuboidCollider} from '@react-three/rapier';
import {Group,Color,Vector3,Quaternion,Mesh,MeshStandardMaterial} from 'three';
import type {Building,Result} from './solver';

import Valley from './Valley';
import {surfaces} from './surfaces';
export type CameraView='Perspective'|'Front'|'Overhead';
type Model={building:Building;result:Result};
type SceneProps={models:Model[];time:RefObject<number>;dt:number;direction:number;scale:number;wire:boolean;section:boolean;demand:boolean;damage:boolean;collapse:boolean;playing:boolean;runId:number;cameraId:number;cameraView:CameraView;selected:{building:number;floor:number}|null;onFloor:(building:number,floor:number)=>void};
const axis=new Vector3(0,1,0);
const palette:Record<string,string>={'Reinforced concrete':'#b9c7bc','Stone masonry':'#a59882','Brick masonry':'#ba735c','Steel':'#8da7b7'};
const beamModes=new Set(['Cross-bracing','Supplemental damping']);
function Brace({a,b,color,wire}:{a:Vector3;b:Vector3;color:string;wire:boolean}){
  const v=b.clone().sub(a);
  return <mesh position={a.clone().add(b).multiplyScalar(.5)} quaternion={new Quaternion().setFromUnitVectors(axis,v.clone().normalize())}><boxGeometry args={[.15,v.length(),.15]}/><meshStandardMaterial color={color} wireframe={wire}/></mesh>;
}
function Structure({model,time,dt,direction,scale,wire,section,demand,damage,collapse,offset,selected,onFloor,index}:Omit<SceneProps,'models'|'runId'|'cameraId'|'cameraView'>&{model:Model;offset:number;index:number}){
  const {building:b,result}=model;
  const floors=useRef<(Group|null)[]>([]),base=useRef<Group>(null);
  const color=palette[b.material]??'#afbbb4';
  const exterior=!section&&!wire;
  const cladding=b.material==='Stone masonry'?surfaces.stone:b.material==='Brick masonry'?surfaces.brick:surfaces.concrete;
  const angle=direction*Math.PI/180;
  const phase=new Color(), cool=new Color(color), hot=new Color('#ff6b4d');
  const demoStart=result.samples.at(-1)!.t*.55;
  useFrame(()=>{
    const collapseProgress=collapse?Math.min(1,Math.max(0,(time.current-demoStart)/2.3)):0;
    const fall=collapseProgress**2;
    const frame=result.samples[Math.min(result.samples.length-1,Math.max(0,Math.floor(time.current/dt)))];
    if(base.current)base.current.position.set(Math.cos(angle)*frame.isolation*scale,b.system==='Base isolation'?.46:.14,Math.sin(angle)*frame.isolation*scale);
    floors.current.forEach((floor,i)=>{
      if(!floor)return;
      const displacement=frame.displacement[i]*scale;
      floor.position.set(Math.cos(angle)*displacement+fall*i*.2,(i+1)*b.height*(1-.88*fall)+(b.system==='Base isolation'?.46:.14),Math.sin(angle)*displacement);
      floor.scale.y=1-.82*fall;
      const prior=(i?frame.displacement[i-1]:frame.isolation)*scale;
      floor.rotation.z=-(displacement-prior)*Math.cos(angle)/b.height+fall*Math.sin(i*2)*.08;
      floor.rotation.x=(displacement-prior)*Math.sin(angle)/b.height;
      const mat=(floor.getObjectByName('slab') as Mesh|undefined)?.material as MeshStandardMaterial|undefined;
      if(mat)mat.color.copy(phase.copy(cool).lerp(hot,demand?Math.min(1,Math.abs(frame.drift[i])/.025):0));
      const crack=floor.getObjectByName('crack');
      if(crack)crack.visible=damage&&Math.abs(frame.drift[i])>.012;
    });
  });
  const columnCoordinates=[-1,0,1].flatMap(x=>[-1,1].map(z=>[x*(b.width/2-b.column/2),z*(b.length/2-b.column/2)]));
  return <group position={[offset,0,0]}>
    {b.system==='Base isolation'&&columnCoordinates.map(([x,z])=><mesh position={[x,.24,z]} key={x+':'+z}><cylinderGeometry args={[.33,.37,.43,12]}/><meshStandardMaterial color="#e7ad65" wireframe={wire}/></mesh>)}
    <group ref={base}><mesh receiveShadow><boxGeometry args={[b.width+1,.28,b.length+1]}/><meshStandardMaterial color="#687970" wireframe={wire}/></mesh></group>
    {Array.from({length:b.floors},(_,i)=><group key={i} ref={el=>{floors.current[i]=el}} position={[0,(i+1)*b.height+.14,0]}>
      <mesh name="slab" castShadow receiveShadow onClick={event=>{if(event.delta>4)return;event.stopPropagation();onFloor(index,i)}}>
        {selected?.building===index&&selected.floor===i&&<mesh><boxGeometry args={[b.width+.22,.31,b.length+.22]}/><meshBasicMaterial color="#45dfbb" wireframe/></mesh>}<boxGeometry args={[b.width,Math.min(.28,b.height/6),b.length]}/><meshStandardMaterial color={color} wireframe={wire}/></mesh>
      {columnCoordinates.filter(([,z])=>!section||z<0).map(([x,z])=><mesh key={x+':'+z} position={[x,-b.height/2,z]} castShadow><boxGeometry args={[b.column,b.height,b.column]}/><meshStandardMaterial color={color} wireframe={wire}/></mesh>)}
      {[-1,1].filter(z=>!section||z<0).map(z=><mesh key={z} position={[0,-b.beam/2,z*(b.length/2-b.column/2)]}><boxGeometry args={[b.width,b.beam,b.column]}/><meshStandardMaterial color={color} wireframe={wire}/></mesh>)}
      {exterior&&[-1,1].map(side=><group key={side}>
        <mesh position={[0,-b.height*.52,side*(b.length/2-.08)]} rotation={[0,side===1?0:Math.PI,0]} castShadow receiveShadow>
          <planeGeometry args={[b.width-.16,b.height-.26]}/><meshStandardMaterial map={cladding} roughness={.83}/>
        </mesh>
        <mesh position={[side*(b.width/2-.08),-b.height*.52,0]} rotation={[0,side*Math.PI/2,0]} castShadow receiveShadow>
          <planeGeometry args={[b.length-.16,b.height-.26]}/><meshStandardMaterial map={cladding} roughness={.83}/>
        </mesh>
        <mesh position={[0,-.25,side*b.length*.503]}><boxGeometry args={[b.width+.08,.12,.13]}/><meshStandardMaterial color={color}/></mesh>
      </group>)}
      {!exterior&&!section&&<mesh position={[0,-b.height*.53,-b.length*.48]}><boxGeometry args={[b.width*.89,b.height*.62,.13]}/><meshStandardMaterial color={b.material.includes('masonry')?color:'#274a4b'} metalness={.42} roughness={.38} wireframe={wire}/></mesh>}
      {!exterior&&!section&&[-1,1].map(side=><mesh key={side} position={[side*b.width*.485,-b.height*.48,0]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[b.length*.79,b.height*.14,.1]}/><meshStandardMaterial color="#668487" wireframe={wire}/></mesh>)}
      {b.system==='Shear walls'&&<mesh position={[0,-b.height/2,0]} castShadow><boxGeometry args={[.5,b.height,b.length*.58]}/><meshStandardMaterial color="#577773" wireframe={wire}/></mesh>}
      {beamModes.has(b.system)&&[-1,1].map(sign=><Brace key={sign} a={new Vector3(-sign*b.width*.46,-b.height,-b.length*.45)} b={new Vector3(sign*b.width*.46,0,-b.length*.45)} color="#ddaf73" wire={wire}/>)}
      <mesh name="crack" visible={false} position={[b.width*.23,-b.height*.43,b.length*.504]} rotation={[0,0,.55]}><boxGeometry args={[.065,b.height*.52,.06]}/><meshStandardMaterial color="#321c1a"/></mesh>
      {exterior&&i===b.floors-1&&!collapse&&(b.material.includes('masonry')?
        <mesh position={[0,b.height*.17,0]} rotation={[0,Math.PI/4,0]} scale={[b.width/Math.SQRT2,1,b.length/Math.SQRT2]} castShadow receiveShadow>
          <coneGeometry args={[1,b.height*.58,4]}/><meshStandardMaterial color="#804d3d" roughness={.94}/>
        </mesh>:<group>
          {[-1,1].map(side=><group key={side}>
            <mesh position={[0,.32,side*(b.length/2-.09)]} castShadow><boxGeometry args={[b.width,.4,.18]}/><meshStandardMaterial color="#aaa594"/></mesh>
            <mesh position={[side*(b.width/2-.09),.32,0]} castShadow><boxGeometry args={[.18,.4,b.length]}/><meshStandardMaterial color="#aaa594"/></mesh>
          </group>)}
          <mesh position={[-b.width*.21,.61,-b.length*.23]} castShadow><boxGeometry args={[b.width*.19,.94,b.length*.23]}/><meshStandardMaterial color="#a5a398" roughness={.91}/></mesh>
          <mesh position={[b.width*.25,.63,-b.length*.24]} castShadow><cylinderGeometry args={[.45,.45,.95,16]}/><meshStandardMaterial color="#344342" roughness={.68}/></mesh>
        </group>)}
    </group>)}
  </group>;
}
const town=Array.from({length:26},(_,i)=>({x:(i%9-4)*10+Math.sin(i*13)*2,z:-23-Math.floor(i/9)*12+Math.cos(i*11)*2,h:2+(i*7)%9,w:2.4+i%4,color:['#906858','#6f7e69','#baa084','#a48070'][i%4]}));
function Debris({models,time,dt,runId,playing,collapse}:{models:Model[];time:RefObject<number>;dt:number;runId:number;playing:boolean;collapse:boolean}){
  const threshold=models.map(({result})=>collapse?result.samples.at(-1)!.t*.55:(result.samples.find(s=>s.drift.some(v=>Math.abs(v)>.018))?.t??Infinity));
  const spacing=Math.max(13,...models.map(({building})=>building.width*.64));
  const blocks=useRef<(import('@react-three/rapier').RapierRigidBody|null)[]>([]);
  const triggered=useRef<boolean[]>([]);
  useFrame(()=>{
    models.forEach(({building:b},m)=>{
      const shouldDrop=time.current+dt*.1>=threshold[m];
      if(shouldDrop===triggered.current[m])return;
      triggered.current[m]=shouldDrop;
      const offset=models.length>1?(m===0?-spacing:spacing):0;
      for(let i=0;i<7;i++){
        const block=blocks.current[m*7+i];
        if(!block)continue;
        block.setTranslation({x:offset+(i-3)*b.width/9,y:b.floors*b.height*.8+i*.27,z:b.length/2+.7},true);
        block.setLinvel({x:0,y:0,z:0},true);
        block.setAngvel({x:0,y:0,z:0},true);
        block.setEnabled(shouldDrop);
        if(shouldDrop)block.applyImpulse({x:(i-3)*.04,y:.05,z:.18},true);
      }
    });
  });
  return <Physics key={runId} paused={!playing} gravity={[0,-9.81,0]}><CuboidCollider args={[90,.3,90]} position={[0,-.3,0]}/>
    {models.flatMap((_,m)=>Array.from({length:7},(_,i)=><RigidBody key={m+':'+i} ref={el=>{blocks.current[m*7+i]=el;el?.setEnabled(false)}} colliders="cuboid" position={[0,-10,0]}><mesh castShadow><boxGeometry args={[.37,.27,.31]}/><meshStandardMaterial color="#d38d70"/></mesh></RigidBody>))}
  </Physics>;
}
function CameraRig({position,target,distance}:{position:[number,number,number];target:number;distance:number}){
  const camera=useThree(state=>state.camera);
  const controls=useRef<import('three-stdlib').OrbitControls>(null);
  const [x,y,z]=position;
  useLayoutEffect(()=>{
    camera.position.set(x,y,z);
    camera.lookAt(0,target,0);
    controls.current?.target.set(0,target,0);
    controls.current?.update();
  },[camera,x,y,z,target]);
  return <OrbitControls ref={controls} makeDefault target={[0,target,0]} minDistance={8} maxDistance={Math.max(140,distance*3)} maxPolarAngle={Math.PI*.485}/>;
}
export default function Scene(props:SceneProps){
  const height=Math.max(...props.models.map(({building})=>building.floors*building.height));
  const plan=Math.max(...props.models.map(({building})=>building.width));
  const spacing=Math.max(13,plan*.64);
  const distance=Math.max(32,height*1.30,props.models.length===2?spacing*3.1:25);
  const target= Math.max(4,height*.42);
  const position:[number,number,number]=props.cameraView==='Overhead'
    ?[0,target+distance*1.72,.2]
    :props.cameraView==='Front'?[0,target+distance*.12,distance*1.55]:[distance,target+distance*.53,distance*1.04];
  return <Canvas shadows dpr={[1,2]} camera={{position,fov:45,near:.2,far:420}} fallback={<p className="scene-fallback">WebGL is unavailable. Numerical results remain available in Analytics.</p>}>
    <CameraRig key={props.cameraId} position={position} target={target} distance={distance}/>
    <Sky distance={390} sunPosition={[-.62,.55,.58]} turbidity={3.1} rayleigh={1.35} mieCoefficient={.004}/>
    <fog attach="fog" args={['#a2b7bd',Math.max(86,distance*1.35),Math.max(278,distance*3.2)]}/>
    <hemisphereLight args={['#deedff','#817868',1.15]}/>
    <directionalLight position={[-32,49,33]} color="#fff1da" intensity={2.6} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-normalBias={.07}/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[370,370]}/><meshStandardMaterial map={surfaces.grass} roughness={1}/></mesh>
    {(props.section||props.wire)&&<gridHelper args={[174,87,'#52695d','#475b4e']} position={[0,.02,0]}/>}
    <mesh position={[0,.019,1]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[props.models.length>1?spacing*2+plan+7:plan+9,23]}/><meshStandardMaterial map={surfaces.paving} roughness={.95}/></mesh>
    <mesh position={[0,.028,16.7]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[155,1.2]}/><meshStandardMaterial map={surfaces.paving} roughness={.9}/></mesh>
    <mesh position={[0,.028,9.2]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[155,1.1]}/><meshStandardMaterial map={surfaces.paving} roughness={.9}/></mesh>
    <mesh position={[0,.025,13]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[155,6.5]}/><meshStandardMaterial map={surfaces.asphalt} roughness={1}/></mesh>
    {Array.from({length:24},(_,i)=><mesh key={i} position={[(i-12)*6,.034,13]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,.1]}/><meshStandardMaterial color="#ac9d73"/></mesh>)}
    {[-36,-18,0,18,36].map(x=><group key={x} position={[x,0,16.9]}>
      <mesh position={[0,2.65,0]} castShadow><cylinderGeometry args={[.045,.08,5.3,8]}/><meshStandardMaterial color="#565c58" roughness={.56}/></mesh>
      <mesh position={[0,5.2,-.68]}><boxGeometry args={[.09,.09,1.4]}/><meshStandardMaterial color="#565c58"/></mesh>
      <mesh position={[0,5.13,-1.36]}><boxGeometry args={[.25,.13,.44]}/><meshStandardMaterial color="#c6c3af"/></mesh>
    </group>)}
    {town.map((plot,i)=><group key={i} position={[plot.x,0,plot.z]}><mesh position={[0,plot.h/2,0]} receiveShadow><boxGeometry args={[plot.w,plot.h,plot.w*.8]}/><meshStandardMaterial map={i%3===0?surfaces.brick:surfaces.concrete} color={plot.color} roughness={.9}/></mesh><mesh position={[0,plot.h+.18,0]}><boxGeometry args={[plot.w+.4,.36,plot.w*.8+.4]}/><meshStandardMaterial color="#523f36"/></mesh>
      {Array.from({length:Math.ceil(plot.h/2.5)},(_,level)=><group key={level} position={[0,.95+level*2.1,0]}>
        <mesh position={[0,0,plot.w*.4+.012]}><planeGeometry args={[plot.w*.65,.62]}/><meshStandardMaterial color="#304b47"/></mesh>
        <mesh position={[plot.w/2+.012,0,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[plot.w*.50,.62]}/><meshStandardMaterial color="#304b47"/></mesh>
      </group>)}</group>)}
    <Valley/>
    <ContactShadows position={[0,.034,0]} scale={62} opacity={.4} blur={2.4} far={20} frames={1}/>
    {props.models.map((model,i)=><Structure key={i} {...props} index={i} model={model} offset={props.models.length>1?(i===0?-spacing:spacing):0}/>)}
    {(props.damage||props.collapse)&&<Debris key={props.runId} {...props}/>}
  </Canvas>;
}
