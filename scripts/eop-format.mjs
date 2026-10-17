// Format reference: https://github.com/emizuki/eop2midi/blob/main/specification.md
// Original strict reader for the EOP 2.01 prefixed-section format used by this score.
export function parseEop201(raw) {
 const mask=[113,114,115,116,114,115,116,117,115,116,117,118,116,117,118,119,117,118,119,120,118,119,120,121,119,120,121,122,120,121,122,123];
 const d=Buffer.from(raw.map((byte,index)=>byte^mask[index%32]));
 const fail=message=>{throw new Error(`EOP: ${message}`);};
 if(d.length<444||d.subarray(0,13).toString()!=='EveryonePiano')fail('invalid signature');
 if(d.readUInt32LE(16)!==201)fail('only version 2.01 is supported');
 const bpm=d.readUInt32LE(28);if(bpm<1||bpm>1000)fail('invalid tempo');
 const end=440+d.readUInt32LE(40);if(end<444||end>d.length||(d.length-end)%16||d.readUInt32LE(44)!==d.length-end)fail('invalid section boundaries');
 const mappings=new Map();let cursor=440;
 while(cursor<end){
  const size=d.readUInt32LE(cursor),start=cursor+4;
  if(size<28||(size-28)%42||start+size>end)fail('unsupported mapping layout');
  for(let offset=start+28;offset<start+size;offset+=42){
   const scan=d[offset+4],action=d.readUInt16LE(offset+32),pitch=d.readUInt16LE(offset+34);
   if(!mappings.has(scan))mappings.set(scan,{pitches:new Set(),control:false});
   const mapping=mappings.get(scan);
   if(action===0x90){if(pitch<21||pitch>108)fail('pitch outside A0–C8');mapping.pitches.add(pitch);}else mapping.control=true;
  }
  cursor=start+size;
 }
 const notes=[],held=new Map();let previous=-Infinity,eventCount=0;
 for(let offset=end;offset<d.length;offset+=16){
  const time=d.readDoubleLE(offset)/1000,status=d[offset+8],scan=d[offset+9],velocity=d[offset+10];
  if(!Number.isFinite(time)||time<previous||time<0||d.subarray(offset+11,offset+16).some(byte=>byte))fail('invalid time or reserved bytes');
  previous=time;
  if(offset===d.length-16){if(d.subarray(offset+8,offset+16).some(byte=>byte))fail('invalid final terminator');continue;}
  if(status!==0x80&&status!==0x90)fail('unknown event status');
  const mapping=mappings.get(scan);if(!mapping||mapping.control||!mapping.pitches.size)fail(`unmapped/control event ${scan}; no events may be discarded`);
  if(velocity>127||(status===0x90&&velocity===0))fail('invalid note velocity');
  eventCount++;
  if(status===0x90){if(held.has(scan))fail('overlapping press of same source key');held.set(scan,{time,velocity});}
  else {const on=held.get(scan);if(!on||time<=on.time)fail('unpaired or zero-duration note');for(const pitch of mapping.pitches)notes.push({scan,midi:pitch,start:on.time,end:time,velocity:on.velocity});held.delete(scan);}
 }
 if(held.size||!notes.length)fail('unreleased or empty notes');
 const title=new TextDecoder('gb18030').decode(d.subarray(308,372)).replace(/\0.*$/s,'');
 return {title,bpm,notes:notes.sort((a,b)=>a.start-b.start||a.midi-b.midi),eventCount,duration:previous,pedalCount:0};
}