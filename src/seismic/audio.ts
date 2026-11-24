/** Procedural low-pass noise, started only from an explicit user gesture. */
export class Rumble {
  private context:AudioContext|null=null;
  private level:GainNode|null=null;
  constructor(volume:number){
    const context=new AudioContext();
    this.context=context;
    const source=context.createBufferSource();
    const length=context.sampleRate*2;
    const buffer=context.createBuffer(1,length,context.sampleRate);
    const samples=buffer.getChannelData(0);
    let seed=113;
    for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/2**31-1;}
    source.buffer=buffer;source.loop=true;
    const filter=context.createBiquadFilter();
    filter.type='lowpass';filter.frequency.value=90;
    const gain=context.createGain();
    gain.gain.value=0;this.level=gain;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();this.set(volume,0);
    void context.resume().catch(()=>{});
  }
  set(volume:number,magnitude:number){
    if(this.context&&this.level)this.level.gain.setTargetAtTime(Math.min(.28,Math.abs(magnitude)*.16)*volume,this.context.currentTime,.065);
  }
  dispose(){
    if(this.context)void this.context.close().catch(()=>{});
    this.context=null;this.level=null;
  }
}
