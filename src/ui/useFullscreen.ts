import {useEffect,useState,type RefObject} from 'react';

/** Fill the app viewport when an embedded browser disallows native fullscreen. */
export function useFullscreen(target:RefObject<HTMLElement|null>,active=true){
  const [fallback,setFallback]=useState(false);
  const [native,setNative]=useState(false);
  useEffect(()=>{
    const update=()=>setNative(document.fullscreenElement===target.current&&!!target.current);
    document.addEventListener('fullscreenchange',update);
    return ()=>document.removeEventListener('fullscreenchange',update);
  },[target]);
  useEffect(()=>{
    if(!active)setFallback(false);
    if(!fallback||!active)return;
    function escape(event:KeyboardEvent){if(event.key==='Escape')setFallback(false);}
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[fallback,active]);
  async function toggle(){
    const element=target.current;
    if(!element)return;
    if(fallback){setFallback(false);return;}
    if(document.fullscreenElement===element){
      try{await document.exitFullscreen();}catch{/* the browser retains ownership */}
      return;
    }
    try{
      if(!element.requestFullscreen)throw new Error('Unavailable');
      await element.requestFullscreen();
    }catch{setFallback(true);}
  }
  return {expanded:native||fallback,inline:active&&fallback,toggle};
}
