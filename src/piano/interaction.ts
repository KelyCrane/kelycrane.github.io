import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PianoDriver } from './driver';

type Point = { clientX: number; clientY: number };
type Contact = { x: number; y: number; touch: boolean; pan: boolean; midi?: number };

/** Own pointer routing so key presses never enter OrbitControls' DOM gesture state. */
export function mountSceneInteraction({ canvas, camera, controls, driver, pick, hitsScene, interrupt }: {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  driver: PianoDriver;
  pick: (point: Point) => number | undefined;
  hitsScene: (point: Point) => boolean;
  interrupt: () => void;
}) {
  controls.enabled = false;
  controls.enableDamping = false;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.screenSpacePanning = true;
  const contacts = new Map<number, Contact>();
  let playingSession = false;
  const listeners = new AbortController();
  const signal = listeners.signal;
  const minTarget = new THREE.Vector3(-3.2, 0.6, -3.8);
  const maxTarget = new THREE.Vector3(3.2, 3.2, 2.8);

  function constrain() {
    const original = controls.target.clone();
    controls.target.clamp(minTarget, maxTarget);
    camera.position.add(controls.target.clone().sub(original));
    controls.update();
  }
  function release(id: number) {
    const contact = contacts.get(id);
    if (!contact) return;
    contacts.delete(id);
    if (contact.midi !== undefined) driver.noteOff(contact.midi, undefined, `pointer:${id}`);
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    if (!contacts.size) { playingSession = false; canvas.style.cursor = 'grab'; }
  }
  function cancel() { for (const id of [...contacts.keys()]) release(id); }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    interrupt();
    const touch = event.pointerType === 'touch';
    const pan = !touch && (event.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey);
    const midi = pan ? undefined : pick(event);
    contacts.set(event.pointerId, { x: event.clientX, y: event.clientY, touch, pan, midi });
    canvas.setPointerCapture(event.pointerId);
    if (midi !== undefined) {
      playingSession = true;
      driver.noteOn(midi, 0.72, undefined, `pointer:${event.pointerId}`);
    }
    canvas.style.cursor = midi !== undefined ? 'pointer' : 'grabbing';
  }, { signal });

  canvas.addEventListener('pointermove', event => {
    const contact = contacts.get(event.pointerId);
    if (!contact) {
      if (event.pointerType !== 'touch') canvas.style.cursor = pick(event) !== undefined ? 'pointer' : 'grab';
      return;
    }
    event.preventDefault();
    const dx = event.clientX - contact.x, dy = event.clientY - contact.y;
    const touches = [...contacts.values()].filter(item => item.touch);
    const pair = contact.touch && touches.length === 2 ? touches : undefined;
    const oldDistance = pair ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
    contact.x = event.clientX; contact.y = event.clientY;
    if (playingSession) return;
    if (pair) {
      const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      if (oldDistance > 4 && distance > 4) controls.dollyOut(distance / oldDistance);
      controls.pan(dx / 2, dy / 2);
    } else if (contacts.size === 1) {
      if (contact.pan) controls.pan(dx, dy);
      else {
        const height = Math.max(canvas.clientHeight, 1);
        controls.rotateLeft(2 * Math.PI * dx / height);
        controls.rotateUp(2 * Math.PI * dy / height);
      }
    }
    constrain();
  }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => release((event as PointerEvent).pointerId), { signal });
  }
  canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
  canvas.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || !hitsScene(event)) return;
    event.preventDefault();
    if (contacts.size) return;
    interrupt();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const delta = THREE.MathUtils.clamp(event.deltaY * units, -240, 240);
    controls.dollyIn(Math.exp(delta * 0.0018));
    constrain();
  }, { passive: false, signal });
  return { cancel, dispose() { cancel(); listeners.abort(); } };
}
