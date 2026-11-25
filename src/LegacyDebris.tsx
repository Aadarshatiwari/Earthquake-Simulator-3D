import {useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {Physics,RigidBody,CuboidCollider} from '@react-three/rapier';
import type {Building,Result} from './solver';
type Model={building:Building;result:Result};
export default function Debris({models,time,dt,runId,playing,collapse}:{models:Model[];time:RefObject<number>;dt:number;runId:number;playing:boolean;collapse:boolean}){
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
