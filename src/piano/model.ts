import * as THREE from 'three';
import { makeKeyLayout } from './notes.mjs';
export const BODY_Y = 1.45;
export const LID_Y = 3.12;
export function outline(scale = 1) {
  const s = new THREE.Shape();
  s.moveTo(-2.1,-0.85); s.lineTo(2.1,-0.85); s.lineTo(2.1,-0.12);
  s.bezierCurveTo(2.12,0.65,0.2,0.98,0.34,1.58);
  s.bezierCurveTo(0.48,2.13,1.08,2.48,0.27,2.88);
  s.bezierCurveTo(-0.45,3.3,-1.76,3.05,-2.1,2.62); s.lineTo(-2.1,-0.85);
  if (scale === 1) return s;
  const points = s.getPoints(80).map(p => p.multiplyScalar(scale));
  return new THREE.Shape(points);
}
function slab(shape: THREE.Shape, depth: number, material: THREE.Material, y: number) {
  const geometry = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.018,bevelThickness:0.018,curveSegments:48});
  geometry.rotateX(-Math.PI/2);
  const mesh = new THREE.Mesh(geometry,material); mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
export function makePiano() {
  const group = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({color:0xfaf5f2,roughness:0.26,metalness:0.05,clearcoat:0.8,clearcoatRoughness:0.2});
  const ivory = new THREE.MeshPhysicalMaterial({color:0xfffcf4,roughness:0.24,clearcoat:0.6});
  const black = new THREE.MeshPhysicalMaterial({color:0x191724,roughness:0.28,clearcoat:0.8});
  const metal = new THREE.MeshStandardMaterial({color:0xb8a8bd,metalness:0.72,roughness:0.25});
  const rim = outline(); const hole = new THREE.Path(outline(0.91).getPoints(80)); rim.holes.push(hole);
  group.add(slab(rim,0.38,white,1.08));
  const bottom = slab(outline(0.91),0.08,black,1.09); group.add(bottom);
  const lid = slab(outline(),0.085,white,LID_Y); group.add(lid);
  function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material=white) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  }
  box(4.2,0.2,1.02,0,1.2,1.35);
  box(4.24,0.19,0.1,0,1.35,1.88);
  box(0.13,0.34,1.06,-2.1,1.4,1.36); box(0.13,0.34,1.06,2.1,1.4,1.36);
  const legPositions=[[-1.78,1.5],[1.78,1.5],[-1.23,-2.2]];
  for (const [x,z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.075,1.11,5),white); leg.position.set(x,0.58,z); leg.castShadow=true; group.add(leg);
    box(0.15,0.08,0.15,x,0.05,z,metal);
  }
  box(0.8,0.025,0.3,0,0.13,0.9,metal);
  for (const x of [-0.23,0,0.23]) box(0.065,0.06,0.28,x,0.15,1.16,metal);
  const keys = new Map<number,THREE.Group>(); const hitKeys: THREE.Mesh[]=[];
  const keyWidth=4.01/52;
  const whiteGeometry=new THREE.BoxGeometry(keyWidth*0.97,0.075,0.88);
  const blackGeometry=new THREE.BoxGeometry(keyWidth*0.59,0.095,0.52);
  for (const spec of makeKeyLayout()) {
    const pivot = new THREE.Group(); pivot.position.set((spec.x-25.5)*keyWidth,1.445,0.9);
    const key=new THREE.Mesh(spec.black ? blackGeometry : whiteGeometry,spec.black ? black : ivory);
    key.position.set(0,spec.black ? 0.105 : 0.012,spec.black ? 0.245 : 0.435);
    key.castShadow=true; key.receiveShadow=true; key.userData.midi=spec.midi;
    pivot.add(key); group.add(pivot); keys.set(spec.midi,pivot); hitKeys.push(key);
  }
  return { group, keys, hitKeys };
}