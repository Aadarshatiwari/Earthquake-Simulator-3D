import {CanvasTexture,RepeatWrapping,SRGBColorSpace} from 'three';

function texture(size:number,paint:(ctx:CanvasRenderingContext2D)=>void,repeat=1){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  paint(canvas.getContext('2d')!);
  const map=new CanvasTexture(canvas);
  map.colorSpace=SRGBColorSpace;
  map.wrapS=map.wrapT=RepeatWrapping;
  map.repeat.set(repeat,repeat);
  map.anisotropy=8;
  return map;
}

function noise(ctx:CanvasRenderingContext2D,size:number,count:number){
  let seed=351681;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){
    ctx.fillStyle=next()<.5?'#17201718':'#fff7db20';
    const x=next()*size,y=next()*size,scale=next()*2.6+.35;
    ctx.fillRect(x,y,scale,scale);
  }
}

function facade(masonry:boolean,stone:boolean){
  return texture(512,ctx=>{
    ctx.fillStyle=masonry?(stone?'#a09987':'#a35038'):'#c7c5b9';
    ctx.fillRect(0,0,512,512);
    if(masonry){
      const height=stone?33:19,width=stone?104:57;
      ctx.strokeStyle=stone?'#746d5f':'#713f31';
      ctx.lineWidth=2;
      for(let y=0;y<512;y+=height){
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();
        for(let x=-((y/height)%2)*width/2;x<512;x+=width){
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+height);ctx.stroke();
        }
      }
    }
    noise(ctx,512,20000);
    for(const x of [34,282]){
      const w=196,y=105,h=294;
      ctx.fillStyle=masonry?'#52362a':'#797970';ctx.fillRect(x-10,y-10,w+20,h+23);
      const glass=ctx.createLinearGradient(x,y,x+w,y+h);
      glass.addColorStop(0,'#acbec2');glass.addColorStop(.45,'#607e85');glass.addColorStop(.46,'#46616a');glass.addColorStop(1,'#273d43');
      ctx.fillStyle=glass;ctx.fillRect(x,y,w,h);
      ctx.fillStyle=masonry?'#453128':'#333c3c';
      ctx.fillRect(x+w/2-5,y,10,h);ctx.fillRect(x,y+h*.45,w,8);
      ctx.fillStyle=masonry?'#634736':'#aaa79a';ctx.fillRect(x-15,y+h,w+30,14);
      ctx.fillStyle='#221d2336';ctx.fillRect(x-12,y+h+14,w+24,7);
    }
    ctx.fillStyle='#716f6255';ctx.fillRect(0,473,512,9);
  });
}

export const surfaces={
  concrete:facade(false,false),
  brick:facade(true,false),
  stone:facade(true,true),
  asphalt:texture(256,ctx=>{ctx.fillStyle='#3c3d3a';ctx.fillRect(0,0,256,256);noise(ctx,256,32000);},8),
  grass:texture(256,ctx=>{ctx.fillStyle='#737956';ctx.fillRect(0,0,256,256);noise(ctx,256,36000);},14),
  paving:texture(512,ctx=>{
    ctx.fillStyle='#939186';ctx.fillRect(0,0,512,512);
    ctx.strokeStyle='#73736b';ctx.lineWidth=2;
    for(let y=0;y<512;y+=64){
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();
      for(let x=-(y%128);x<512;x+=128){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+64);ctx.stroke();}
    }
    noise(ctx,512,22000);
  },4),
};
