import type { Building, System } from './solver';
export const systems:System[]=['Ordinary frame','Cross-bracing','Shear walls','Base isolation','Supplemental damping'];
const base:Building={floors:6,height:3.15,width:13,length:10,column:.5,beam:.55,mass:85,stiffness:75,damping:5,material:'Reinforced concrete',foundation:'Fixed',soil:'Rock',system:'Ordinary frame'};
export const presets:Record<string,Building>={
  'Concrete frame':base,
  'Stone masonry':{...base,floors:2,height:2.65,width:8,length:6,mass:62,stiffness:33,material:'Stone masonry'},
  'Brick masonry':{...base,floors:3,height:2.85,width:9,length:8,mass:70,stiffness:46,material:'Brick masonry'},
  'Modern apartment':{...base,floors:12,width:17,length:13,mass:175,stiffness:155,system:'Shear walls'},
  'Resilient frame':{...base,floors:8,mass:110,stiffness:120,system:'Base isolation'}
};
