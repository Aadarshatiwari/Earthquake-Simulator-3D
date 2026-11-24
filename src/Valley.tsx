import {BufferAttribute,BufferGeometry,Color,DoubleSide} from 'three';

function ridge(seed:number,depth:number,base:string,snowline:number,elevation:number){
  const geometry=new BufferGeometry();
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const columns=125,rows=24;
  const rock=new Color(base),snow=new Color('#e4edf0');
  for(let row=0;row<=rows;row++){
    for(let column=0;column<=columns;column++){
      const x=(column/columns-.5)*320;
      const profile=39+17*Math.sin(x*.056+seed)+12*Math.cos(x*.11-seed)+6*Math.sin(x*.27+seed);
      const slope=Math.sin(Math.PI*row/rows)**1.25;
      const detail=(3*Math.sin(x*.44+row*.9)+2*Math.cos(x*.62-row*1.24))*slope;
      const y=Math.max(-2,profile*slope*elevation+detail-3);
      positions.push(x,y,-depth-row*3.8);
      const color=rock.clone().lerp(snow,Math.min(1,Math.max(0,(y-snowline+detail*.8)/8)));
      colors.push(color.r,color.g,color.b);
      if(row&&column){
        const a=row*(columns+1)+column;
        indices.push(a,a-1,a-columns-1,a-1,a-columns-2,a-columns-1);
      }
    }
  }
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
  geometry.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const peaks=ridge(4,106,'#637c92',37,1.25);
const foothills=ridge(2,59,'#50654c',120,.54);
const trees=Array.from({length:24},(_,i)=>({
  x:(i%12-5.5)*8+Math.sin(i*3.2)*1.1,
  z:i<12?-16-Math.abs(Math.sin(i*1.7))*3:21+Math.sin(i*1.3)*2.2,
  height:1.8+Math.abs(Math.cos(i*2.3))*3,
}));
export default function Valley(){
  return <>
    {[peaks,foothills].map((geometry,i)=><mesh geometry={geometry} key={i}><meshStandardMaterial vertexColors side={DoubleSide} roughness={1}/></mesh>)}
    {trees.map(({x,z,height},i)=><group position={[x,0,z]} key={i}>
      <mesh position={[0,height*.27,0]}><cylinderGeometry args={[.08,.14,height*.54,6]}/><meshStandardMaterial color="#61483a"/></mesh>
      <mesh position={[0,height*.76,0]}><icosahedronGeometry args={[height*.33,2]}/><meshStandardMaterial color={i%2?'#355f48':'#496b44'}/></mesh>
    </group>)}
  </>;
}
