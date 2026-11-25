import {makeMotion} from '../seismic/motion';
import {buildVariant} from './model';
import type {Experiment} from './analysis';

export const storageKey='seismonepal-protection-v1';
export function readExperiment(text:string):Experiment{
  if(text.length>3_000_000)throw Error('Experiment file exceeds the size limit.');
  const item=JSON.parse(text) as Experiment;
  if(!item||item.version!==1||!Array.isArray(item.variants)||item.variants.length<1||item.variants.length>4||
    typeof item.notes!=='string'||item.notes.length>2500||!item.settings)throw Error('Expected a version 1 Protection Lab experiment.');
  for(const variant of item.variants)buildVariant(variant);
  if(item.settings.form!=='Imported CSV'&&item.recording)throw Error('A recorded input must be labelled as recorded.');
  makeMotion(item.settings,item.recording);
  return item;
}
