import { PianoAudio } from './audio';
export function createPianoDriver(base:string,status:(message:string)=>void){
  const audio=new PianoAudio(base,status);
  const active=new Map<number,Set<string>>();
  function syncKeys(){document.querySelectorAll<HTMLButtonElement>('[data-piano-note]').forEach(button=>button.classList.toggle('pressed',active.has(Number(button.dataset.pianoNote))));}
  function noteOn(midi:number,velocity=0.72,time?:number,source='manual',offset=0){
    if(!Number.isInteger(midi)||midi<21||midi>108)return;
    audio.scheduleVisual(()=>{let sources=active.get(midi);if(!sources)active.set(midi,sources=new Set());sources.add(source);syncKeys();},time,source);
    audio.noteOn(midi,velocity,time,source,offset);
  }
  function noteOff(midi:number,time?:number,source='manual',soundTime=time){
    audio.scheduleVisual(()=>{const sources=active.get(midi);sources?.delete(source);if(!sources?.size)active.delete(midi);syncKeys();},time,source);
    audio.noteOff(midi,soundTime,source);
  }
  function releaseWhere(matches:(source:string)=>boolean){audio.cancelWhere(matches);for(const [midi,sources] of active){for(const source of sources)if(matches(source))sources.delete(source);if(!sources.size)active.delete(midi);}syncKeys();}
  function releaseSource(prefix:string){releaseWhere(source=>source.startsWith(prefix));}
  function releaseManual(){releaseWhere(source=>!source.startsWith('song:'));}
  function releaseAll(){releaseWhere(()=>true);}
  return{audio,active,noteOn,noteOff,releaseSource,releaseManual,releaseAll,ready:()=>audio.ready(),now:()=>audio.now(),dispose:()=>{releaseAll();audio.dispose();}};
}
export type PianoDriver=ReturnType<typeof createPianoDriver>;