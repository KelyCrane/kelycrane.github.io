import * as THREE from 'three';
import { outline, BODY_Y, LID_Y } from './model';

const volumeVertex = `
varying vec2 vUv; varying vec3 vWorld;
void main(){ vUv=uv; vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }
`;
const volumeFragment = `
precision highp float;
varying vec2 vUv; varying vec3 vWorld; uniform float uTime;
float hash(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float n=0.0,a=0.55;for(int i=0;i<3;i++){n+=noise(p)*a;p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return n;}
void main(){
  float t=uTime*0.045;
  vec3 ray=normalize(vWorld-cameraPosition);
  vec2 parallax=vec2(ray.x,-ray.z)/max(abs(ray.y),0.24);
  vec2 warp=vec2(fbm(vec3(vUv*0.72,t)),fbm(vec3(vUv*0.72+6.3,-t)));
  vec3 color=vec3(0.009,0.006,0.029);
  float transmission=1.0;
  for(int i=0;i<12;i++){
    float depth=(float(i)+0.5)/12.0;
    vec2 uv=vUv+parallax*depth*0.38;
    vec3 p=vec3(uv*1.2+warp*1.35,depth*2.5-t);
    p.x+=sin(p.y*1.45+t)*0.42;
    float n=fbm(p);
    float density=smoothstep(0.36,0.76,n);
    float envelope=exp(-dot((uv-vec2(-0.65,0.8))*vec2(0.5,0.47),(uv-vec2(-0.65,0.8))*vec2(0.5,0.47)));
    float alpha=density*envelope*0.145;
    vec3 mist=mix(vec3(0.025,0.045,0.18),vec3(0.045,0.23,0.58),smoothstep(0.43,0.69,n));
    color+=transmission*alpha*mist;
    transmission*=1.0-alpha;
  }
  float edge=exp(-length(vUv-vec2(-0.5,1.0))*0.15);
  color*=edge;
  vec2 wispyUv=vUv*2.6+warp*2.7;
  float wisps=fbm(vec3(wispyUv,1.1+t*0.7));
  float folds=pow(max(0.0,1.0-abs(wisps-0.54)*10.5),3.0);
  float focus=exp(-dot((vUv-vec2(-0.65,0.9))*vec2(0.62,0.7),(vUv-vec2(-0.65,0.9))*vec2(0.62,0.7)));
  color+=vec3(0.014,0.072,0.17)*folds*focus*smoothstep(0.32,0.62,wisps);
  gl_FragColor=vec4(color,1.0);
}
`;
const streakVertex = `
attribute vec3 aTint; attribute float aOpacity;
varying vec2 vUv; varying vec3 vTint; varying float vOpacity;
void main(){
  vUv=uv; vTint=aTint; vOpacity=aOpacity;
  vec3 center=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  float width=length(instanceMatrix[0].xyz),height=length(instanceMatrix[1].xyz);
  vec3 world=center+right*position.x*width+vec3(0.0,1.0,0.0)*position.y*height;
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
}
`;
const streakFragment = `
varying vec2 vUv; varying vec3 vTint; varying float vOpacity;
void main(){
  float x=abs(vUv.x-0.5)*2.0;
  float taper=pow(sin(vUv.y*3.14159265),1.8);
  float core=exp(-x*x*95.0)*taper;
  float halo=exp(-x*x*15.0)*taper*0.16;
  float alpha=(core+halo)*vOpacity;
  if(alpha<0.006)discard;
  gl_FragColor=vec4(vTint*(0.82+core*0.28),alpha);
}
`;
const dustVertex = `
attribute float aSize; attribute float aOpacity; varying float vOpacity;
void main(){vOpacity=aOpacity;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=aSize;}
`;
const dustFragment = `
varying float vOpacity;
void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=exp(-d*d*5.0)*vOpacity;if(a<0.012)discard;gl_FragColor=vec4(0.9,0.92,1.0,a);}
`;

export function makeReferenceVoid() {
  const group=new THREE.Group();
  const shapeGeometry=new THREE.ShapeGeometry(outline(0.907),80);shapeGeometry.rotateX(-Math.PI/2);
  const volumeMaterial=new THREE.ShaderMaterial({vertexShader:volumeVertex,fragmentShader:volumeFragment,uniforms:{uTime:{value:0}},side:THREE.DoubleSide});
  const surface=new THREE.Mesh(shapeGeometry,volumeMaterial);surface.position.y=BODY_Y+0.016;group.add(surface);
  const borderPoints=outline(0.84).getPoints(90);
  function inside(x:number,y:number){let yes=false;for(let i=0,j=borderPoints.length-1;i<borderPoints.length;j=i++){const a=borderPoints[i],b=borderPoints[j];if(((a.y>y)!==(b.y>y))&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
  let seed=90717;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function location(){let x,y;do{x=random()*3.7-1.85;y=random()*3.45-0.6;}while(!inside(x,y));return{x,z:-y};}
  const count=64;
  const opacity=new THREE.InstancedBufferAttribute(new Float32Array(count),1);opacity.setUsage(THREE.DynamicDrawUsage);
  const tints=new Float32Array(count*3);
  const data=Array.from({length:count},(_,i)=>{
    const pos=location();const color=new THREE.Color(i%3===0?0xc020b5:i%3===1?0x6632ec:0x3634e5);
    color.toArray(tints,i*3);
    return{...pos,phase:random(),speed:0.1+random()*0.1,width:0.046+random()*0.026,length:0.17+random()*0.32,brightness:0.35+random()*0.6};
  });
  const streakGeometry=new THREE.PlaneGeometry(1,1);streakGeometry.setAttribute('aTint',new THREE.InstancedBufferAttribute(tints,3));streakGeometry.setAttribute('aOpacity',opacity);
  const streakMaterial=new THREE.ShaderMaterial({vertexShader:streakVertex,fragmentShader:streakFragment,transparent:true,depthWrite:false,blending:THREE.NormalBlending,side:THREE.DoubleSide,toneMapped:false});
  const streaks=new THREE.InstancedMesh(streakGeometry,streakMaterial,count);streaks.frustumCulled=false;streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(streaks);
  const dustCount=24;const dustData=Array.from({length:dustCount},()=>({...location(),phase:random(),height:0.1+random()*1.6}));
  const positions=new THREE.BufferAttribute(new Float32Array(dustCount*3),3);positions.setUsage(THREE.DynamicDrawUsage);
  const dustOpacity=new THREE.BufferAttribute(new Float32Array(dustCount),1);dustOpacity.setUsage(THREE.DynamicDrawUsage);
  const sizes=new Float32Array(dustCount);for(let i=0;i<dustCount;i++)sizes[i]=(1.5+random()*1.5)*Math.min(window.devicePixelRatio,1.8);
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',positions);dustGeometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));dustGeometry.setAttribute('aOpacity',dustOpacity);
  const dustMaterial=new THREE.ShaderMaterial({vertexShader:dustVertex,fragmentShader:dustFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const dust=new THREE.Points(dustGeometry,dustMaterial);dust.frustumCulled=false;group.add(dust);
  const dummy=new THREE.Object3D();
  return{group,update(time:number,_energy=0){
    volumeMaterial.uniforms.uTime.value=time;
    data.forEach((particle,i)=>{
      const p=(time*particle.speed+particle.phase)%1;
      const fade=Math.pow(Math.sin(Math.PI*p),0.9);
      dummy.position.set(particle.x,BODY_Y+0.07+p*(LID_Y-BODY_Y-0.13),particle.z);
      dummy.scale.set(particle.width,particle.length*(0.65+0.35*fade),1);dummy.updateMatrix();streaks.setMatrixAt(i,dummy.matrix);
      opacity.setX(i,fade*particle.brightness);
    });streaks.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;
    dustData.forEach((particle,i)=>{positions.setXYZ(i,particle.x,BODY_Y+particle.height+Math.sin(time*0.13+particle.phase*9)*0.03,particle.z);dustOpacity.setX(i,0.28+0.35*Math.pow(Math.sin(time*0.2+particle.phase*12),2));});positions.needsUpdate=true;dustOpacity.needsUpdate=true;
  }};
}