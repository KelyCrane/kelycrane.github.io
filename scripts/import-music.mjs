import midiPackage from '@tonejs/midi';
import { readFile,writeFile,realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeMidi } from '../src/piano/score.mjs';
const { Midi }=midiPackage;
const directory=await realpath(resolve('public/music'));
if(process.platform==='win32'&&!directory.toLowerCase().startsWith('d:'))throw new Error('Music must be stored on D');
const catalog=JSON.parse(await readFile('src/data/music.json','utf8'));
for(const track of catalog){
 const raw=await readFile(resolve('public',track.original));
 if(raw.subarray(0,4).toString()!=='MThd')throw new Error('Invalid original MIDI');
 const midi=new Midi(raw);const score=normalizeMidi(midi);
 const encoded=JSON.stringify({...score,id:track.id,license:track.license,sourceUrl:track.sourceUrl});
 await writeFile(resolve('public',track.score),encoded);
 Object.assign(track,{duration:score.duration,noteCount:score.notes.length,pedalCount:score.pedals.length,originalSha256:createHash('sha256').update(raw).digest('hex')});
 console.log(`${track.id}: ${score.notes.length} notes; ${score.duration.toFixed(2)}s; range ${Math.min(...score.notes.map(n=>n.midi))}–${Math.max(...score.notes.map(n=>n.midi))}; ${score.pedals.length} pedal events`);
}
await writeFile('src/data/music.json',JSON.stringify(catalog,null,2)+'\n');
await writeFile('public/music/CREDITS.json',JSON.stringify(catalog,null,2)+'\n');