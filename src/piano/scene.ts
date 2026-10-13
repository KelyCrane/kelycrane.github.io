import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makePiano } from './model';
import { makeVoid } from './void';
import { makeKeyLayout } from './notes.mjs';
import { PianoAudio } from './audio';

export function mountPiano(stage: HTMLElement) {
  const status = document.querySelector<HTMLElement>('#piano-status')!;
  const loading = document.querySelector<HTMLElement>('#scene-loading')!;
  const setStatus = (message:string) => { status.textContent=message; };
  const base = stage.dataset.base || '/';
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'}); }
  catch { loading.textContent='当前设备无法显示三维场景，点击“靠近键盘”仍可弹奏。'; mountKeyboardOnly(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor(0xe9e3df,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','白色虚空钢琴；拖动空白处旋转，点击琴键弹奏');canvas.setAttribute('role','img');canvas.tabIndex=0;stage.append(canvas);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xe9e3df,15,35);
  scene.add(new THREE.HemisphereLight(0xf9efff,0x676180,2.0));
  const sun=new THREE.DirectionalLight(0xffeee5,4.2);sun.position.set(-4,8,5);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.normalBias=0.035;sun.shadow.bias=-0.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xaab9ff,1.4);fill.position.set(4,4,-4);scene.add(fill);
  const glow=new THREE.PointLight(0x6550db,1.2,5);glow.position.set(0,2.1,-0.5);scene.add(glow);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:0.15,color:0x514468}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.01;ground.receiveShadow=true;scene.add(ground);
  const piano=makePiano();scene.add(piano.group);const voidScene=makeVoid();scene.add(voidScene.group);
  const camera=new THREE.PerspectiveCamera(36,1,0.1,80);
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.55,-0.35);controls.enableDamping=true;controls.dampingFactor=0.07;controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=0.4;controls.maxPolarAngle=1.4;
  const home=new THREE.Vector3(7.7,6.6,9.2);const close=new THREE.Vector3(0,4.25,6.3);
  let cameraTween: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | undefined;
  const active=new Map<number,Set<string>>(); const pointerNotes=new Map<number,number>();
  const audio=new PianoAudio(base,setStatus);
  function noteOn(midi:number,velocity=0.72,time?:number,source='manual') { audio.scheduleVisual(()=>{let sources=active.get(midi);if(!sources)active.set(midi,sources=new Set());sources.add(source);syncKeys();},time);audio.noteOn(midi,velocity,time,source); }
  function noteOff(midi:number,time?:number,source='manual') { audio.scheduleVisual(()=>{const sources=active.get(midi);sources?.delete(source);if(!sources?.size)active.delete(midi);syncKeys();},time);audio.noteOff(midi,time,source); }
  function releaseAll() { active.clear();pointerNotes.clear();audio.releaseAll();syncKeys(); }
  function syncKeys() { document.querySelectorAll<HTMLButtonElement>('[data-piano-note]').forEach(button=>button.classList.toggle('pressed',active.has(Number(button.dataset.pianoNote)))); }
  function resetCamera() { cameraTween=undefined;camera.position.copy(home);controls.target.set(0,1.55,-0.35);if(stage.clientWidth<600)camera.position.multiplyScalar(1.25);controls.update(); }
  resetCamera();
  function moveCamera(to:THREE.Vector3,target:THREE.Vector3) { cameraTween={start:performance.now(),from:camera.position.clone(),to:to.clone(),targetFrom:controls.target.clone(),targetTo:target.clone()}; }
  const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();
  function pick(event:PointerEvent) { const rect=canvas.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(piano.hitKeys,false)[0]?.object.userData.midi as number|undefined; }
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const midi=pick(event);
    if(midi!==undefined){event.stopImmediatePropagation();event.preventDefault();canvas.setPointerCapture(event.pointerId);pointerNotes.set(event.pointerId,midi);noteOn(midi,0.72,undefined,`pointer:${event.pointerId}`);}
    else if(pointerNotes.size){event.stopImmediatePropagation();}
    else cameraTween=undefined;
  },true);
  function releasePointer(event:PointerEvent) { const midi=pointerNotes.get(event.pointerId);if(midi!==undefined){event.stopImmediatePropagation();noteOff(midi,undefined,`pointer:${event.pointerId}`);pointerNotes.delete(event.pointerId);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);} }
  canvas.addEventListener('pointerup',releasePointer,true);canvas.addEventListener('pointercancel',releasePointer,true);canvas.addEventListener('lostpointercapture',releasePointer,true);
  canvas.addEventListener('pointermove',event=>{if(pointerNotes.has(event.pointerId)){event.stopImmediatePropagation();return;}canvas.style.cursor=pick(event)!==undefined?'pointer':'grab';},true);
  const panel=document.querySelector<HTMLElement>('#keyboard-panel')!;
  const closeButton=document.querySelector<HTMLButtonElement>('#piano-close')!;
  closeButton.addEventListener('click',()=>{moveCamera(close,new THREE.Vector3(0,1.4,1.0));panel.hidden=false;scrollKeyboard();});
  document.querySelector('#piano-home')?.addEventListener('click',()=>{releaseAll();panel.hidden=true;moveCamera(stage.clientWidth<600?home.clone().multiplyScalar(1.25):home,new THREE.Vector3(0,1.55,-0.35));});
  document.querySelector('#keyboard-close')?.addEventListener('click',()=>{releaseAll();panel.hidden=true;});
  document.querySelector('#piano-enable')?.addEventListener('click',()=>{void audio.ready().catch(()=>{});});
  const muteButton=document.querySelector<HTMLButtonElement>('#piano-mute')!;
  muteButton.addEventListener('click',()=>{const muted=muteButton.getAttribute('aria-pressed')!=='true';muteButton.setAttribute('aria-pressed',String(muted));muteButton.querySelector('span')!.textContent=muted?'取消静音':'静音';audio.setMuted(muted);});
  document.querySelector<HTMLInputElement>('#piano-volume')?.addEventListener('input',event=>audio.setVolume(Number((event.target as HTMLInputElement).value)/100));
  populateKeyboard(noteOn,noteOff,releaseAll);
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
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)releaseAll();resume();},{threshold:0});observer.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();else resume();});window.addEventListener('blur',releaseAll);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();releaseAll();canvas.style.visibility='hidden';stage.classList.remove('scene-ready');loading.hidden=false;loading.textContent='三维画面已暂停，可使用“靠近键盘”继续弹奏。';});
  canvas.addEventListener('webglcontextrestored',()=>{canvas.style.visibility='';stage.classList.add('scene-ready');loading.hidden=true;resume();});
  window.addEventListener('pageshow',()=>resume());
  window.addEventListener('pagehide',(event)=>{if(event.persisted){releaseAll();cancelAnimationFrame(frame);frame=0;return;}disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();controls.dispose();audio.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});renderer.dispose();});
  stage.classList.add('scene-ready');loading.hidden=true;resume();
  if(import.meta.env.DEV){(stage as HTMLElement & { pianoDebug?:unknown }).pianoDebug={audio,noteOn,noteOff,releaseAll,active,camera,ready:()=>audio.ready(),keyScreen:(midi:number)=>{const key=piano.hitKeys.find(k=>k.userData.midi===midi)!;const position=key.getWorldPosition(new THREE.Vector3()).project(camera);const rect=canvas.getBoundingClientRect();return{x:rect.left+(position.x+1)*rect.width/2,y:rect.top+(1-position.y)*rect.height/2};}};}

  return { noteOn,noteOff,releaseAll,ready:()=>audio.ready(),now:()=>audio.now() };

  function mountKeyboardOnly() {
    const fallbackAudio=new PianoAudio(base,setStatus);const panel=document.querySelector<HTMLElement>('#keyboard-panel')!;
    const release=()=>fallbackAudio.releaseAll();
    populateKeyboard((m,v,t,s)=>fallbackAudio.noteOn(m,v,t,s),(m,t,s)=>fallbackAudio.noteOff(m,t,s),release);
    document.querySelector('#piano-close')?.addEventListener('click',()=>{panel.hidden=false;scrollKeyboard();});document.querySelector('#keyboard-close')?.addEventListener('click',()=>{release();panel.hidden=true;});
    document.querySelector('#piano-home')?.addEventListener('click',()=>{release();panel.hidden=true;});
    document.querySelector<HTMLInputElement>('#piano-volume')?.addEventListener('input',event=>fallbackAudio.setVolume(Number((event.target as HTMLInputElement).value)/100));
    document.querySelector('#piano-mute')?.addEventListener('click',event=>{const button=event.currentTarget as HTMLButtonElement;const muted=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(muted));button.querySelector('span')!.textContent=muted?'取消静音':'静音';fallbackAudio.setMuted(muted);});
    document.querySelector('#piano-enable')?.addEventListener('click',()=>{void fallbackAudio.ready().catch(()=>{});});
    window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});window.addEventListener('pagehide',event=>{release();if(!event.persisted)fallbackAudio.dispose();});
  }
}
function scrollKeyboard(){requestAnimationFrame(()=>{const scroll=document.querySelector<HTMLElement>('.keyboard-scroll')!;scroll.scrollLeft=(scroll.scrollWidth-scroll.clientWidth)*0.48;});}
type Attack=(midi:number,velocity?:number,time?:number,source?:string)=>void;
type Release=(midi:number,time?:number,source?:string)=>void;
function populateKeyboard(on:Attack,off:Release,releaseAll:()=>void){
  const keyboard=document.querySelector<HTMLElement>('#flat-keyboard')!;
  for(const spec of makeKeyLayout()){
    const key=document.createElement('button');key.type='button';key.className=spec.black?'flat-key black':'flat-key white';key.dataset.pianoNote=String(spec.midi);key.style.left=`${spec.x*30}px`;key.setAttribute('aria-label',`弹奏 ${spec.name}`);key.innerHTML=spec.midi%12===0?`<span>${spec.name}</span>`:'';
    key.addEventListener('pointerdown',event=>{if(event.button!==0)return;key.setPointerCapture(event.pointerId);key.classList.add('pressed');on(spec.midi,0.72,undefined,`flat:${event.pointerId}`);});
    const up=(event:PointerEvent)=>{off(spec.midi,undefined,`flat:${event.pointerId}`);key.classList.remove('pressed');};key.addEventListener('pointerup',up);key.addEventListener('pointercancel',up);key.addEventListener('lostpointercapture',up);
    key.addEventListener('keydown',event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();key.classList.add('pressed');on(spec.midi,0.72,undefined,`accessible:${spec.midi}`);}});key.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();off(spec.midi,undefined,`accessible:${spec.midi}`);key.classList.remove('pressed');}});key.addEventListener('blur',()=>{off(spec.midi,undefined,`accessible:${spec.midi}`);key.classList.remove('pressed');});
    keyboard.append(key);
  }
  window.addEventListener('blur',()=>{releaseAll();keyboard.querySelectorAll('.pressed').forEach(key=>key.classList.remove('pressed'));});
}