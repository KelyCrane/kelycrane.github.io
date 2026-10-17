/** @template {{default?:boolean,group?:string}} T @param {T[]} catalog @returns {T} */
export function defaultTrack(catalog) {
  if (!catalog.length) throw new Error('曲库为空');
  if (catalog.filter(track => track.default).length > 1) throw new Error('默认曲目重复');
  return catalog.find(track => track.default) ?? catalog[0];
}
/** @template {{group?:string}} T @param {T[]} catalog @returns {{label:string,tracks:T[]}[]} */
export function groupTracks(catalog) {
  /** @type {Map<string,T[]>} */
  const groups = new Map();
  for (const track of catalog) {
    const label = track.group || '经典曲目';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)?.push(track);
  }
  return [...groups].map(([label, tracks]) => ({label, tracks}));
}