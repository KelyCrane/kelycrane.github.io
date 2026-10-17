import midiPackage from '@tonejs/midi';
import { readFile,writeFile,realpath } from 'node:fs/promises';
import { resolve,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeMidi } from '../src/piano/score.mjs';
const { Midi }=midiPackage;
const directory=await realpath(resolve('public/music'));
if(process.platform==='win32'&&!directory.toLowerCase().startsWith('d:'))throw new Error('Music must be stored on D');
const catalog=JSON.parse(await readFile('src/data/music.json','utf8'));
const prepared=[];
for(const track of catalog){
 const path=await realpath(resolve('public',track.original));
 if(relative(directory,path).startsWith('..'))throw new Error('MIDI outside music directory');
 const raw=await readFile(path);
 if(raw.subarray(0,4).toString()!=='MThd')throw new Error(`${track.id}: invalid original MIDI`);
 const midi=new Midi(raw);
 const selected=track.selectedTracks??midi.tracks.map((_,index)=>index);
 const fingerprints=new Set();
 for(const index of selected){
  const part=midi.tracks[index];if(!part)throw new Error(`${track.id}: missing track ${index}`);
  if(!part.notes.length)continue;
  if(part.channel===9)throw new Error(`${track.id}: percussion cannot be a piano part`);
  if(part.instrument.number>5&&!track.pianoNotation)throw new Error(`${track.id}: non-piano track ${index} needs a verified piano score`);
  const signature=JSON.stringify(part.notes.map(n=>[n.midi,n.ticks,n.durationTicks]));
  if(fingerprints.has(signature))throw new Error(`${track.id}: duplicate exported track ${index}`);
  fingerprints.add(signature);
 }
 const excluded=midi.tracks.map((part,index)=>({part,index})).filter(({part,index})=>part.notes.length&&!selected.includes(index));
 for(const {index} of excluded)if(!track.excludedTracks?.[index])throw new Error(`${track.id}: excluded track ${index} needs a reason`);
 const score=normalizeMidi(midi,{selectedTracks:selected});
 const expectedCount=selected.reduce((count,index)=>count+midi.tracks[index].notes.length,0);
 if(score.notes.length!==expectedCount)throw new Error(`${track.id}: note count mismatch`);
 Object.assign(track,{sourceLabel:track.sourceLabel??`Mutopia ${track.mutopiaId}`,group:track.group??'经典曲目',duration:score.duration,noteCount:score.notes.length,pedalCount:score.pedals.length,originalSha256:createHash('sha256').update(raw).digest('hex'),rawNoteCount:midi.tracks.reduce((count,part)=>count+part.notes.length,0),selectedTracks:selected,conversion:'使用 @tonejs/midi 按原速度图转换为秒制音符；保留音高、时值和 CC64 延音，按通道在起音时将 CC7 音量与 CC11 表情乘入原始力度；只排除记录了理由的非演奏轨道，不删演奏音符、不移调。'});
 const encoded=JSON.stringify({...score,id:track.id,license:track.license,sourceUrl:track.sourceUrl});
 prepared.push({track,encoded});
 console.log(`${track.id}: ${score.notes.length}/${track.rawNoteCount} notes; ${score.duration.toFixed(2)}s; range ${Math.min(...score.notes.map(n=>n.midi))}–${Math.max(...score.notes.map(n=>n.midi))}; ${score.pedals.length} pedal events`);
}
// Validate the whole catalogue before replacing any converted score.
for(const {track,encoded} of prepared)await writeFile(resolve('public',track.score),encoded);
await writeFile('src/data/music.json',JSON.stringify(catalog,null,2)+'\n');
await writeFile('public/music/CREDITS.json',JSON.stringify(catalog,null,2)+'\n');