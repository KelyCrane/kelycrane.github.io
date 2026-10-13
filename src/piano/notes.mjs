export const FIRST_NOTE = 21;
export const LAST_NOTE = 108;
const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const noteName = midi => `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const noteFrequency = midi => 440 * 2 ** ((midi - 69) / 12);
export const isBlack = midi => [1,3,6,8,10].includes(midi % 12);
export function makeKeyLayout() {
  let whiteIndex = 0;
  return Array.from({ length: LAST_NOTE-FIRST_NOTE+1 }, (_, index) => {
    const midi = FIRST_NOTE+index;
    const black = isBlack(midi);
    const x = black ? whiteIndex - 0.5 : whiteIndex++;
    return { midi, name: noteName(midi), black, x };
  });
}