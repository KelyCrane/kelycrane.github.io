import type * as ToneType from 'tone';
import { noteName } from './notes.mjs';
export class PianoAudio {
  private tone?: typeof ToneType;
  private sampler?: ToneType.Sampler;
  private gain?: ToneType.Gain;
  private initializing?: Promise<void>;
  private voices = new Map<number, Set<string>>();
  private generation = 0;
  private volume = 0.65;
  private muted = false;
  private disposed = false;
  constructor(private base: string, private status: (message: string) => void) {}
  async ready() {
    if (this.disposed) return;
    if (this.initializing) { await this.initializing; await this.tone?.start(); return; }
    this.initializing = (async () => {
      this.status('正在加载钢琴音色…');
      const Tone = await import('tone'); this.tone = Tone;
      await Tone.start();
      if (this.disposed) return;
      this.gain = new Tone.Gain(this.muted ? 0 : this.volume).toDestination();
      const urls: Record<string,string> = { A0: 'A0.mp3' };
      for (let octave = 1; octave <= 6; octave++) {
        for (const [note,file] of [['C','C'],['D#','Ds'],['F#','Fs'],['A','A']]) urls[`${note}${octave}`] = `${file}${octave}.mp3`;
      }
      urls.C7 = 'C7.mp3';
      await new Promise<void>((resolve,reject) => {
        this.sampler = new Tone.Sampler({ urls, baseUrl: `${this.base}audio/piano/`, release: 1.1, onload: resolve, onerror: () => reject(new Error('音色文件加载失败')) }).connect(this.gain!);
      });
      if (this.disposed) { this.sampler?.dispose(); this.gain?.dispose(); return; }
      this.status('音色就绪 · 点击黑白键弹奏');
    })().catch(error => {
      this.sampler?.dispose(); this.gain?.dispose(); this.sampler = undefined; this.initializing = undefined;
      this.status('音色加载失败 · 再次点击琴键或“音色”可重试'); throw error;
    });
    return this.initializing;
  }
  now() { return this.tone?.now() ?? 0; }
  scheduleVisual(callback:()=>void, time?:number) {
    if (time === undefined || time <= this.now()) { callback(); return; }
    const generation = this.generation;
    void this.ready().then(()=>{
      if(this.disposed || generation !== this.generation)return;
      this.tone!.getDraw().schedule(()=>{if(!this.disposed && generation === this.generation)callback();},Math.max(time,this.now()));
    }).catch(()=>{});
  }
  // time is seconds on the audio clock. Scheduled voices need unique source IDs.
  noteOn(midi:number, velocity=0.72, time?:number, source='manual') {
    if(this.disposed || !Number.isInteger(midi) || midi<21 || midi>108 || !Number.isFinite(velocity))return;
    let voices=this.voices.get(midi);if(!voices)this.voices.set(midi,voices=new Set());
    if(voices.has(source))return;voices.add(source);
    const generation=this.generation;
    void this.ready().then(()=>{
      if(this.disposed || generation!==this.generation || !this.voices.get(midi)?.has(source))return;
      this.sampler?.triggerAttack(noteName(midi),time===undefined?undefined:Math.max(time,this.now()),Math.min(1,Math.max(0.01,velocity)));
    }).catch(()=>{});
  }
  noteOff(midi:number,time?:number,source='manual') {
    const release=()=>{const voices=this.voices.get(midi);voices?.delete(source);if(!voices?.size){this.voices.delete(midi);this.sampler?.triggerRelease(noteName(midi));}};
    this.scheduleVisual(release,time);
  }
  releaseAll() { this.generation++;this.voices.clear();this.sampler?.releaseAll(); }
  setVolume(volume:number) { this.volume=Math.min(1,Math.max(0,volume));this.gain?.gain.rampTo(this.muted?0:this.volume,0.05); }
  setMuted(muted:boolean) { this.muted=muted;this.gain?.gain.rampTo(muted?0:this.volume,0.05); }
  dispose() { this.disposed=true;this.releaseAll();this.sampler?.dispose();this.gain?.dispose(); }
}