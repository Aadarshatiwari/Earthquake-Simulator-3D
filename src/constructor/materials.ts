import {CanvasTexture,RepeatWrapping,SRGBColorSpace} from 'three';
import type {Surface} from './model';

const specs:Record<Surface,[string,number,number]>={Concrete:['#bcb9a8',.84,.02],Brick:['#984e39',.83,.02],Stone:['#8b8573',.94,0],Steel:['#5c777e',.34,.73],Timber:['#5e3726',.74,0],Glass:['#5b879a',.23,.35],Plaster:['#e5d9bd',.88,0],Tile:['#8c4435',.86,0],Asphalt:['#464741',.95,0],Soil:['#75654c',1,0],Gravel:['#827e6c',.97,0]};
export const surfaceSpec=(surface:Surface)=>specs[surface];
export function makeSurface(surface:Surface){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  const [base]=specs[surface];
  ctx.fillStyle=base;ctx.fillRect(0,0,128,128);
  let state=1773;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
  if(['Brick','Stone','Tile'].includes(surface)){
    const h=surface==='Stone'?22:surface==='Tile'?17:12;
    for(let y=0;y<128;y+=h){
      const width=surface==='Stone'?37:surface==='Tile'?17:29;
      for(let x=-width*((y/h)%2)/2;x<128;x+=width){
        ctx.fillStyle=rand()<.5?'#1411122b':'#ffe6c139';ctx.fillRect(x+1,y+1,width-2,h-2);
      }
      ctx.strokeStyle=surface==='Tile'?'#4b2e28':'#a19177';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();
    }
  }
  if(surface==='Timber')for(let x=0;x<128;x+=3){
    ctx.strokeStyle=rand()<.5?'#1c140d46':'#c78d5846';ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+2,32,x-1,91,x,128);ctx.stroke();
  }
  if(surface!=='Glass')for(let i=0;i<4600;i++){
    ctx.fillStyle=rand()<.5?'#241a1722':'#fff5d321';ctx.fillRect(rand()*128,rand()*128,1+rand()*2,1+rand()*2);
  }
  const map=new CanvasTexture(canvas);
  map.colorSpace=SRGBColorSpace;map.wrapS=map.wrapT=RepeatWrapping;map.anisotropy=4;
  return map;
}
