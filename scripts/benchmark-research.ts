import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assembleModel} from '../src/engine';
import {type RecordingMeta} from '../src/archive/catalog';
import {parseArrayRecord} from '../src/archive/waveform';
import {buildVariant,presetVariant} from '../src/protection/model';
import {analysisDefaults,analyze,refine,scan} from '../src/research/compute';
import {elasticSpectrum,fourier,spectrogram} from '../src/research/signal';
import {researchRows} from '../src/research/export';
import {reportPdf} from '../src/research/pdf';

const root=new URL('../public/archive/',import.meta.url);
const file=(path:string)=>readFileSync(new URL(path,root));
const meta=(JSON.parse(file('gorkha-mainshock.json').toString()) as RecordingMeta[]).find(r=>r.station==='KTP')!;
const source=file(meta.asset);
if(createHash('sha256').update(source).digest('hex')!==meta.sha256)throw Error('Original record hash mismatch.');
const data=parseArrayRecord(source.toString(),meta);
const motion={dt:data.dt,acceleration:data.components.NS,label:'Recorded | Gorkha mainshock | KTP | North-south',
  provenance:meta.source+' | '+meta.path+' | SHA-256 '+meta.sha256};
const variants=[presetVariant('Ordinary reinforced concrete'),presetVariant('Isolated institutional')];
const x={parameter:'Storey stiffness multiplier',min:.55,max:1.65,count:8,log:false} as const;
const y={parameter:'Floor mass multiplier',min:.7,max:1.4,count:8,log:false} as const;
function measure<T>(name:string,task:()=>T){
  task();
  const times:number[]=[];let last:T|undefined;
  for(let i=0;i<5;i++){const t=performance.now();last=task();times.push(performance.now()-t);}
  console.log(name,times.sort((a,b)=>a-b)[2].toFixed(2)+' ms');
  return last!;
}
const study=measure('complete two-case study',()=>analyze(motion,variants,analysisDefaults));
measure('five damping spectra',()=>elasticSpectrum(motion,Array.from({length:75},(_,i)=>.05*200**(i/74)),analysisDefaults.ratios));
measure('FFT',()=>fourier(motion.acceleration,motion.dt));
measure('spectrogram',()=>spectrogram(motion.acceleration,motion.dt));
measure('modal assembly',()=>assembleModel(buildVariant(variants[0]).model));
measure('one-axis sweep',()=>scan(variants[0],motion,x,null,'superstructureDrift'));
measure('two-axis sweep',()=>scan(variants[0],motion,x,y,'superstructureDrift'));
const full=measure('full CSV serialization',()=>Array.from(researchRows(study)).join(''));
console.log('Export',full.split('\n').length-2,'rows',Buffer.byteLength(full),'bytes','first and final',full.split('\n')[1].split(',').slice(0,6),full.trimEnd().split('\n').at(-1)?.split(',').slice(0,6));
console.log('Recorded intensity',study.intensity.arias,study.intensity.d595,study.intensity.pga);
console.log('Convergence',refine(variants[0],motion));
console.log('Numerical array bytes',study.cases.reduce((s,c)=>s+c.run.packed.byteLength,0));
const pdf=measure('three-page PDF',()=>reportPdf('Gorkha mainshock: baseline and isolation',motion,study,variants,'',new Date(),{format:'Comprehensive'}));
if(process.argv[2])writeFileSync(process.argv[2],pdf);
