import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import midiFile from 'midi-file';
import midiPackage from '@tonejs/midi';
import assert from 'node:assert/strict';
import {parseEop201} from './eop-format.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node scripts/convert-eop.mjs input.eop output.mid');
if(process.platform==='win32'&&!(await realpath(dirname(resolve(output)))).toLowerCase().startsWith('d:'))throw new Error('Output must be on D');
const eop=parseEop201(await readFile(input));
const ppq=30000,microsecondsPerBeat=Math.round(60000000/eop.bpm),ticksPerSecond=ppq*1000000/microsecondsPerBeat;
const conductor=[{deltaTime:0,meta:true,type:'trackName',text:'EOP source: '+eop.title},{deltaTime:0,meta:true,type:'setTempo',microsecondsPerBeat},{deltaTime:0,meta:true,type:'endOfTrack'}];
const keys=[...new Set(eop.notes.map(note=>note.scan))].sort((a,b)=>a-b);
const tracks=keys.map(scan=>{
 const events=eop.notes.filter(note=>note.scan===scan).flatMap(note=>[{tick:Math.round(note.start*ticksPerSecond),type:'noteOn',noteNumber:note.midi,velocity:note.velocity},{tick:Math.round(note.end*ticksPerSecond),type:'noteOff',noteNumber:note.midi,velocity:0}]).sort((a,b)=>a.tick-b.tick||(a.type==='noteOff'?-1:1));
 let previous=0;const track=[{deltaTime:0,meta:true,type:'trackName',text:`EOP key ${scan}`},{deltaTime:0,type:'programChange',channel:0,programNumber:0}];
 for(const {tick,...event}of events){track.push({deltaTime:tick-previous,channel:0,...event});previous=tick;}
 track.push({deltaTime:0,meta:true,type:'endOfTrack'});return track;
});
const raw=Buffer.from(midiFile.writeMidi({header:{format:1,numTracks:tracks.length+1,ticksPerBeat:ppq},tracks:[conductor,...tracks]}));
// Independently parse the generated MIDI and compare every note to the original EOP.
const parsed=new midiPackage.Midi(raw),notes=parsed.tracks.flatMap(track=>track.notes);
assert.equal(notes.length,eop.notes.length);
for(const track of parsed.tracks){if(!track.notes.length)continue;const scan=Number(track.name.replace('EOP key ','')),expected=eop.notes.filter(note=>note.scan===scan);assert.equal(track.notes.length,expected.length);for(let i=0;i<expected.length;i++){const a=track.notes[i],b=expected[i];assert.equal(a.midi,b.midi);assert.equal(Math.round(a.velocity*127),b.velocity);assert.ok(Math.abs(a.time-b.start)<=1/ticksPerSecond+1e-7);assert.ok(Math.abs(a.time+a.duration-b.end)<=1/ticksPerSecond+1e-7);}}await writeFile(output,raw);
console.log(JSON.stringify({title:eop.title,bpm:eop.bpm,notes:notes.length,events:eop.eventCount,pianoKeyTracks:keys.length,range:[Math.min(...notes.map(n=>n.midi)),Math.max(...notes.map(n=>n.midi))],duration:parsed.duration,pedalCount:0,maxQuantizationSeconds:1/ticksPerSecond,bytes:raw.length}));