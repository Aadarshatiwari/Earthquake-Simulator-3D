import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {readLibrary} from '../constructor/model';
import type {Options} from '../constructor/viewOptions';
import {icons,primary,routeLabel,secondary,type Locale,type Route} from './routes';
const Preview=lazy(()=>import('./Preview'));
const url=import.meta.env.BASE_URL;
const bilingual={
  en:{start:'Explore the workspace',newBuilding:'Create a building',welcome:'Simulate. Understand. Build resilient.',homeIntro:'Build a structural model, apply real earthquake recordings, and see how buildings respond.',settings:'Workspace settings',onboard:'Get started',next:'Next',close:'Close',more:'More',recent:'Recent building projects'},
  ne:{start:'कार्यस्थल हेर्नुहोस्',newBuilding:'भवन बनाउनुहोस्',welcome:'अनुकरण गर्नुहोस्। बुझ्नुहोस्। सुरक्षित निर्माण गर्नुहोस्।',homeIntro:'भवनको नमुना बनाउनुहोस्, वास्तविक भूकम्पको अभिलेख प्रयोग गर्नुहोस् र भवनको प्रतिक्रिया हेर्नुहोस्।',settings:'कार्यस्थल सेटिङ',onboard:'सुरु गर्नुहोस्',next:'अर्को',close:'बन्द गर्नुहोस्',more:'थप',recent:'हालका भवन परियोजनाहरू'},
};
export function Icon({route}:{route:Route}){
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[route]}/></svg>;
}
export function Navigation({route,go,locale}:{route:Route;go:(r:Route)=>void;locale:Locale}){
  const [open,setOpen]=useState(false),menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    const pointer=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('keydown',key);document.addEventListener('pointerdown',pointer);
    return ()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',pointer);};
  },[open]);
  const item=(r:Route)=><button key={r} aria-current={route===r?'page':undefined} onClick={()=>{setOpen(false);go(r);}}><Icon route={r}/><span>{routeLabel(r,locale)}</span></button>;
  return <header className="site-header"><div className="site-header-inner">
    <button className="site-brand" onClick={()=>go('Home')} aria-label="SeismoNepal 3D"><img src={url+'logo.svg'} alt=""/><span>SeismoNepal <b>3D</b></span></button>
    <nav aria-label={locale==='ne'?'मुख्य नेभिगेसन':'Main navigation'} className="site-links">{primary.map(item)}</nav>
    <div className="site-more" ref={menu}><button ref={trigger} className="site-more-button" aria-expanded={open} aria-controls="workspace-menu" onClick={()=>setOpen(v=>!v)}><Icon route="Settings"/>{bilingual[locale].more}</button>
      {open&&<nav id="workspace-menu" aria-label="More workspaces" className="site-menu"><div className="site-mobile-links">{primary.map(item)}</div>{secondary.map(item)}</nav>}
    </div>
  </div></header>;
}
export type Prefs={locale:Locale;quality:Options['quality'];reduced:boolean};
export function readPrefs(raw:string|null):Prefs{
  const fallback:Prefs={locale:'en',quality:'Automatic',reduced:false};
  try{
    const p=JSON.parse(raw??'null');
    return {locale:p?.locale==='ne'?'ne':'en',quality:['Automatic','Low','Medium','High','Ultra'].includes(p?.quality)?p.quality:'Automatic',reduced:p?.reduced===true};
  }catch{return fallback;}
}
const blurbs:Partial<Record<Route,[string,string]>>={
  'Build & test':['Configure a structural model and inspect it in three dimensions.','संरचनाको नमुना बनाउनुहोस् र त्रिआयामिक रूपमा हेर्नुहोस्।'],
  'Earthquake lab':['Run a ground-motion simulation and inspect the response.','भूकम्पको अनुकरण गरेर भवनको प्रतिक्रिया हेर्नुहोस्।'],
  'Nepal archive':['Explore terrain, earthquake history and verified station records.','नेपालको भूभाग र भूकम्पका अभिलेख हेर्नुहोस्।'],
  'Protection Lab':['Compare isolation, bracing and damping under the same motion.','एउटै भूकम्पीय गतिमा भवनका संरक्षण प्रणाली तुलना गर्नुहोस्।'],
  Analytics:['Inspect response spectra, structural demand and energy.','प्रतिक्रिया वर्णक्रम र संरचनाको ऊर्जा हेर्नुहोस्।'],
  'Research Lab':['Run parametric studies and create reproducible research reports.','अनुसन्धान चलाउनुहोस् र प्रतिवेदन बनाउनुहोस्।'],
  Learn:['Explore lessons about buildings, ground motion and resilience.','भवन, भूकम्पीय गति र सुरक्षाबारे सिक्नुहोस्।'],
};
function Projects({go,recent=false,onProject,locale}:{go:(r:Route)=>void;recent?:boolean;onProject?:(p:ReturnType<typeof readLibrary>[number])=>void;locale:Locale}){
  let buildings:ReturnType<typeof readLibrary>=[];
  let research:string[]=[];
  try{
    buildings=readLibrary(localStorage.getItem('seismonepal-projects-v1')??'[]');
    const items=JSON.parse(localStorage.getItem('seismonepal-research-projects-v1')??'[]');
    if(Array.isArray(items))research=items.map(x=>x?.name).filter((x):x is string=>typeof x==='string');
  }catch{/* Browsing works without storage. */}
  return <section className="site-panel"><h2>{recent?bilingual[locale].recent:routeLabel('Saved projects',locale)}</h2>
    {!buildings.length&&!research.length&&<p>{locale==='ne'?'अहिलेसम्म कुनै परियोजना छैन।':'Save a building or research experiment to see it here.'}</p>}
    <div className="site-project-list">{buildings.slice(0,recent?3:40).map(p=><button key={p.id} onClick={()=>onProject?.(p)}>{p.name}<small>{p.config.levels.length} storeys · {locale==='en'?'Open in Earthquake Lab':'भूकम्प प्रयोगशालामा खोल्नुहोस्'}</small></button>)}
    {research.slice(0,recent?2:12).map((p,i)=><button key={i} onClick={()=>go('Research Lab')}>{p}<small>{routeLabel('Research Lab',locale)}</small></button>)}</div>
    {!buildings.length&&!research.length&&<button onClick={()=>go('Build & test')}>{bilingual[locale].newBuilding}</button>}
  </section>;
}
export function Home({go,prefs,last,onProject}:{go:(r:Route)=>void;prefs:Prefs;last:Route|null;onProject:(p:ReturnType<typeof readLibrary>[number])=>void}){
  const {locale}=prefs,t=bilingual[locale];
  const [step,setStep]=useState(-1);
  const tour:Route[]=['Build & test','Earthquake lab','Nepal archive','Protection Lab','Analytics'];
  const active=tour[step];
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(step>=0&&!dialog.current?.open)dialog.current?.showModal();else if(step<0&&dialog.current?.open)dialog.current.close();},[step]);
  return <div className="site-home">
    <section className="site-hero">
      <div className="site-hero-copy">
        <img src={url+'logo.svg'} className="hero-mark" alt=""/>
        <h1>SeismoNepal <em>3D</em></h1>
        <p className="hero-tagline">{t.welcome}</p>
        <p>{t.homeIntro}</p>
        <div className="hero-actions"><button className="primary" onClick={()=>go('Build & test')}>{t.newBuilding}</button>
          <button onClick={()=>setStep(0)}>{t.onboard}</button>
          {last&&<button onClick={()=>go(last)}>{locale==='ne'?'अन्तिम कार्य खोल्नुहोस्':'Continue last workspace'}</button>}</div>
      </div>
      <Suspense fallback={<div className="home-preview pending" role="status">{locale==='ne'?'त्रिआयामिक दृश्य खुल्दैछ…':'Loading interactive model…'}</div>}>
        <Preview quality={prefs.quality==='Automatic'?'Medium':prefs.quality}/>
      </Suspense>
    </section>
    <h2>{t.start}</h2>
    <div className="site-tile-grid">{(Object.keys(blurbs) as Route[]).map(route=><button className="site-tile" key={route} onClick={()=>go(route)}>
      <span className="tile-icon"><Icon route={route}/></span><strong>{routeLabel(route,locale)}</strong><span>{blurbs[route]?.[locale==='ne'?1:0]}</span>
    </button>)}</div>
    <Projects go={go} locale={locale} recent onProject={onProject}/>
    <dialog ref={dialog} className="site-dialog" onCancel={()=>setStep(-1)} onClose={()=>setStep(-1)} aria-label={t.onboard}>
      {active&&<><h2>{routeLabel(active,locale)}</h2><p>{blurbs[active]?.[locale==='ne'?1:0]}</p><div className="hero-actions">
        <button className="primary" onClick={()=>{setStep(-1);go(active);}}>{locale==='ne'?'खोल्नुहोस्':'Open workspace'}</button>
        {step<tour.length-1&&<button onClick={()=>setStep(n=>n+1)}>{t.next}</button>}<button onClick={()=>setStep(-1)}>{t.close}</button></div></>}
    </dialog>
  </div>;
}
export function Page({route,go,prefs,setPrefs,theme,setTheme,onProject}:{route:Route;go:(r:Route)=>void;prefs:Prefs;setPrefs:(p:Prefs)=>void;theme:string;setTheme:(t:string)=>void;onProject:(p:ReturnType<typeof readLibrary>[number])=>void}){
  const ne=prefs.locale==='ne';
  if(route==='Saved projects')return <Projects go={go} locale={prefs.locale} onProject={onProject}/>;
  if(route==='About')return <section className="site-panel about-panel">
    <img src={url+'logo.svg'} width="84" height="84" alt=""/><h1>SeismoNepal 3D</h1><p>{bilingual[prefs.locale].welcome}</p>
    <p>{ne?'भूकम्प र संरचनात्मक गतिशीलता सिक्ने शैक्षिक प्रयोगशाला।':'An educational laboratory for Nepal earthquake records, structural response and reproducible engineering experiments.'}</p>
    <p>{ne?'यो उपकरणले भवनको सुरक्षा प्रमाणित गर्दैन।':'Simplified structural response cannot establish building safety or code compliance.'}</p>
    <button onClick={()=>go('Learn')}>{routeLabel('Learn',prefs.locale)}</button>
  </section>;
  return <section className="site-panel settings-panel">
    <h1>{bilingual[prefs.locale].settings}</h1>
    <div className="site-settings-grid">
      <label>{ne?'रङ योजना':'Appearance'}<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">{ne?'गाढा':'Dark'}</option><option value="light">{ne?'उज्यालो':'Light'}</option></select></label>
      <label>{ne?'भाषा':'Language'}<select value={prefs.locale} onChange={e=>setPrefs({...prefs,locale:e.target.value as Locale})}><option value="en">English</option><option value="ne">नेपाली</option></select></label>
      <label>{ne?'ग्राफिक्स गुणस्तर':'Default graphics'}<select value={prefs.quality} onChange={e=>setPrefs({...prefs,quality:e.target.value as Options['quality']})}>{['Automatic','Low','Medium','High','Ultra'].map(x=><option key={x} value={x}>{x==='Medium'?'Balanced':x}</option>)}</select></label>
      <label className="site-check"><input type="checkbox" checked={prefs.reduced} onChange={e=>setPrefs({...prefs,reduced:e.target.checked})}/>{ne?'एनिमेसन कम गर्नुहोस्':'Reduce interface motion'}</label>
    </div>
    <p>{ne?'विस्तृत इन्जिनियरिङ चार्ट र PDF हाल अङ्ग्रेजीमा छन्।':'Detailed engineering interfaces and PDF exports currently use English.'}</p>
  </section>;
}
