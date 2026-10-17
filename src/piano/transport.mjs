import { notesAtPosition,validateScore } from './score.mjs';
export class PlaybackTransport {
  constructor(driver,changed=()=>{},timers={setInterval:(callback,ms)=>setInterval(callback,ms),clearInterval:id=>clearInterval(id)}){this.driver=driver;this.changed=changed;this.timers=timers;this.score=null;this.state='idle';this.offset=0;this.origin=0;this.cursor=0;this.run=0;this.loop=false;this.timer=null;}
  get duration(){return this.score?.duration??0;}
  get position(){return this.state==='playing'?Math.min(this.duration,Math.max(this.offset,this.driver.now()-this.origin)):this.offset;}
  setScore(score){this.stop();this.score=validateScore(score);this.changed();}
  schedule(note,at,offset=0){const source=`song:${this.run}:${note.id}`;this.driver.noteOn(note.midi,note.velocity,at,source,offset);this.driver.noteOff(note.midi,Math.max(at,this.origin+note.end),source,this.origin+note.soundEnd);}
  play(){
    if(!this.score||this.state==='playing')return;
    if(this.offset>=this.duration)this.offset=0;
    this.run++;this.state='playing';const at=this.driver.now()+0.04;this.origin=at-this.offset;
    for(const note of notesAtPosition(this.score,this.offset))this.schedule(note,at,this.offset-note.start);
    this.cursor=this.score.notes.findIndex(note=>note.start>=this.offset);if(this.cursor<0)this.cursor=this.score.notes.length;
    this.pump();this.timer=this.timers.setInterval(()=>this.pump(),25);this.changed();
  }
  pump(){
    if(this.state!=='playing')return;
    const horizon=this.driver.now()-this.origin+0.14;
    while(this.cursor<this.score.notes.length&&this.score.notes[this.cursor].start<=horizon){const note=this.score.notes[this.cursor++];const position=this.driver.now()-this.origin;if(note.soundEnd<=position)continue;this.schedule(note,Math.max(this.driver.now(),this.origin+note.start),Math.max(0,position-note.start));}
    if(this.driver.now()-this.origin>=this.duration){this.clearTimer();this.offset=this.duration;this.state='ended';if(this.loop){this.driver.releaseSource('song:');this.offset=0;this.play();}else this.changed();}
    else this.changed();
  }
  clearTimer(){if(this.timer!==null)this.timers.clearInterval(this.timer);this.timer=null;}
  pause(){if(this.state==='playing')this.offset=this.position;this.clearTimer();this.driver.releaseSource('song:');if(this.score)this.state='paused';this.changed();}
  stop(){this.clearTimer();this.driver.releaseSource('song:');this.offset=0;this.state='idle';this.changed();}
  seek(position){const playing=this.state==='playing';this.pause();this.offset=Math.min(this.duration,Math.max(0,position));if(playing)this.play();else this.changed();}
  dispose(){this.stop();this.score=null;}
}