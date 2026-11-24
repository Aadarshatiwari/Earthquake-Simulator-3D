import type {Model} from './types';
const descriptions={
  'Concrete frame':{mass:[85000,85000,85000],stiffness:[75e6,75e6,75e6],height:3.15},
  'Stone masonry':{mass:[62000,45000],stiffness:[33e6,27e6],height:2.65},
  'Brick masonry':{mass:[70000,70000,55000],stiffness:[46e6,46e6,35e6],height:2.85},
  'Soft storey':{mass:[85000,85000,85000],stiffness:[25e6,75e6,75e6],height:3.15},
  'Reinforced frame':{mass:[85000,85000,85000],stiffness:[110e6,110e6,110e6],height:3.15},
};
export const engineeringPresets=Object.keys(descriptions) as (keyof typeof descriptions)[];
export function engineeringPreset(key:keyof typeof descriptions):Model{
  const {mass,stiffness,height}=descriptions[key];
  return {storeys:mass.map((massKg,i)=>({massKg,heightM:height,stiffnessNPerM:stiffness[i]})),damping:{kind:'mass',mode:0,ratio:.05}};
}
