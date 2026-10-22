import music from '../data/music.json';
import { defaultTrack } from './catalog.mjs';
import { PlaybackTransport } from './transport.mjs';
import { validateScore } from './score.mjs';
import type { PianoDriver } from './driver';
import { updateButtonIcon } from '../ui/icons.mjs';
export function mountMusicPlayer(driver:PianoDriver,base:string){
  const panel=document.querySelector<HTMLElement>('#music-panel')!;
  const toggle=document.querySelector<HTMLButtonElement>('#music-toggle')!;
  const select=document.querySelector<HTMLSelectElement>('#music-track')!;
  const play=document.querySelector<HTMLButtonElement>('#music-play')!;
  const progress=document.querySelector<HTMLInputElement>('#music-progress')!;
  const status=document.querySelector<HTMLElement>('#music-status')!;
  const composer=document.querySelector<HTMLElement>('#music-composer')!;
  const elapsed=document.querySelector<HTMLElement>('#music-elapsed')!;
  const duration=document.querySelector<HTMLElement>('#music-duration')!;
  let selected=defaultTrack(music),pending=false,error='',revision=0,disposed=false,scrubbing=false,scrubPlaying=false;
  let abort:AbortController|undefined;
  const cache=new Map<string,ReturnType<typeof validateScore>>();
  const format=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const transport=new PlaybackTransport(driver,()=>render());
  function render(){
    if(disposed)return;
    const playing=transport.state==='playing';
    const label=pending?'取消':playing?'暂停':error?'重试':'播放';
    updateButtonIcon(play,pending?'loading':playing?'pause':error?'retry':'play');
    if(play.querySelector('span')!.textContent!==label)play.querySelector('span')!.textContent=label;
    play.setAttribute('aria-busy',String(pending));
    play.setAttribute('aria-label',`${label}所选曲目`);
    panel.dataset.state=pending?'loading':error?'error':transport.state;
    if(!scrubbing){progress.value=String(transport.position);elapsed.textContent=format(transport.position);}
    progress.max=String(selected.duration);progress.disabled=pending||!transport.score;
    progress.setAttribute('aria-valuetext',`${format(Number(progress.value))} / ${format(selected.duration)}`);
    duration.textContent=format(selected.duration);composer.textContent=selected.composer;
    const message=error||(pending?'正在准备乐谱与钢琴音色…':playing?'正在自动演奏 · 你也可以一起弹。':transport.state==='paused'?'已暂停 · 点击播放继续。':transport.state==='ended'?'本曲演奏完毕 · 点击播放可重听。':'点击播放，观看钢琴自动演奏。');
    if(status.textContent!==message)status.textContent=message;
  }
  function cancelPending(){revision++;abort?.abort();abort=undefined;pending=false;}
  async function start(){
    cancelPending();const current=revision;pending=true;error='';render();
    // Start audio unlocking directly from the user gesture, in parallel with the score fetch.
    const audioReady=driver.ready();
    const track=selected;abort=new AbortController();
    const scoreReady=(async()=>{
      if(cache.has(track.id))return cache.get(track.id)!;
      const response=await fetch(`${base}${track.score}`,{signal:abort!.signal});
      if(!response.ok)throw new Error('乐谱加载失败');
      const score=validateScore(await response.json());
      if(score.id!==track.id||Math.abs(score.duration-track.duration)>0.01)throw new Error('乐谱版本不一致');
      cache.set(track.id,score);return score;
    })();
    try{
      const [score]=await Promise.all([scoreReady,audioReady]);
      if(disposed||current!==revision||document.hidden)return;
      pending=false;abort=undefined;if(transport.score!==score)transport.setScore(score);transport.play();
    }catch(reason){if(current!==revision||disposed)return;pending=false;transport.pause();error='乐谱或音色加载失败，点击重试。';console.warn('Piano playback preparation failed',reason);}
    finally{if(current===revision&&!disposed){pending=false;render();}}
  }
  function pause(){cancelPending();transport.pause();render();}
  function setOpen(open:boolean){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)panel.focus({preventScroll:true});}
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  document.querySelector('#music-close')?.addEventListener('click',()=>{setOpen(false);toggle.focus();});
  document.querySelector('#piano-close')?.addEventListener('click',()=>setOpen(false));
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);toggle.focus();}});
  play.addEventListener('click',()=>{if(pending||transport.state==='playing')pause();else void start();});
  document.querySelector('#music-stop')?.addEventListener('click',()=>{cancelPending();error='';scrubbing=false;transport.stop();render();});
  select.addEventListener('change',()=>{const resume=transport.state==='playing'||pending;cancelPending();transport.stop();transport.score=null;selected=music.find(track=>track.id===select.value)!;error='';scrubbing=false;render();if(resume)void start();});
  document.querySelector('#music-loop')?.addEventListener('click',event=>{transport.loop=!transport.loop;(event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed',String(transport.loop));});
  progress.addEventListener('input',()=>{if(!scrubbing){scrubbing=true;scrubPlaying=transport.state==='playing';transport.pause();}elapsed.textContent=format(Number(progress.value));progress.setAttribute('aria-valuetext',`${format(Number(progress.value))} / ${format(selected.duration)}`);});
  function commitSeek(){if(!scrubbing)return;const position=Number(progress.value);scrubbing=false;transport.seek(position);if(scrubPlaying&&!document.hidden)transport.play();scrubPlaying=false;render();}
  progress.addEventListener('change',commitSeek);progress.addEventListener('pointercancel',()=>{scrubPlaying=false;commitSeek();});progress.addEventListener('blur',commitSeek);
  function background(){if(pending||transport.state==='playing')pause();if(scrubbing){scrubPlaying=false;commitSeek();}driver.releaseManual();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});window.addEventListener('blur',background);
  window.addEventListener('pagehide',event=>{cancelPending();transport.stop();if(!event.persisted){disposed=true;transport.dispose();}});
  render();
  return{transport,pause,stop:()=>{cancelPending();transport.stop();},get pending(){return pending;}};
}
