import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makePiano } from './model';
import { makeVoid } from './void';
import { makeReferenceVoid } from './void-reference';
import { makeVoidPreview, type PreviewStyle } from './void-preview';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeKeyLayout } from './notes.mjs';
import { createPianoDriver } from './driver';
import { mountMusicPlayer } from './player';
import { mountSceneInteraction } from './interaction';
import { updateButtonIcon } from '../ui/icons.mjs';

export function mountPiano(stage: HTMLElement) {
  const status = document.querySelector<HTMLElement>('#piano-status')!;
  const loading = document.querySelector<HTMLElement>('#scene-loading')!;
  const setStatus = (message:string) => { status.textContent=message; };
  const base = stage.dataset.base || '/';
  const driver=createPianoDriver(base,setStatus);
  const {audio,active,noteOn,noteOff,releaseAll}=driver;
  const player=mountMusicPlayer(driver,base);
  let cancelInteraction=()=>{};
  function releaseManual(){cancelInteraction();driver.releaseManual();}
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'}); }
  catch { loading.textContent='当前设备无法显示三维场景，点击“靠近键盘”仍可弹奏。'; mountKeyboardOnly(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor(0xe9e3df,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','白色虚空钢琴；非琴键处单指拖动旋转，双指缩放和平移；电脑右键或 Shift 加左键拖动平移，钢琴处滚轮缩放；琴键支持多指弹奏');canvas.setAttribute('aria-describedby','piano-gesture-help');canvas.setAttribute('role','img');canvas.tabIndex=0;stage.append(canvas);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xe9e3df,15,35);
  scene.add(new THREE.HemisphereLight(0xf9efff,0x676180,2.0));
  const sun=new THREE.DirectionalLight(0xffeee5,4.2);sun.position.set(-4,8,5);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.normalBias=0.035;sun.shadow.bias=-0.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xaab9ff,1.4);fill.position.set(4,4,-4);scene.add(fill);
  const glow=new THREE.PointLight(0x6550db,1.2,5);glow.position.set(0,2.1,-0.5);scene.add(glow);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:0.15,color:0x514468}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.01;ground.receiveShadow=true;scene.add(ground);
  const piano=makePiano();scene.add(piano.group);
  const style=stage.dataset.style||'reference';
  const previewStyle=['crystal','mercury','silk'].includes(style)?style as PreviewStyle:undefined;
  let environment:THREE.WebGLRenderTarget|undefined;
  if(previewStyle){const generator=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=generator.fromScene(room,0.04);room.dispose();generator.dispose();}
  const voidScene=style==='reference'?makeReferenceVoid():previewStyle?makeVoidPreview(previewStyle,environment?.texture):makeVoid();scene.add(voidScene.group);
  const camera=new THREE.PerspectiveCamera(36,1,0.1,80);
  const controls=new OrbitControls(camera,canvas);controls.enabled=false;controls.target.set(0,1.55,-0.35);controls.minDistance=2.4;controls.maxDistance=21;controls.minPolarAngle=0.4;controls.maxPolarAngle=1.4;
  const home=new THREE.Vector3(7.7,6.6,9.2);const close=new THREE.Vector3(0,4.25,6.3);
  let cameraTween: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | undefined;
  function resetCamera() { cameraTween=undefined;camera.position.copy(home);controls.target.set(0,1.55,-0.35);if(stage.clientWidth<600)camera.position.multiplyScalar(1.25);controls.update(); }
  resetCamera();
  if(style==='reference'&&window.location.pathname.includes('/design-review/')&&new URLSearchParams(window.location.search).get('view')==='detail'){
    for(const mesh of piano.group.children){if(mesh.position.y>3.0)mesh.visible=false;}
    camera.position.set(5.8,6.9,7.5);controls.target.set(0,1.4,-0.35);controls.update();
  }
  function moveCamera(to:THREE.Vector3,target:THREE.Vector3) { cancelInteraction();cameraTween={start:performance.now(),from:camera.position.clone(),to:to.clone(),targetFrom:controls.target.clone(),targetTo:target.clone()}; }
  const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();
  function cast(point:{clientX:number;clientY:number}) { const rect=canvas.getBoundingClientRect();mouse.set((point.clientX-rect.left)/rect.width*2-1,-(point.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld();piano.group.updateMatrixWorld(true);raycaster.setFromCamera(mouse,camera); }
  function pick(point:{clientX:number;clientY:number}) { cast(point);return raycaster.intersectObjects(piano.hitKeys,false)[0]?.object.userData.midi as number|undefined; }
  const interaction=mountSceneInteraction({canvas,camera,controls,driver,pick,hitsScene:point=>{cast(point);return raycaster.intersectObjects([piano.group,voidScene.group],true).length>0;},interrupt:()=>{cameraTween=undefined;}});
  cancelInteraction=interaction.cancel;
  const panel=document.querySelector<HTMLElement>('#keyboard-panel')!;
  const closeButton=document.querySelector<HTMLButtonElement>('#piano-close')!;
  closeButton.addEventListener('click',()=>{moveCamera(close,new THREE.Vector3(0,1.4,1.0));panel.hidden=false;scrollKeyboard();});
  document.querySelector('#piano-home')?.addEventListener('click',()=>{releaseManual();panel.hidden=true;moveCamera(stage.clientWidth<600?home.clone().multiplyScalar(1.25):home,new THREE.Vector3(0,1.55,-0.35));});
  document.querySelector('#keyboard-close')?.addEventListener('click',()=>{releaseManual();panel.hidden=true;});
  const muteButton=document.querySelector<HTMLButtonElement>('#piano-mute')!;
  muteButton.addEventListener('click',()=>{const muted=muteButton.getAttribute('aria-pressed')!=='true';muteButton.setAttribute('aria-pressed',String(muted));muteButton.querySelector('span')!.textContent=muted?'取消静音':'静音';updateButtonIcon(muteButton,muted?'muted':'volume');audio.setMuted(muted);});
  document.querySelector<HTMLInputElement>('#piano-volume')?.addEventListener('input',event=>audio.setVolume(Number((event.target as HTMLInputElement).value)/100));
  populateKeyboard(noteOn,noteOff,releaseManual);
  const resize = new ResizeObserver(()=>{const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(stage);
  let visible=true,disposed=false,frame=0;const started=performance.now();let previous=started;
  function render(now:number) {
    frame=0;if(disposed || !visible || document.hidden)return;
    const delta=Math.min((now-previous)/1000,0.05);previous=now;
    if(cameraTween){const p=Math.min((now-cameraTween.start)/700,1),ease=1-Math.pow(1-p,3);camera.position.lerpVectors(cameraTween.from,cameraTween.to,ease);controls.target.lerpVectors(cameraTween.targetFrom,cameraTween.targetTo,ease);if(p===1)cameraTween=undefined;}
    for(const [midi,key] of piano.keys){const target=active.has(midi)?0.075:0;key.rotation.x=THREE.MathUtils.damp(key.rotation.x,target,28,delta);}
    voidScene.update((now-started)/1000,active.size);controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);
  }
  function resume(){if(!frame&&!disposed&&visible&&!document.hidden){previous=performance.now();frame=requestAnimationFrame(render);}}
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)releaseManual();resume();},{threshold:0});observer.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseManual();else resume();});window.addEventListener('blur',releaseManual);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();releaseManual();canvas.style.visibility='hidden';stage.classList.remove('scene-ready');loading.hidden=false;loading.textContent='三维画面已暂停，可使用“靠近键盘”继续弹奏。';});
  canvas.addEventListener('webglcontextrestored',()=>{canvas.style.visibility='';stage.classList.add('scene-ready');loading.hidden=true;resume();});
  window.addEventListener('pageshow',()=>resume());
  window.addEventListener('pagehide',(event)=>{releaseManual();if(event.persisted){releaseAll();cancelAnimationFrame(frame);frame=0;return;}disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();interaction.dispose();controls.dispose();driver.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});environment?.dispose();renderer.dispose();});
  stage.classList.add('scene-ready');loading.hidden=true;resume();
  if(import.meta.env.DEV){(stage as HTMLElement & { pianoDebug?:unknown }).pianoDebug={audio,noteOn,noteOff,releaseAll,releaseManual,active,camera,controls,player,keyAt:pick,ready:()=>audio.ready(),keyScreen:(midi:number)=>{const key=piano.hitKeys.find(k=>k.userData.midi===midi)!;camera.updateMatrixWorld();key.geometry.computeBoundingBox();const bounds=key.geometry.boundingBox!;const position=key.localToWorld(new THREE.Vector3(0,bounds.max.y+0.001,bounds.max.z*0.7)).project(camera);const rect=canvas.getBoundingClientRect();return{x:rect.left+(position.x+1)*rect.width/2,y:rect.top+(1-position.y)*rect.height/2};}};}

  return { noteOn,noteOff,releaseAll,ready:()=>audio.ready(),now:()=>audio.now() };

  function mountKeyboardOnly() {
    const fallbackAudio=audio;const panel=document.querySelector<HTMLElement>('#keyboard-panel')!;
    const release=releaseManual;
    populateKeyboard(noteOn,noteOff,release);
    if(import.meta.env.DEV){(stage as HTMLElement & {pianoDebug?:unknown}).pianoDebug={audio,active,noteOn,noteOff,releaseAll,player,ready:()=>audio.ready()};}
    document.querySelector('#piano-close')?.addEventListener('click',()=>{panel.hidden=false;scrollKeyboard();});document.querySelector('#keyboard-close')?.addEventListener('click',()=>{release();panel.hidden=true;});
    document.querySelector('#piano-home')?.addEventListener('click',()=>{release();panel.hidden=true;});
    document.querySelector<HTMLInputElement>('#piano-volume')?.addEventListener('input',event=>fallbackAudio.setVolume(Number((event.target as HTMLInputElement).value)/100));
    document.querySelector('#piano-mute')?.addEventListener('click',event=>{const button=event.currentTarget as HTMLButtonElement;const muted=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(muted));button.querySelector('span')!.textContent=muted?'取消静音':'静音';updateButtonIcon(button,muted?'muted':'volume');fallbackAudio.setMuted(muted);});
    window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});window.addEventListener('pagehide',event=>{release();if(!event.persisted)driver.dispose();});
  }
}
function scrollKeyboard(){requestAnimationFrame(()=>{const scroll=document.querySelector<HTMLElement>('.keyboard-scroll')!;scroll.scrollLeft=(scroll.scrollWidth-scroll.clientWidth)*0.48;});}
type Attack=(midi:number,velocity?:number,time?:number,source?:string)=>void;
type Release=(midi:number,time?:number,source?:string)=>void;
function populateKeyboard(on:Attack,off:Release,releaseAll:()=>void){
  const keyboard=document.querySelector<HTMLElement>('#flat-keyboard')!;
  for(const spec of makeKeyLayout()){
    const key=document.createElement('button');key.type='button';key.className=spec.black?'flat-key black':'flat-key white';key.dataset.pianoNote=String(spec.midi);key.style.left=`${spec.x*30}px`;key.setAttribute('aria-label',`弹奏 ${spec.name}`);key.innerHTML=spec.midi%12===0?`<span>${spec.name}</span>`:'';
    key.addEventListener('pointerdown',event=>{if(event.button!==0)return;key.setPointerCapture(event.pointerId);on(spec.midi,0.72,undefined,`flat:${event.pointerId}`);});
    const up=(event:PointerEvent)=>{off(spec.midi,undefined,`flat:${event.pointerId}`);};key.addEventListener('pointerup',up);key.addEventListener('pointercancel',up);key.addEventListener('lostpointercapture',up);
    key.addEventListener('keydown',event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();on(spec.midi,0.72,undefined,`accessible:${spec.midi}`);}});key.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();off(spec.midi,undefined,`accessible:${spec.midi}`);}});key.addEventListener('blur',()=>{off(spec.midi,undefined,`accessible:${spec.midi}`);});
    keyboard.append(key);
  }
  window.addEventListener('blur',()=>{releaseAll();});
}
