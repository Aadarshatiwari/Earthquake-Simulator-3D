import {useEffect,useRef,useState} from 'react';
import {advanceIllustration} from './presentation';

const waves=[['P wave',6,'#85e5fc'],['S wave',3.5,'#c8adff'],['Surface wave',2.9,'#ffb987']] as const;
export default function Waves(){
  const [distance,setDistance]=useState(90);
  const [playing,setPlaying]=useState(false);
  const [time,setTime]=useState(0),[speed,setSpeed]=useState(1);
  const duration=distance/2.9+6;
  const playhead=useRef(0);
  function seek(value:number){playhead.current=value;setTime(value);}
  useEffect(()=>{
    if(!playing)return;
    let handle=0,last=performance.now();
    const tick=(now:number)=>{
      const cursor=advanceIllustration(playhead.current,Math.min(.1,(now-last)/1000),speed*4,duration);
      last=now;seek(cursor);
      if(cursor<duration)handle=requestAnimationFrame(tick);
      else setPlaying(false);
    };
    handle=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(handle);
  },[playing,speed,duration]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',hidden);
    return ()=>document.removeEventListener('visibilitychange',hidden);
  },[]);
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(){
    if(playing){setPlaying(false);return;}
    if(reduced()){seek(duration);return;}
    if(time>=duration)seek(0);
    setPlaying(true);
  }
  return <details className="archive-card archive-waves"><summary>Illustrative seismic-wave replay</summary>
    <p><strong>Illustrative seismic-wave propagation — not a measured historical reconstruction.</strong></p>
    <p className="archive-note">The hypocentre is the underground source and the epicentre lies above it. P waves compress material, S waves shear it, and surface waves travel near the surface. The drawing uses a point source and a uniform medium. Real arrivals depend on the rupture and geology.</p>
    <svg viewBox="0 0 600 170" className="archive-wave-diagram" role="img" aria-label="Schematic compression, shear and surface wavefronts">
      <defs><clipPath id="archive-wave-clip"><rect x="0" width="600" y="53" height="117"/></clipPath></defs>
      <rect width="600" height="170" fill="#102638"/>
      <rect y="54" width="600" height="116" fill="#172b42"/>
      <path d="M0 53H600" stroke="#647f92"/>
      <g clipPath="url(#archive-wave-clip)">
        {waves.slice(0,2).map(([label,velocity,color])=><circle key={label} cx="300" cy="96" r={Math.min(330,time*velocity/distance*270)} fill="none" stroke={color} strokeWidth="2"/>)}
      </g>
      <circle cx="300" cy="96" r="5" fill="#ff8b81"/><circle cx="300" cy="53" r="4" fill="#ffd389"/>
      <path d="M300 91V58" stroke="#ddbb9d" strokeDasharray="3 4"/>
      {[1,-1].map(side=><circle key={side} cx={300+side*Math.min(290,Math.max(0,time-2)*2.9/distance*270)} cy="53" r={time>2?4:0} fill="#ffb987"/>)}
    </svg>
    <div className="archive-tools"><label>Illustrative distance ({distance} km)<input type="range" min={10} max={300} value={distance} onChange={e=>{setPlaying(false);seek(0);setDistance(+e.target.value);}}/></label>
      <button onClick={play}>{playing?'Pause illustration':time>0&&time<duration?'Resume illustration':'Play illustrative waves'}</button>
      <button onClick={()=>{seek(0);setPlaying(false);}}>Restart illustration</button>
      <label>Playback speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.5,1,2,4].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
      <label className="archive-timeline">Illustration time {time.toFixed(1)} s<input type="range" min="0" max={duration} step=".1" value={time} onChange={e=>{setPlaying(false);seek(+e.target.value);}}/></label>
    </div>
    {waves.map(([label,velocity,colour])=><div className="archive-wave-row" key={label} style={{color:colour}}><span>{label}</span><progress max={1} value={Math.min(1,time*velocity/distance)}/><strong>{(distance/velocity).toFixed(1)} s</strong></div>)}
    <p className="archive-note">Example speeds are 6, 3.5 and 2.9 km/s. The displayed arrival examples use distance divided by speed. Diagram positions are schematic.</p>
  </details>;
}
