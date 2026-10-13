import * as THREE from 'three';
import { outline, BODY_Y, LID_Y } from './model';
const vertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment = `
precision highp float;
varying vec2 vUv; uniform float uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.01+0.13;a*=0.5;}return v;}
void main(){vec2 p=vUv*1.4;float t=uTime*0.085;vec2 q=vec2(fbm(p+t),fbm(p+vec2(3.7,-t)));float n=fbm(p*2.0+q*2.7+vec2(t,-t));float cloud=smoothstep(0.35,0.85,n);vec3 col=mix(vec3(0.014,0.013,0.045),vec3(0.07,0.1,0.25),cloud);float filament=pow(max(0.0,1.0-abs(n-0.59)*15.0),5.0);col+=vec3(0.07,0.035,0.16)*filament;vec2 grid=floor(vUv*60.0);float star=step(0.995,hash(grid));float point=pow(max(0.0,1.0-length(fract(vUv*60.0)-0.5)*2.0),8.0);col+=star*point*vec3(0.35,0.32,0.6)*(0.6+0.4*sin(uTime+hash(grid)*30.0));gl_FragColor=vec4(col,1.0);}`;
const rippleFragment = `varying vec2 vUv; uniform float uTime; uniform vec3 uRipples[8];void main(){vec3 col=vec3(0.94,0.91,0.96);float glow=0.0;for(int i=0;i<8;i++){float age=uTime-uRipples[i].z;float d=length(vUv-uRipples[i].xy);float ring=exp(-pow((d-age*0.23)*22.0,2.0));glow+=ring*max(0.0,1.0-age/2.0)*step(0.0,age)*step(age,2.0);}gl_FragColor=vec4(col+glow*vec3(-0.18,-0.23,0.09),1.0);}`;
export function makeVoid() {
  const group=new THREE.Group();
  const geometry=new THREE.ShapeGeometry(outline(0.907),64); geometry.rotateX(-Math.PI/2);
  const voidMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(geometry,voidMat); surface.position.y=BODY_Y+0.015; group.add(surface);
  const rippleUniforms=Array.from({length:8},()=>new THREE.Vector3(0,0,-100));
  const lidMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uRipples:{value:rippleUniforms}},vertexShader:vertex,fragmentShader:rippleFragment,side:THREE.DoubleSide});
  const underside=new THREE.Mesh(geometry,lidMat); underside.position.y=LID_Y-0.021; group.add(underside);
  const count=64;
  const material=new THREE.MeshPhysicalMaterial({color:0x7770de,emissive:0x332078,emissiveIntensity:0.36,metalness:0.32,roughness:0.12,transparent:true,opacity:0.72,clearcoat:1});
  const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,10),material,count);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); drops.frustumCulled=false; group.add(drops);
  const points=outline(0.85).getPoints(80);
  function inside(x:number,y:number){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a.y>y)!==(b.y>y)) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
  const data=Array.from({length:count},()=>{let x,y;do{x=(Math.random()-0.5)*3.6;y=Math.random()*3.4-0.65;}while(!inside(x,y));return{x,z:-y,speed:0.17+Math.random()*0.16,offset:Math.random(),size:0.013+Math.random()*0.018,previous:0};});
  const dummy=new THREE.Object3D();let rippleIndex=0;
  return { group, update(time:number, energy=0) {
    voidMat.uniforms.uTime.value=time;lidMat.uniforms.uTime.value=time;
    data.forEach((drop,i)=>{
      const p=(time*drop.speed+drop.offset)%1;
      if(p<drop.previous){rippleUniforms[rippleIndex++%8].set(drop.x,-drop.z,time);}
      drop.previous=p;
      const travel=p*p*(3-2*p);
      dummy.position.set(drop.x+Math.sin(time*0.5+i)*0.025,BODY_Y+0.03+travel*(LID_Y-BODY_Y-0.05),drop.z);
      const fade=Math.sin(Math.PI*p);
      dummy.scale.set(drop.size*fade,drop.size*(2.2+Math.sin(p*Math.PI)*2.5)*(1+energy*0.2),drop.size*fade);
      dummy.updateMatrix(); drops.setMatrixAt(i,dummy.matrix);
    });drops.instanceMatrix.needsUpdate=true;
  }};
}