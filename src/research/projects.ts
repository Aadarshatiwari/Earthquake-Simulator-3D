import {buildVariant,type Variant} from '../protection/model';
import type {Settings,Axis,Objective} from './compute';

export type ResearchProject={version:1;name:string;embedded?:{dt:number;label:string;provenance?:string;samples:number[]};notes:string;source:string;component:'NS'|'EW';variants:Variant[];settings:Settings;axis:Axis;axis2:Axis;grid:boolean;objective:Objective};
export function readResearch(text:string){
  if(text.length>700000)throw Error('Experiment file is too large.');
  const p=JSON.parse(text) as ResearchProject;
  if(!p||p.version!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.notes!=='string'||p.notes.length>2000||
    !Array.isArray(p.variants)||p.variants.length<1||p.variants.length>4||!['NS','EW'].includes(p.component)||!p.settings||
    !Array.isArray(p.settings.ratios)||!p.settings.ratios.length||p.settings.ratios.length>8||
    p.settings.ratios.some(v=>!Number.isFinite(v)||v<0||v>=1)||typeof p.source!=='string'||!p.axis||!p.axis2)throw Error('Invalid version 1 research experiment.');
  if(p.embedded&&(!Number.isFinite(p.embedded.dt)||p.embedded.dt<=0||typeof p.embedded.label!=='string'||!Array.isArray(p.embedded.samples)||
    p.embedded.samples.length<2||p.embedded.samples.length>18001||p.embedded.samples.some(n=>!Number.isFinite(n))))throw Error('Invalid embedded ground motion.');
  p.variants.forEach(buildVariant);return p;
}
