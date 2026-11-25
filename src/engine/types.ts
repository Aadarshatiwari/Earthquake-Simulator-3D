/** SI units throughout. Structural DOFs run from the lowest active DOF to the roof, followed by an optional device. */
export interface Member {
  elasticModulusPa:number;
  secondMomentM4:number;
  areaM2?:number;
}
export interface Storey {
  massKg:number;
  heightM:number;
  stiffnessNPerM:number;
  damperNsPerM?:number;
  columns?:Member[];
  beams?:Member[];
  initialDisplacementM?:number;
  initialVelocityMPerS?:number;
}
export type Damping =
  | {kind:'none'}
  | {kind:'viscous';ratio:number}
  | {kind:'mass'|'stiffness';mode:number;ratio:number}
  | {kind:'rayleigh';first:{mode:number;ratio:number};second:{mode:number;ratio:number}};
export interface Model {
  storeys:Storey[];
  damping:Damping;
  influence?:number[];
  /** Optional independent mass, connected to a zero-based superstructure floor. */
  attachment?:{floor:number;massKg:number;stiffnessNPerM:number;damperNsPerM:number};
  foundation?:{kind:'fixed'}|{kind:'isolation';bearing:Storey};
}
export interface GroundMotion {
  acceleration:Float64Array;
  dt:number;
  label:string;
  provenance?:string;
  bandLimitHz?:number;
}
export interface Mode {
  omega:number;
  hz:number;
  period:number;
  shape:Float64Array;
  participation:number;
  effectiveMassKg:number;
  effectiveMassRatio:number;
}
export interface Controls {
  stride?:number;
  maxSteps?:number;
  maxOutputBytes?:number;
  onProgress?:(fraction:number)=>void;
  cancelled?:()=>boolean;
}
