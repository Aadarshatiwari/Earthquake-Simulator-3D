import {useCallback,useMemo,useRef,useState} from 'react';
import Viewport from '../constructor/Viewport';
import {generate} from '../constructor/geometry';
import {presetConfig} from '../constructor/model';
import type {Options} from '../constructor/viewOptions';

export default function Preview({quality}:{quality:Options['quality']}){
  const config=useMemo(()=>presetConfig('Concrete residence'),[]);
  const geometry=useMemo(()=>generate(config),[config]);
  const time=useRef(0);
  const [fit,setFit]=useState(0);
  const [ready,setReady]=useState(false);
  const showModel=useCallback(()=>setReady(true),[]);
  const [lost,setLost]=useState(false);
  const [skeleton,setSkeleton]=useState(false);
  const options:Options={view:skeleton?'Structural skeleton':'Architectural',camera:'Isometric',quality,
    environment:'Kathmandu neighbourhood',floor:0,gap:0,clip:.5,axis:'Depth',ghost:false,exaggeration:8,details:true};
  return <div className="home-preview" data-render-ready={ready}>
    <Viewport geometry={geometry} config={config} options={options} selected={null} onSelect={()=>{}} fit={fit} time={time} mode={null} result={null} playing={false} motion={null} onLost={setLost} onReady={showModel} onFps={()=>{}}/>
    {lost&&<p className="preview-caption" role="status">The graphics context is unavailable. Building and analysis controls are still accessible.</p>}
    <div className="preview-controls"><button aria-pressed={skeleton} onClick={()=>setSkeleton(v=>!v)}>Structural view</button><button onClick={()=>setFit(n=>n+1)}>Fit</button></div>
  </div>;
}
