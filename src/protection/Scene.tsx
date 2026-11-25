import {useState,useMemo,type ReactNode} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls,OrthographicCamera} from '@react-three/drei';
import {BoxGeometry,Color,CylinderGeometry,Quaternion,Vector3} from 'three';
import {useEffect,useRef} from 'react';
import type {Variant} from './model';
import {sampleOffsets,type CaseResult} from './analysis';

type Vec=[number,number,number];
export type View='Architecture'|'Skeleton'|'Wireframe'|'X-ray'|'Exploded'|'Foundation'|'Devices'|'Drift heatmap';
const boxGeometry=new BoxGeometry(1,1,1);
const cylinderGeometry=new CylinderGeometry(.5,.5,1,12);
const presets={Stone:'#ada391',Brick:'#aa6d5e',Plaster:'#d4d6d3',Concrete:'#bdc9d1'};
function Box({position,size,color,wire=false,opacity=1,onPick}:{position:Vec;size:Vec;color:string;wire?:boolean;opacity?:number;onPick?:()=>void}){
  return <mesh position={position} scale={size} onClick={onPick?e=>{e.stopPropagation();onPick();}:undefined}>
    <primitive object={boxGeometry} attach="geometry"/><meshStandardMaterial color={color} wireframe={wire} transparent={opacity<1} opacity={opacity} roughness={.65}/>
  </mesh>;
}
function Member({a,b,width,depth,color,wire=false,round=false,onPick}:{a:Vec;b:Vec;width:number;depth:number;color:string;wire?:boolean;round?:boolean;onPick?:()=>void}){
  const vector=new Vector3(...b).sub(new Vector3(...a)),length=vector.length();
  const pos=new Vector3(...a).lerp(new Vector3(...b),.5);
  const rotation=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),vector.normalize());
  return <mesh position={pos} quaternion={rotation} scale={[width,length,depth]} onClick={onPick?e=>{e.stopPropagation();onPick();}:undefined}>
    <primitive object={round?cylinderGeometry:boxGeometry} attach="geometry"/><meshStandardMaterial color={color} wireframe={wire} roughness={.4} metalness={.35}/>
  </mesh>;
}
function Building({variant,result,sample,scale,view,select,pick,dx,driftMax}:{variant:Variant;result?:CaseResult;sample:number;scale:number;view:View;select:()=>void;pick:(value:string)=>void;dx:number;driftMax:number}){
  const b=variant.building,d=variant.devices;
  const {base,floors,damper}=sampleOffsets(result,sample,scale,b.levels.length);
  const wire=view==='Wireframe',xray=view==='X-ray',arch=view==='Architecture',foundation=view==='Foundation';
  const offset=d.isolation?.83:.32,w=b.width,l=b.length;
  const material=presets[b.finish as keyof typeof presets]??'#bec9cf';
  const masonry=b.preset==='Himalayan stone'||b.preset==='Newari brick';
  const frameColor=masonry?material:'#bcc2c1';
  const columns=Array.from({length:b.baysX+1},(_,i)=>-w/2+i*w/b.baysX);
  const depths=Array.from({length:b.baysZ+1},(_,i)=>-l/2+i*l/b.baysZ);
  const devices=(x:string)=>()=>{select();pick(x);};
  const total=b.levels.reduce((sum,s)=>sum+s.heightM,offset);
  let elevation=offset;
  const draw:(ReactNode[])=[];
  draw.push(<Box key="pad" position={[0,-.21,0]} size={[w+2,.45,l+2]} color="#324853"/>);
  draw.push(<Box key="pedestal" position={[base,d.isolation?.69:.15,0]} size={[w+.55,.28,l+.55]} color="#9dabb2" wire={wire}/>);
  if(d.isolation)for(const x of [-w*.38,w*.38])for(const z of [-l*.37,l*.37]){
    const bearings=Array.from({length:5},(_,s)=>s);
    draw.push(<group key={'bearing'+x+z} onClick={e=>{e.stopPropagation();devices('Isolation bearing')();}}>
      <Box position={[x,.12,z]} size={[1.08,.13,1.08]} color="#667880"/>
      <Box position={[x+base,.57,z]} size={[1.02,.13,1.02]} color="#a6bac1"/>
      {bearings.map(s=><mesh key={s} position={[x+base*(s+.5)/5,.2+s*.078,z]}><cylinderGeometry args={[.42,.42,.067,12]}/><meshStandardMaterial color={d.bearing==='Lead-rubber'?(s===2?'#e5b67a':'#3c4855'):d.bearing==='High-damping rubber'?(s%2?'#75a9a5':'#243945'):d.bearing==='Friction pendulum'?(s>2?'#b9c5c8':'#7b8f9c'):(s%2?'#d6a261':'#263e4e')} roughness={.55}/></mesh>)}
    </group>);
  }
  for(const [i,level] of b.levels.entries()){
    if(foundation&&i>0)break;
    const explosion=view==='Exploded'?i*.7:0,bottom=elevation+explosion,y=bottom+level.heightM;
    const lower=i?floors[i-1]:base,upper=floors[i],h=level.heightM;
    const raw=result?.drifts[sample*(result.n??0)+i+Number(result.isolated)]??0;
    const intensity=Math.min(1,Math.abs(raw)/Math.max(1e-8,driftMax));
    const heat=new Color('#55c9bf').lerp(new Color('#ff795a'),intensity).getStyle();
    const concrete=view==='Drift heatmap'?heat:frameColor;
    if(!foundation)draw.push(<Box key={'slab'+i} position={[upper,y,0]} size={[w+.28,b.slab,l+.24]} color={concrete} wire={wire}/>);
    for(const [cx,x] of columns.entries())for(const [cz,z] of depths.entries()){
      if(arch&&cx>0&&cx<columns.length-1&&cz>0&&cz<depths.length-1)continue;
      const jack=d.retrofit==='Concrete jacketing'||d.retrofit==='Steel jacketing'||(i===0&&d.retrofit==='Soft-storey strengthening');
      draw.push(<Member key={'col'+i+cx+cz} a={[x+lower,bottom,z]} b={[x+upper,y,z]} width={b.columnWidth+Number(jack)*.16} depth={b.columnDepth+Number(jack)*.16} color={jack?'#d9a766':concrete} wire={wire} onPick={jack?devices('Retrofitting'):undefined}/>);
    }
    if(arch&&!(!i&&b.openGround)){
      for(let j=0;j<b.baysX;j++){
        const center=(columns[j]+columns[j+1])/2;
        for(const z of [-l/2,l/2]){
          draw.push(<Box key={'window'+i+j+z} position={[center+(lower+upper)/2,bottom+h*.56,z]} size={[w/b.baysX*.79,h*.49,.14]} color={b.finish==='Stone'?'#3e5b62':'#426e80'} opacity={.78}/>);
          draw.push(<Box key={'sill'+i+j+z} position={[center+(lower+upper)/2,bottom+h*.23,z]} size={[w/b.baysX*.88,h*.17,.26]} color={material}/>);
        }
      }
      for(const [j,z] of depths.slice(0,-1).entries()){
        const centre=(z+depths[j+1])/2;
        for(const x of [-w/2,w/2]){
          draw.push(<Box key={'side-infill'+i+j+x} position={[x+(lower+upper)/2,bottom+h*.43,centre]} size={[.18,h*.69,l/b.baysZ*.86]} color={material}/>);
          draw.push(<Box key={'side-glass'+i+j+x} position={[x+Math.sign(x)*.108+(lower+upper)/2,bottom+h*.55,centre]} size={[.07,h*.38,l/b.baysZ*.62]} color="#537d8e"/>);
        }
      }
    }
    if(d.brace&&i+1>=d.braceFirst&&i+1<=d.braceLast){
      for(let bay=0;bay<Math.min(d.braceBays,b.baysX);bay++){
        const x0=columns[bay],x1=columns[bay+1],mid=(x0+x1)/2,z=l/2+.07;
        const a:Vec=[x0+lower,bottom,z],b0:Vec=[x1+lower,bottom,z],c:Vec=[x0+upper,y,z],e:Vec=[x1+upper,y,z];
        const pairs:[Vec,Vec][]=d.braceKind==='X'?[[a,e],[b0,c]]:
          d.braceKind==='V'?[[c,[mid+lower,bottom,z]],[e,[mid+lower,bottom,z]]]:
          d.braceKind==='Inverted V'?[[a,[mid+upper,y,z]],[b0,[mid+upper,y,z]]]:
          d.braceKind==='K · illustration'?[[b0,[x0+(lower+upper)/2,(bottom+y)/2,z]],[e,[x0+(lower+upper)/2,(bottom+y)/2,z]]]:[[a,e]];
        pairs.forEach(([start,end],j)=>draw.push(<Member key={'brace'+i+bay+j} a={start} b={end} width={.22} depth={.2} color="#ddac65" wire={wire} onPick={devices('Steel bracing')}/>));
      }
    }
    if(d.wall&&i+1>=d.wallFirst&&i+1<=d.wallLast){
      const locations=d.wallKind==='External walls'?[-l*.46,l*.46]:d.wallKind==='Distributed walls'?[-l*.23,l*.23]:[0];
      // A skewed panel keeps wall corners attached to both floor translations.
      for(const z of locations)draw.push(<mesh key={'wall'+i+z} position={[(lower+upper)/2,bottom+h/2,z]} rotation={[0,0,-Math.atan2(upper-lower,h)]} onClick={e=>{e.stopPropagation();devices('Shear walls')();}}>
        <boxGeometry args={[d.wallLength/locations.length,Math.hypot(h,upper-lower),d.wallThickness]}/><meshStandardMaterial color="#7aabc8" transparent={xray} opacity={xray?.45:1} wireframe={wire}/>
      </mesh>);
    }
    if(d.viscous&&i+1===d.viscousStorey){
      const slope=Math.tan(Math.min(89.9,d.viscousAngle)*Math.PI/180);
      const spread=Math.min(w*.67,(h-.38)/Math.max(.1,slope));
      const rise=spread*slope;
      const a:Vec=[-.5*spread+lower,bottom+.25,l/2+.32];
      const end:Vec=[.5*spread+upper,bottom+.25+Math.min(h-.38,rise),l/2+.32];
      const middle:Vec=a.map((value,j)=>value+(end[j]-value)*.58) as Vec;
      draw.push(<Member key={'piston-body'+i} a={a} b={middle} color="#f49a70" round width={.60} depth={.45} onPick={devices('Viscous dampers')}/>);
      draw.push(<Member key={'piston-rod'+i} a={middle} b={end} color="#d5e4eb" round width={.20} depth={.15} onPick={devices('Viscous dampers')}/>);
    }
    if(d.retrofit==='Horizontal seismic bands'||d.retrofit==='Masonry reinforcement'||d.retrofit==='Improved connections'){
      const band=d.retrofit==='Horizontal seismic bands';
      draw.push(<Box key={'retrofit'+i} position={[upper,y-.22,l/2+.09]} size={[band?w:.8,band?.3:.53,.31]} color="#e3ac61" wire={wire} onPick={devices('Retrofitting')}/>);
    }
    if(d.tmd&&i+1===d.tmdFloor){
      const translation=damper??upper,z=l*.21,anchored=y+.95;
      draw.push(<Box key={'damper-track'+i} position={[upper,y+.21,z]} size={[3.5,.18,1.35]} color="#4b6578" wire={wire}/>);
      draw.push(<Box key={'damper-mass'+i} position={[translation,anchored,z]} size={[1.36,1.03,1.16]} color={d.tmdKind==='Rooftop mechanical'?'#a5b6e7':d.tmdKind==='Pendulum-inspired'?'#d3ace9':'#a88df3'} onPick={devices('Tuned mass damper')}/>);
      draw.push(<Member key={'damper-guide'+i} a={[upper-1.86,anchored,z]} b={[translation-.67,anchored,z]} color="#e2bf79" width={.18} depth={.16} onPick={devices('Tuned mass damper')}/>);
      if(d.tmdKind==='Suspended mass'||d.tmdKind==='Pendulum-inspired')draw.push(<Member key={'suspension'+i} a={[upper,anchored+1.55,z]} b={[translation,anchored+.45,z]} color="#aecad9" width={.095} depth={.095} onPick={devices('Tuned mass damper')}/>);
    }
    elevation+=h;
  }
  if(arch&&b.roof==='Gable'){
    for(const side of [-1,1])draw.push(<mesh key={'gable'+side} position={[floors.at(-1)??0,total+.72,side*l*.25]} rotation={[side*.25,0,0]}>
      <boxGeometry args={[w+.65,.22,l*.55]}/><meshStandardMaterial color="#695956"/>
    </mesh>);
  }
  return <group position={[dx,0,0]}>{draw}</group>;
}
function CameraRig({width,height,x,distance,foundation}:{width:number;height:number;x:number;distance:number;foundation:boolean}){
  const {size}=useThree();
  const zoom=Math.min(size.width/(width+3),size.height/(height+4));
  return <>
    <OrthographicCamera makeDefault position={[distance*.42,foundation?height*1.35:Math.max(height*.82,distance*.57),distance]} zoom={Math.max(.5,zoom)} near={.1} far={1000}/>
    <OrbitControls target={[x,height*.37,0]} minZoom={.4} maxZoom={90} enableDamping enablePan/>
  </>;
}
function FrameReady({onReady}:{onReady:()=>void}){
  const {gl,scene}=useThree(),frame=useRef(0);
  useEffect(()=>{
    let stopped=false;
    function check(){
      if(stopped)return;
      if(gl.info.render.triangles>0&&scene.children.length>0)onReady();
      else frame.current=requestAnimationFrame(check);
    }
    frame.current=requestAnimationFrame(check);
    return ()=>{stopped=true;cancelAnimationFrame(frame.current);};
  },[gl,scene,onReady]);
  return null;
}
export default function Scene({variants,results,sample,scale,view,active,setActive,onPick,quality}:{variants:Variant[];results?:CaseResult[];sample:number;scale:number;view:View;active:number;setActive:(n:number)=>void;onPick:(s:string)=>void;quality:'Balanced'|'Low'}){
  const [ready,setReady]=useState(false);
  const onReady=useMemo(()=>()=>setReady(true),[]);
  const arrangement=view==='Foundation'||view==='Devices'?[active]:variants.map((_,i)=>i);
  const width=Math.max(...variants.map(v=>v.building.width));
  const depth=Math.max(...variants.map(v=>v.building.length));
  const tallest=Math.max(...arrangement.map(i=>variants[i].building.levels.reduce((total,level)=>total+level.heightM,1)));
  const columns=arrangement.length;
  const height=view==='Foundation'?5:tallest;
  const spacing=width+depth*.64+2;
  const span=width+(columns-1)*spacing+depth*.5;
  const driftMax=Math.max(1e-8,...(results?.map(result=>result.peaks.superstructureDrift)??[]));
  return <>
  <div className="protection-scene" aria-label="Synchronized 3D comparison">
    <Canvas frameloop="demand" dpr={quality==='Low'?1:[1,1.35]} fallback={<p className="protection-canvas-note">WebGL is unavailable. Calculation and charts remain accessible.</p>}>
      <color attach="background" args={['#122331']}/>
      <hemisphereLight args={['#e2f3ff','#78808c',2]}/><directionalLight position={[-12,18,8]} intensity={2.2}/>
      <CameraRig key={view+'-'+arrangement.join('-')+'-'+tallest+'-'+span} width={span*1.09} height={height} distance={Math.max(35,span)} foundation={view==='Foundation'} x={0}/>
      <gridHelper args={[Math.max(62,span*1.3),28,'#497384','#2a4656']} position={[0,-.46,0]}/>
      {arrangement.map((i,j)=><Building key={i} variant={variants[i]} result={results?.[i]} sample={sample} scale={scale} view={view} select={()=>setActive(i)} pick={onPick} dx={(j-(columns-1)/2)*spacing} driftMax={driftMax}/>)}
      <FrameReady onReady={onReady}/>
    </Canvas>
    <span className="protection-scene-label" role="status">{ready?'3D frame rendered':'Preparing 3D view'} · {scale}× deformation</span>
  </div>
  <div className="protection-visual-legend" aria-label="Viewport buildings">
    {arrangement.map(i=><button type="button" className="protection-model-tag" key={i} aria-pressed={i===active} onClick={()=>setActive(i)}>{String.fromCharCode(65+i)} · {variants[i].name}</button>)}
  </div>
  </>;
}
