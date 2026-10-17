export function normalizeMidi(midi, options = {}) {
  const selected = options.selectedTracks ?? midi.tracks.map((_, index) => index);
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length || selected.some(index => !Number.isInteger(index) || !midi.tracks[index])) throw new Error('无效的演奏音轨选择');
  const channels = new Set(selected.map(index => midi.tracks[index].channel));
  const controls = number => midi.tracks.flatMap((track, index) => (track.controlChanges[number] || []).map(event => ({time:event.time,value:event.value,channel:track.channel,track:index}))).filter(event => channels.has(event.channel)).sort((a,b) => a.time-b.time || a.track-b.track);
  const pedals = controls(64), volumes = controls(7), expressions = controls(11);
  const valueAt = (events, channel, time) => {
    let value = 1;
    for (const event of events) { if (event.time > time + 1e-7) break; if (event.channel === channel) value = event.value; }
    return value;
  };
  const notes = selected.flatMap(trackIndex => {
    const track = midi.tracks[trackIndex];
    return track.notes.map((note,index) => {
      const start=note.time, end=start+note.duration;
      const events=pedals.filter(event=>event.channel===track.channel);
      let pedalDown=false;
      for(const event of events){if(event.time>end+1e-7)break;pedalDown=event.value>=0.5;}
      const up=pedalDown?events.find(event=>event.time>end+1e-7&&event.value<0.5):undefined;
      const soundEnd=pedalDown?(up?.time??Math.max(end,midi.duration)):end;
      const velocity=note.velocity*valueAt(volumes,track.channel,start)*valueAt(expressions,track.channel,start);
      return {id:`${trackIndex}-${index}`,midi:note.midi,start,end,soundEnd,velocity,track:trackIndex,channel:track.channel};
    });
  }).sort((a,b)=>a.start-b.start||a.midi-b.midi);
  const duration=Math.max(midi.duration,...notes.map(note=>note.soundEnd));
  const score={version:1,duration,notes,pedals,tempos:midi.header.tempos.map(tempo=>({time:tempo.time,bpm:tempo.bpm}))};
  validateScore(score);return score;
}
export function validateScore(score) {
  if(score?.version!==1||!Number.isFinite(score.duration)||score.duration<=0||!Array.isArray(score.notes)||!score.notes.length||!Array.isArray(score.pedals))throw new Error('无效乐谱');
  const ids=new Set();let previous=-Infinity;
  for(const note of score.notes){
    if(typeof note.id!=='string'||ids.has(note.id)||!Number.isInteger(note.midi)||note.midi<21||note.midi>108||![note.start,note.end,note.soundEnd,note.velocity].every(Number.isFinite)||note.start<0||note.end<=note.start||note.soundEnd<note.end||note.soundEnd>score.duration+1e-6||note.velocity<0||note.velocity>1||note.start<previous)throw new Error(`无效或超出 88 键范围的音符: ${note.id}`);
    ids.add(note.id);previous=note.start;
  }
  for(const pedal of score.pedals){if(!Number.isFinite(pedal.time)||pedal.time<0||!Number.isFinite(pedal.value)||pedal.value<0||pedal.value>1)throw new Error('无效踏板事件');}
  return score;
}
export const notesAtPosition=(score,position)=>score.notes.filter(note=>note.start<position&&note.soundEnd>position);