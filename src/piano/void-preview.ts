import * as THREE from 'three';
import { outline, BODY_Y, LID_Y } from './model';
export type PreviewStyle = 'crystal' | 'mercury' | 'silk';
const vertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const surfaceFragment = `
varying vec2 vUv; uniform float uTime; uniform vec3 uRipples[8];
void main(){vec2 p=vUv;float fog=sin(p.x*1.2+sin(p.y*1.7+uTime*0.035))*sin(p.y*0.7-uTime*0.025);vec3 c=vec3(0.006,0.007,0.02)+vec3(0.008,0.01,0.026)*(fog*0.5+0.5);for(int i=0;i<8;i++){float a=uTime-uRipples[i].z;float d=length(p-uRipples[i].xy);float r=exp(-pow((d-a*0.2)*35.0,2.0))*exp(-a*2.2)*step(0.0,a)*step(a,2.0);c+=r*vec3(0.018,0.018,0.043);}gl_FragColor=vec4(c,1.0);}`;
const lidFragment = `
varying vec2 vUv; uniform float uTime; uniform vec3 uRipples[8];
void main(){vec3 c=vec3(0.94,0.92,0.96);for(int i=0;i<8;i++){float a=uTime-uRipples[i].z;float d=length(vUv-uRipples[i].xy);float r=exp(-pow((d-a*0.14)*46.0,2.0))*exp(-a*1.7)*step(0.0,a)*step(a,1.9);c+=r*vec3(-0.06,-0.08,0.015);}gl_FragColor=vec4(c,1.0);}`;
export function makeVoidPreview(style: PreviewStyle, environment?: THREE.Texture) {
  const group=new THREE.Group();
  const ripples=Array.from({length:8},()=>new THREE.Vector3(0,0,-100));
  const surfaceMat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:surfaceFragment,uniforms:{uTime:{value:0},uRipples:{value:ripples}},side:THREE.DoubleSide});
  const lidMat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:lidFragment,uniforms:{uTime:{value:0},uRipples:{value:ripples}},side:THREE.DoubleSide});
  const surfaceGeometry=new THREE.ShapeGeometry(outline(0.907),64);surfaceGeometry.rotateX(-Math.PI/2);
  const surface=new THREE.Mesh(surfaceGeometry,surfaceMat);surface.position.y=BODY_Y+0.016;group.add(surface);
  const lid=new THREE.Mesh(surfaceGeometry,lidMat);lid.position.y=LID_Y-0.023;group.add(lid);
  const metal=style==='mercury';const flowing=style==='silk';
  const material=new THREE.MeshPhysicalMaterial({color:metal?0x252230:0xedebff,metalness:metal?0.97:0.05,roughness:metal?0.12:0.035,transmission:metal?0:0.94,thickness:0.22,ior:1.34,clearcoat:1,clearcoatRoughness:0.06,envMap:environment,envMapIntensity:metal?1.4:1.1});
  const profile=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-0.56,0),new THREE.Vector3(0.16,-0.52,0),new THREE.Vector3(0.31,-0.28,0),new THREE.Vector3(0.32,-0.03,0),new THREE.Vector3(0.21,0.22,0),new THREE.Vector3(0.075,0.53,0),new THREE.Vector3(0,0.75,0)]);
  const points=profile.getPoints(32).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y));
  const geometry=new THREE.LatheGeometry(points,32);geometry.rotateZ(Math.PI);
  const count=flowing?7:metal?12:18;
  const drops=new THREE.InstancedMesh(geometry,material,count);drops.frustumCulled=false;drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(drops);
  // Deterministic positions make the side-by-side previews comparable.
  const seeds=[[-1.28,-1.9],[-0.45,-1.75],[-1.38,-0.6],[0.7,-0.45],[-0.7,-0.95],[0.15,-2.0],[-1.65,-1.25],[-0.35,-0.35],[-1.2,-2.4],[-0.65,-2.3],[0.75,0.1],[-1.6,0.15],[0.1,-1.0],[-0.1,-0.45],[-1.05,0.15],[1.15,0.1],[-1.75,-1.9],[-0.05,-2.5]];
  const records=Array.from({length:count},(_,i)=>({x:seeds[i][0],z:seeds[i][1],phase:(i*0.61803398875)%1,speed:metal?0.105+(i%3)*0.013:0.13+(i%4)*0.012,size:metal?0.2+(i%3)*0.025:0.15+(i%3)*0.02,previous:-1}));
  const dummy=new THREE.Object3D();let ring=0;
  const flowTime={value:0};
  if(flowing){
    const flowMaterial=new THREE.MeshPhysicalMaterial({color:0xc6c2e6,roughness:0.1,metalness:0.32,transmission:0.68,thickness:0.09,ior:1.33,clearcoat:1,envMap:environment,envMapIntensity:1.2});
    flowMaterial.onBeforeCompile=shader=>{shader.uniforms.uFlowTime=flowTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uFlowTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(position.y*3.4 + uFlowTime*0.7)*0.018;');};
    for(const [x,z] of [[-1.15,-1.55],[-0.55,-0.9],[0.2,-0.38],[-0.65,-2.1]]){
      const line=new THREE.CatmullRomCurve3([new THREE.Vector3(x,BODY_Y+0.02,z),new THREE.Vector3(x+0.1,1.85,z-0.06),new THREE.Vector3(x-0.08,2.4,z+0.04),new THREE.Vector3(x+0.03,LID_Y-0.04,z)]);
      const stream=new THREE.Mesh(new THREE.TubeGeometry(line,64,0.017,12,false),flowMaterial);group.add(stream);
    }
  }
  return {group,update(time:number,_energy=0){
    surfaceMat.uniforms.uTime.value=time;lidMat.uniforms.uTime.value=time;flowTime.value=time;
    records.forEach((drop,i)=>{
      const p=(time*drop.speed+drop.phase)%1;
      if(drop.previous>=0&&p<drop.previous)ripples[ring++%8].set(drop.x,-drop.z,time);
      drop.previous=p;const fade=Math.pow(Math.sin(Math.PI*p),0.4);const travel=p*p*(3-2*p);
      dummy.position.set(drop.x+Math.sin(time*0.4+i)*0.018,BODY_Y+0.07+travel*(LID_Y-BODY_Y-0.13),drop.z);
      dummy.rotation.set(0,0,Math.sin(time*0.7+i)*0.07);
      dummy.scale.setScalar(drop.size*fade*(flowing?0.7:1));dummy.scale.y*=metal?1.12:1.35;
      dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);
    });drops.instanceMatrix.needsUpdate=true;
  }};
}