import {validateConfig,type Config,type Surface} from './model';
export type Vector=[number,number,number];
export type ComponentType='Column'|'Beam'|'Slab'|'Roof'|'Foundation'|'Bearing'|'Wall'|'Partition'|'Shear wall'|'Brace'|'Door'|'Window'|'Stair'|'Balcony'|'Trim';
export type Part={id:string;type:ComponentType;surface:Surface;storey:number;center:Vector;size:Vector;rotation?:Vector;nonstructural?:boolean;shape?:'gable'};
export function generate(c:Config){
  validateConfig(c);
  const parts:Part[]=[], elevations:number[]=[];
  const x=Array.from({length:c.baysX+1},(_,i)=>(i/c.baysX-.5)*c.width);
  const z=Array.from({length:c.baysZ+1},(_,i)=>(i/c.baysZ-.5)*c.length);
  const bayX=c.width/c.baysX,bayZ=c.length/c.baysZ;
  let floor=-1;
  const add=(key:string,type:ComponentType,surface:Surface,center:Vector,size:Vector,nonstructural=false,rotation?:Vector,shape?:'gable')=>{
    parts.push({id:(floor<0?'base':'L'+(floor+1))+'/'+key,type,surface,center,size,storey:floor,nonstructural,rotation,shape});
  };
  add('footing','Foundation','Concrete',[0,-c.footing/2,0],[c.width+2*c.overhang,c.footing,c.length+2*c.overhang]);
  const baseHeight=c.isolation?.45:0;
  if(c.isolation){
    for(const [i,xx] of x.entries())for(const [j,zz] of z.entries()){
      add('bearing-'+i+'-'+j,'Bearing','Steel',[xx,.18,zz],[.48,.36,.48]);
      add('bearing-plate-'+i+'-'+j,'Bearing','Steel',[xx,.377,zz],[.64,.034,.64]);
    }
    add('transfer','Foundation','Concrete',[0,.42,0],[c.width+.5,.06,c.length+.5]);
  }
  let bottom=baseHeight;
  c.levels.forEach(({heightM:h},level)=>{
    floor=level;
    elevations.push(bottom);
    const top=bottom+h, memberHeight=h-Math.max(c.beamDepth,c.slab);
    const last=level===c.levels.length-1;
    add('slab',last?'Roof':'Slab','Concrete',[0,top-c.slab/2,0],[c.width+c.columnWidth,c.slab,c.length+c.columnDepth]);
    for(const [i,xx] of x.entries())for(const [j,zz] of z.entries()){
      add('column-'+i+'-'+j,'Column','Concrete',[xx,bottom+memberHeight/2,zz],[c.columnWidth,memberHeight,c.columnDepth]);
      if(i<c.baysX&&c.beamDepth>c.slab)add('beam-x-'+i+'-'+j,'Beam','Concrete',[xx+bayX/2,top-(c.slab+c.beamDepth)/2,zz],[bayX-c.columnWidth,c.beamDepth-c.slab,c.beamWidth]);
      if(j<c.baysZ&&c.beamDepth>c.slab)add('beam-z-'+i+'-'+j,'Beam','Concrete',[xx,top-(c.slab+c.beamDepth)/2,zz+bayZ/2],[c.beamWidth,c.beamDepth-c.slab,bayZ-c.columnDepth]);
    }
    const masonry=c.preset==='Himalayan stone'||c.preset==='Newari brick';
    const trim=masonry?'Timber':'Concrete';
    const openingHeight=Math.min(h*.56,1.9);
    function facade(key:string,i:number,span:number,offset:number,edge:number,side:boolean,front:boolean,clear:number){
      if(level===0&&c.openGround)return;
      const usable=span-clear;
      const hasDoor=level===0&&front&&i===c.entryBay-1;
      const windowAllowed=front||c.windows==='All sides'||(!side&&c.windows==='Front and rear');
      const opening=hasDoor||windowAllowed;
      const aperture=hasDoor?Math.min(.95,usable*.72):usable*c.glazing;
      const height=hasDoor?Math.min(2.12,memberHeight-.07):openingHeight;
      const sill=hasDoor?0:(memberHeight-height)*.40;
      function box(suffix:string,type:ComponentType,surface:Surface,u:number,y:number,w:number,v:number,depth:number,out=0){
        if(v<=.025||w<=.025)return;
        const sign=Math.sign(edge);
        const center:Vector=side?[edge+out*sign,bottom+y,offset+u]:[offset+u,bottom+y,edge+out*sign];
        const size:Vector=side?[depth,v,w]:[w,v,depth];
        add(key+'-'+suffix,type,surface,center,size,true);
      }
      if(!opening){box('wall','Wall',c.finish,0,memberHeight/2,usable,memberHeight,c.wall);return;}
      const pier=(usable-aperture)/2;
      box('pier-left','Wall',c.finish,-(aperture+pier)/2,memberHeight/2,pier,memberHeight,c.wall);
      box('pier-right','Wall',c.finish,(aperture+pier)/2,memberHeight/2,pier,memberHeight,c.wall);
      box('sill-wall','Wall',c.finish,0,sill/2,aperture,sill,c.wall);
      const head=memberHeight-sill-height;
      box('head','Wall',c.finish,0,sill+height+head/2,aperture,head,c.wall);
      box('opening',hasDoor?'Door':'Window',hasDoor?trim:'Glass',0,sill+height/2,aperture,height,.09,c.wall*.18);
      box('lintel','Trim',trim,0,sill+height,aperture+.12,.10,.12,c.wall*.55);
      if(!hasDoor){
        box('sill','Trim',trim,0,sill,aperture+.15,.09,.17,c.wall*.64);
        if(c.preset==='Newari brick'){
          for(let j=-2;j<=2;j++)box('lattice-'+j,'Trim','Timber',j*aperture*.16,sill+height/2,.032,height*.88,.035,c.wall*.43);
          for(let j=1;j<=3;j++)box('lattice-rail-'+j,'Trim','Timber',0,sill+j*height/4,aperture,.036,.035,c.wall*.47);
        }
        for(let j=-1;j<=1;j++)box('mullion-'+j,'Trim',masonry?'Timber':'Steel',j*aperture*.46,sill+height/2,.055,height,.07,c.wall*.33);
      }
    }
    for(let i=0;i<c.baysX;i++){
      facade('front-'+i,i,bayX,x[i]+bayX/2,z.at(-1)!,false,true,c.columnWidth);
      facade('rear-'+i,i,bayX,x[i]+bayX/2,z[0],false,false,c.columnWidth);
    }
    for(let j=0;j<c.baysZ;j++){
      facade('left-'+j,j,bayZ,z[j]+bayZ/2,x[0],true,false,c.columnDepth);
      facade('right-'+j,j,bayZ,z[j]+bayZ/2,x.at(-1)!,true,false,c.columnDepth);
    }
    if(!(level===0&&c.openGround))add('partition','Partition','Plaster',[0,bottom+memberHeight/2,-c.length*.18],[c.width*.45,memberHeight,c.wall],true);
    if(c.balconies&&level>0){
      const apron=c.length/2+.61;
      add('balcony','Balcony','Concrete',[0,bottom-.06,apron],[c.width*.68,.17,1.22],true);
      add('guard','Balcony','Steel',[0,bottom+.91,apron+.60],[c.width*.68,.055,.05],true);
      const guardWidth=c.width*.67;
      const pickets=Math.ceil(guardWidth/.23);
      for(let j=0;j<=pickets;j++)add('baluster-'+j,'Balcony','Steel',[(j/pickets-.5)*guardWidth,bottom+.44,apron+.60],[.024,.89,.024],true);
      add('guard-bottom','Balcony','Steel',[0,bottom+.16,apron+.60],[guardWidth,.027,.036],true);
      add('balcony-fascia','Trim','Plaster',[0,bottom-.15,apron+.59],[c.width*.69,.085,.07],true);
      for(const side of [-1,1]){
        add('side-guard-'+side,'Balcony','Steel',[side*guardWidth/2,bottom+.91,apron],[.05,.055,1.2],true);
        for(let j=0;j<5;j++)add('side-picket-'+side+'-'+j,'Balcony','Steel',[side*guardWidth/2,bottom+.44,apron-.54+j*.23],[.024,.89,.024],true);
      }
    }
    if(c.stairs&&!last){
      const steps=14,run=Math.min(c.length*.61,4.3), rise=h/steps;
      for(let j=0;j<steps;j++)add('stair-'+j,'Stair','Concrete',[-c.width*.27,bottom+(j+1)*rise-.08,-run/2+(j+.5)*run/steps],[.91,.16,run/steps],true);
    }
    const mid=x[c.reinforcementBay-1]+bayX/2, clear=bayX-c.columnWidth;
    if(c.reinforcement==='Shear walls')add('shear','Shear wall','Concrete',[mid,bottom+memberHeight/2,-c.length*.30],[clear,memberHeight,c.wall]);
    if(c.reinforcement==='Bracing'){
      for(const sign of [-1,1])add('brace-'+sign,'Brace','Steel',[mid,bottom+memberHeight/2,c.length/2-.43],[.12,Math.hypot(clear,memberHeight),.12],false,[0,0,sign*Math.atan2(clear,memberHeight)]);
    }
    if(last&&c.roof!=='Gable'){
      for(const side of [-1,1]){
        add('roof-parapet-x-'+side,'Trim','Plaster',[0,top+.27,side*(c.length/2-.05)],[c.width,.54,.14],true);
        add('roof-coping-x-'+side,'Trim','Concrete',[0,top+.55,side*(c.length/2-.05)],[c.width+.06,.065,.20],true);
        add('roof-parapet-z-'+side,'Trim','Plaster',[side*(c.width/2-.05),top+.27,0],[.14,.54,c.length],true);
        add('roof-coping-z-'+side,'Trim','Concrete',[side*(c.width/2-.05),top+.55,0],[.20,.065,c.length+.06],true);
      }
    }
    if(last&&c.roof==='Gable'){
      const pitch=.33,half=c.length/2+.36;
      for(const sign of [-1,1])add('pitch-'+sign,'Roof','Tile',[0,top+half*Math.tan(pitch)/2,sign*half/2],[c.width+.75,.115,half/Math.cos(pitch)+.04],true,[sign*pitch,0,0]);
      add('ridge','Trim','Timber',[0,top+half*Math.tan(pitch),0],[c.width+.8,.13,.14],true);
      for(const sign of [-1,1])add('gable-'+sign,'Wall',c.finish,[sign*c.width/2,top,0],[c.wall,half*Math.tan(pitch),c.length],true,undefined,'gable');
    }
    bottom=top;
  });
  return {parts,elevations,height:bottom+(c.roof==='Gable'?(c.length/2+.36)*Math.tan(.33):0),width:c.width+c.columnWidth,length:c.length+c.columnDepth};
}
export function floorDisplacement(trace:Float64Array,times:Float64Array,n:number,dof:number,t:number){
  let lo=0,hi=times.length-1;
  if(t<=times[0])return trace[dof];
  if(t>=times[hi])return trace[hi*n+dof];
  while(hi-lo>1){const mid=(hi+lo)>>1;if(times[mid]<=t)lo=mid;else hi=mid;}
  const f=(t-times[lo])/(times[hi]-times[lo]);
  return trace[lo*n+dof]*(1-f)+trace[hi*n+dof]*f;
}
