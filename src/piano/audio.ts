import type * as ToneType from 'tone';
type Voice={midi:number;source:string;time?:number;offset:number;velocity:number;node?:ToneType.ToneBufferSource;offAt?:number};
export class PianoAudio {
  private tone?:typeof ToneType;
  private buffers?:ToneType.ToneAudioBuffers;
  private gain?:ToneType.Gain;
  private context?:AudioContext;
  private initializing?:Promise<void>;
  private voices=new Map<string,Voice>();
  private sounding=new Set<Voice>();
  private visuals=new Set<{source:string;callback:()=>void}>();
  private volume=0.65;
  private muted=false;
  private disposed=false;
  private pitches=[21];
  constructor(private base:string,private status:(message:string)=>void) {}
  get loaded(){return !!this.buffers?.loaded;}
  get voiceCount(){return this.voices.size;}
  async ready(){
    if(this.disposed)throw new Error('Audio disposed');
    // Create and unlock the native context in the click/touch handler, before dynamic imports.
    this.context??=new AudioContext();
    const unlocked=this.context.resume();
    if(this.initializing){await unlocked;return this.initializing;}
    this.initializing=(async()=>{
      this.status('正在加载钢琴音色…');
      const Tone=await import('tone');
      if(!this.tone){this.tone=Tone;Tone.setContext(new Tone.Context({context:this.context!,lookAhead:0.08}));}
      await unlocked;
      if(this.disposed)return;
      this.gain=new Tone.Gain(this.muted?0:this.volume).toDestination();
      const urls:Record<number,string>={21:'A0.mp3'};
      for(let octave=1;octave<=6;octave++)for(const [offset,file] of [[0,'C'],[3,'Ds'],[6,'Fs'],[9,'A']] as const){urls[(octave+1)*12+offset]=`${file}${octave}.mp3`;}
      urls[96]='C7.mp3';this.pitches=Object.keys(urls).map(Number).sort((a,b)=>a-b);
      await new Promise<void>((resolve,reject)=>{this.buffers=new Tone.ToneAudioBuffers({urls,baseUrl:`${this.base}audio/piano/`,onload:resolve,onerror:reject});});
      if(this.disposed){this.buffers?.dispose();this.gain?.dispose();return;}
      this.status('音色就绪 · 可手动弹奏或播放曲目');
    })().catch(error=>{this.buffers?.dispose();this.gain?.dispose();this.buffers=undefined;this.gain=undefined;this.initializing=undefined;this.status('音色加载失败 · 再次弹奏琴键或点击播放重试');throw error;});
    return this.initializing;
  }
  now(){return this.context?.currentTime??0;}
  scheduleVisual(callback:()=>void,time?:number,source='manual'){
    if(this.disposed)return;
    if(time===undefined||time<=this.now()){callback();return;}
    const event={source,callback};this.visuals.add(event);
    const schedule=()=>{if(!this.visuals.has(event)||this.disposed)return;this.tone!.getDraw().schedule(()=>{if(this.visuals.delete(event)&&!this.disposed)callback();},time);};
    if(this.loaded)schedule();else void this.ready().then(schedule).catch(()=>{this.visuals.delete(event);});
  }
  noteOn(midi:number,velocity=0.72,time?:number,source='manual',offset=0){
    if(this.disposed||!Number.isInteger(midi)||midi<21||midi>108||!Number.isFinite(velocity))return;
    const key=`${midi}:${source}`,existing=this.voices.get(key);
    if(existing&&(existing.offAt===undefined||existing.offAt>this.now()))return;
    const voice:Voice={midi,source,time,offset:Math.max(0,offset),velocity:Math.min(1,Math.max(0,velocity))};this.voices.set(key,voice);
    const start=()=>{
      if(this.disposed||this.voices.get(key)!==voice||(voice.offAt!==undefined&&voice.offAt<=this.now())){if(this.voices.get(key)===voice)this.voices.delete(key);return;}
      // Same nearest-sample pitch shifting as Tone.Sampler, with independent ownership per strike.
      const pitch=this.pitches.reduce((best,p)=>Math.abs(p-midi)<Math.abs(best-midi)?p:best,this.pitches[0]);
      const buffer=this.buffers!.get(pitch),rate=2**((midi-pitch)/12),age=voice.offset*rate;
      if(age>=buffer.duration){this.voices.delete(key);return;}
      const node=new this.tone!.ToneBufferSource({url:buffer,playbackRate:rate,fadeIn:voice.offset?0.012:0,fadeOut:1.1,curve:'exponential',onended:()=>{this.sounding.delete(voice);if(this.voices.get(key)===voice)this.voices.delete(key);}}).connect(this.gain!);
      voice.node=node;this.sounding.add(voice);
      const at=Math.max(voice.time??this.now()+0.004,this.now());voice.time=at;
      node.start(at,age,(buffer.duration-age)/rate,voice.velocity);
      if(voice.offAt!==undefined)node.stop(Math.max(at,voice.offAt));
    };
    if(this.loaded&&this.context?.state==='running')start();else void this.ready().then(start).catch(()=>{if(this.voices.get(key)===voice)this.voices.delete(key);});
  }
  noteOff(midi:number,time?:number,source='manual'){
    const voice=this.voices.get(`${midi}:${source}`);if(!voice)return;
    voice.offAt=Math.max(time??this.now(),this.now());
    voice.node?.stop(Math.max(voice.time??0,voice.offAt));
    if(!voice.node&&voice.offAt<=this.now())this.voices.delete(`${midi}:${source}`);
  }
  cancelWhere(matches:(source:string)=>boolean){
    for(const event of this.visuals)if(matches(event.source))this.visuals.delete(event);
    for(const [key,voice] of this.voices)if(matches(voice.source))this.voices.delete(key);
    for(const voice of this.sounding){if(!matches(voice.source))continue;this.sounding.delete(voice);const node=voice.node!;if((voice.time??0)>this.now()){node.dispose();}else{node.fadeOut=0.025;node.stop(this.now());}}
  }
  releaseAll(){this.cancelWhere(()=>true);}
  setVolume(volume:number){this.volume=Math.min(1,Math.max(0,volume));this.gain?.gain.rampTo(this.muted?0:this.volume,0.05);}
  setMuted(muted:boolean){this.muted=muted;this.gain?.gain.rampTo(muted?0:this.volume,0.05);}
  dispose(){this.releaseAll();this.disposed=true;this.buffers?.dispose();this.gain?.dispose();void this.context?.close();}
}
