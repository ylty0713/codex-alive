import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createRin} from './character.js';
import {createWorld} from './world.js';
import {localReply,angleTowards,validatePreferences,states} from './companion.js';

const $=id=>document.getElementById(id);
const isWallpaper=new URLSearchParams(location.search).get('mode')==='wallpaper';
document.body.classList.toggle('wallpaper',isWallpaper);
let preferences;try{preferences=validatePreferences(JSON.parse(localStorage.getItem('rin.preferences')||'{}'));}catch{preferences=validatePreferences();}
if(!localStorage.getItem('rin.preferences')&&matchMedia('(prefers-reduced-motion:reduce)').matches)preferences.reducedMotion=true;
let state='idle',stateUntil=0,t=0,targetYaw=0,turning=false,walkTarget=null,mouthLevel=0,remoteMouth=0,subtitleUntil=0,nextAutonomy=18,readMode=false,wallpaperEnabled=false;
const viewport=$('viewport'),scene=new THREE.Scene();
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch(e){$('loading').textContent='无法启动三维渲染，请检查显卡驱动。'+e.message;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
viewport.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(32,1,.05,150);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.45;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.25;controls.enablePan=true;controls.enabled=!isWallpaper;
const world=createWorld(scene),rin=createRin();scene.add(rin.root);rin.root.position.x=.36;
world.setMode(preferences.scene);
function resetCamera(){camera.position.set(.35,1.31,3.8);controls.target.set(.10,.87,0);controls.update();}
resetCamera();
if(isWallpaper){camera.position.set(-.55,1.45,4.3);controls.target.set(-.8,.85,0);controls.update();rin.root.position.x=.8;}
function resize(){let w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);resize();$('loading').hidden=true;
const pointer=new THREE.Vector2(0,0),raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
viewport.addEventListener('pointermove',e=>{const r=viewport.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);});
viewport.addEventListener('pointerleave',()=>pointer.set(0,0));
viewport.addEventListener('dblclick',e=>{
  if(isWallpaper)return;
  const r=viewport.getBoundingClientRect(),p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(p,camera);const hit=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(plane,hit)){walkTarget=new THREE.Vector3(THREE.MathUtils.clamp(hit.x,-1.4,1.4),0,THREE.MathUtils.clamp(hit.z,-.75,.65));perform('walking',false);}
});
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6500);}
const stateLabels={idle:'安静陪伴',listening:'看着你',thinking:'思考动作',speaking:'正在说话',wave:'向你挥手',walking:'散步中'};
function setState(value,duration=0){state=states.has(value)?value:'idle';stateUntil=duration?t+duration:0;$('status').textContent=stateLabels[state];document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===state));}
function publish(command){if(!isWallpaper)window.desktop?.publish(command);}
function caption(text,duration=8){$('subtitle').textContent=text;$('subtitle').hidden=!text;subtitleUntil=text?t+duration:0;publish({type:'caption',text,duration});}
function perform(action,broadcast=true){
  if(action==='stop'){stopAll();return;}
  nextAutonomy=t+18+Math.random()*20;
  if(action==='turn'){walkTarget=null;turning=true;targetYaw=rin.root.rotation.y+Math.PI*2;setState('idle');}
  else if(action==='walking'){
    turning=false;if(!walkTarget)walkTarget=new THREE.Vector3(rin.root.position.x>.3?-.7:.85,0,(Math.random()-.5)*.5);setState('walking');
  }else{walkTarget=null;turning=false;targetYaw=0;setState(action,action==='wave'?3:action==='thinking'?5:action==='listening'?6:0);}
  if(broadcast)publish({type:'action',action});
}
function applyPreferences(){
  preferences=validatePreferences(preferences);world.setMode(preferences.scene);
  $('muted').checked=preferences.muted;$('autonomy').checked=preferences.autonomy;$('reduced').checked=preferences.reducedMotion;$('rate').value=preferences.rate;$('rate-value').textContent=preferences.rate===0?'自然':preferences.rate>0?'稍快':'稍慢';
  $('scene-toggle').textContent=preferences.scene==='studio'?'回到草地':'切换纯色背景';
  if(preferences.reducedMotion){walkTarget=null;if(state==='walking')setState('idle');}
  localStorage.setItem('rin.preferences',JSON.stringify(preferences));publish({type:'preferences',value:preferences});
}
applyPreferences();
for(const [id,key] of [['muted','muted'],['autonomy','autonomy'],['reduced','reducedMotion']])$(id).addEventListener('change',e=>{preferences[key]=e.target.checked;if(key==='muted'&&preferences.muted)stopSpeech();applyPreferences();});
$('rate').addEventListener('input',e=>{preferences.rate=Number(e.target.value);applyPreferences();});
$('voice').addEventListener('change',e=>{preferences.voice=e.target.value;applyPreferences();});
$('scene-toggle').addEventListener('click',()=>{preferences.scene=preferences.scene==='studio'?'meadow':'studio';applyPreferences();});
$('camera-reset').addEventListener('click',resetCamera);
$('face-view').addEventListener('click',()=>{camera.position.set(rin.root.position.x+.03,1.5,rin.root.position.z+.86);controls.target.set(rin.root.position.x,1.45,rin.root.position.z);controls.update();});
$('rotate').addEventListener('click',()=>perform('turn'));
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>perform(b.dataset.action)));
let audioContext,source,analyser,waveData,speechSerial=0,speaking=false,commandSerial=0;
function stopSpeech(){speechSerial++;speaking=false;try{source?.stop();}catch{}source?.disconnect();source=null;mouthLevel=0;publish({type:'mouth',value:0});publish({type:'action',action:'idle'});if(state==='speaking'||state==='thinking')setState('idle');$('speech-status').textContent='已停止。';}
function stopAll(){commandSerial++;stopSpeech();walkTarget=null;turning=false;targetYaw=0;setState('idle');caption('');nextAutonomy=t+35;publish({type:'stop'});}
$('stop').addEventListener('click',stopAll);
async function speak(text){
  stopSpeech();const serial=speechSerial;caption(text,Math.max(8,text.length*.26));
  if(preferences.muted){$('speech-status').textContent='已静音，显示字幕。';return;}
  if(!window.desktop){toast('请通过 Windows 启动器运行，以使用本地语音。');return;}
  try{
    if(!audioContext)audioContext=new AudioContext();await audioContext.resume();
    setState('thinking');$('speech-status').textContent='正在准备本地语音…';
    const result=await window.desktop.synthesize(text,preferences.voice,preferences.rate);
    if(serial!==speechSerial)return;
    if(!result.ok){setState('idle');toast(result.error);$('speech-status').textContent='语音暂不可用，字幕仍可查看。';return;}
    const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));
    const buffer=await audioContext.decodeAudioData(bytes.buffer);
    if(serial!==speechSerial)return;
    source=audioContext.createBufferSource();source.buffer=buffer;analyser=audioContext.createAnalyser();analyser.fftSize=256;waveData=new Uint8Array(analyser.fftSize);source.connect(analyser);analyser.connect(audioContext.destination);
    source.onended=()=>{if(serial!==speechSerial)return;speaking=false;mouthLevel=0;publish({type:'mouth',value:0});if(!walkTarget){publish({type:'action',action:'idle'});setState('idle');}else setState('walking');$('speech-status').textContent='朗读结束。';};
    source.start();speaking=true;walkTarget=null;setState('speaking');publish({type:'action',action:'speaking'});caption(text,buffer.duration+1.5);$('speech-status').textContent='正在使用本地语音朗读，可随时停止。';
  }catch(e){if(serial===speechSerial){setState('idle');toast('无法播放语音：'+e.message);$('speech-status').textContent='语音播放失败。';}}
}
function setReadMode(value){readMode=value;$('chat-mode').classList.toggle('active',!value);$('read-mode').classList.toggle('active',value);$('chat-mode').setAttribute('aria-pressed',String(!value));$('read-mode').setAttribute('aria-pressed',String(value));$('dialogue-hint').textContent=value?'写下文字，让凛为你朗读':'离线互动：试试「现在几点」或「挥挥手」';$('message').placeholder=value?'写下想让凛念出的内容…':'和凛打个招呼吧…';$('send').firstChild.textContent=value?'朗读 ':'发送 ';}
$('chat-mode').addEventListener('click',()=>setReadMode(false));$('read-mode').addEventListener('click',()=>setReadMode(true));
$('message-form').addEventListener('submit',async e=>{e.preventDefault();const input=$('message').value.trim();if(!input)return;const command=++commandSerial;$('message').value='';if(readMode){await speak(input);return;}const reply=localReply(input);if(reply.action==='stop'){stopAll();return;}await speak(reply.text);if(command===commandSerial&&['walking','turn','wave'].includes(reply.action))perform(reply.action);});
$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('message-form').requestSubmit();}});
$('wallpaper').addEventListener('click',async()=>{
  if(!window.desktop){toast('请通过 Windows 启动器运行动态壁纸模式。');return;}
  $('wallpaper').disabled=true;const result=await window.desktop.wallpaper(!wallpaperEnabled);$('wallpaper').disabled=false;
  if(result.ok){wallpaperEnabled=result.enabled;publish({type:'preferences',value:preferences});toast(result.enabled?'已进入桌面壁纸模式。Ctrl + Alt + R 打开面板；Ctrl + Alt + Q 退出壁纸。':'已退出壁纸模式。');}else toast(result.error||'无法切换壁纸模式。');
});
window.desktop?.onWallpaper(enabled=>{wallpaperEnabled=enabled;$('wallpaper').innerHTML=enabled?'<span>▧</span> 退出桌面壁纸':'<span>▧</span> 进入桌面壁纸';});
async function exportModel(){
  // Export a fresh neutral rig; this avoids capturing the live facial/limb pose.
  const model=createRin();model.resetPose();
  const clips=[];
  const waveTrack=new THREE.NumberKeyframeTrack('UpperArmR.rotation[z]',[0,.4,.8,1.2,1.6,2],[0,-1.8,-1.8,-1.8,-1.8,0]);
  const handTrack=new THREE.NumberKeyframeTrack('HandR.rotation[z]',[0,.4,.6,.8,1,1.2,1.4,1.6,2],[0,0,.25,-.25,.25,-.25,.25,0,0]);
  clips.push(new THREE.AnimationClip('Wave',2,[waveTrack,handTrack]));
  // glTF animation uses quaternion tracks, converted from the Euler design keys.
  for(const clip of clips)clip.tracks=clip.tracks.map(track=>{
    const vals=[];for(const value of track.values){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),value);vals.push(...q.toArray());}
    return new THREE.QuaternionKeyframeTrack(track.name.replace('.rotation[z]','.quaternion'),track.times,vals);
  });
  model.root.traverse(o=>{if(o.isMesh){const old=o.material;o.material=new THREE.MeshStandardMaterial({color:old.color,roughness:1,side:old.side,transparent:old.transparent,opacity:old.opacity});}});
  const bytes=await new GLTFExporter().parseAsync(model.root,{binary:true,trs:true,animations:clips});
  model.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  return bytes;
}
$('export').addEventListener('click',async()=>{const b=$('export');b.disabled=true;try{const bytes=await exportModel();if(window.desktop){const r=await window.desktop.saveModel(new Uint8Array(bytes));if(r.ok)toast('已保存带骨骼和挥手动画的基础模型。');else if(!r.canceled)toast(r.error||'导出失败。');}else{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));a.href=url;a.download='rin-base-rig.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}}catch(e){toast('模型导出失败：'+e.message);}finally{b.disabled=false;}});
window.desktop?.subscribe(data=>{
  if(!isWallpaper)return;
  if(data.type==='action')perform(data.action,false);
  if(data.type==='preferences'){preferences=validatePreferences(data.value);world.setMode(preferences.scene);}
  if(data.type==='mouth'){remoteMouth=Number(data.value)||0;}
  if(data.type==='pose'){rin.root.position.set(data.x,0,data.z);rin.root.rotation.y=data.yaw;}
  if(data.type==='caption')caption(data.text,data.duration);
  if(data.type==='stop')stopAll();
});
async function loadVoices(){
  if(!window.desktop){$('voice').replaceChildren(new Option('仅桌面应用可用',''));return;}
  const result=await window.desktop.voices();const voices=Array.isArray(result.voices)?result.voices:[];
  $('voice').replaceChildren(...voices.map(v=>new Option(`${v.lang} · ${v.name.replace(/^Microsoft /,'')}`,v.name)));
  if(!voices.length){$('voice').add(new Option('未找到本地语音',''));$('speech-status').textContent='电脑上没有可用语音，仍可使用字幕与动作。';return;}
  if(!voices.some(v=>v.name===preferences.voice))preferences.voice=(voices.find(v=>v.lang.startsWith('zh'))||voices[0]).name;
  $('voice').value=preferences.voice;applyPreferences();
}
if(!isWallpaper)loadVoices();
let last=performance.now(),lastFrame=last,lastPublish=0,fpsAt=last,frames=0;
function frame(now){
  requestAnimationFrame(frame);const interval=isWallpaper?1000/30:1000/60;
  if(now-lastFrame<interval-1)return;
  const dt=Math.min((now-last)/1000,.05);last=now;lastFrame=now;t+=dt;
  if(document.hidden&&!isWallpaper)return;
  if(stateUntil&&t>stateUntil&&!speaking){setState('idle');}
  if(subtitleUntil&&t>subtitleUntil){$('subtitle').hidden=true;subtitleUntil=0;}
  if((isWallpaper||!wallpaperEnabled)&&preferences.autonomy&&!speaking&&state==='idle'&&!turning&&t>nextAutonomy){perform(preferences.reducedMotion?'listening':Math.random()>.5?'walking':'listening');}
  let speed=0;
  if(walkTarget){const delta=walkTarget.clone().sub(rin.root.position);delta.y=0;const distance=delta.length();
    if(distance<.025){walkTarget=null;targetYaw=0;setState('idle');}
    else{targetYaw=Math.atan2(delta.x,delta.z);rin.root.rotation.y=angleTowards(rin.root.rotation.y,targetYaw,dt*3);const err=Math.abs(Math.atan2(Math.sin(targetYaw-rin.root.rotation.y),Math.cos(targetYaw-rin.root.rotation.y)));speed=err<.7?Math.min(1,distance/.18):0;rin.root.position.addScaledVector(delta.normalize(),Math.min(distance,dt*.24*speed));}
  }else if(turning){const delta=targetYaw-rin.root.rotation.y;rin.root.rotation.y+=Math.min(delta,dt*1.15);if(delta<.01){turning=false;rin.root.rotation.y=0;targetYaw=0;}}
  else rin.root.rotation.y=angleTowards(rin.root.rotation.y,targetYaw,dt*2);
  if(speaking&&analyser){analyser.getByteTimeDomainData(waveData);let sum=0;for(const n of waveData)sum+=((n-128)/128)**2;mouthLevel=THREE.MathUtils.clamp(Math.sqrt(sum/waveData.length)*7,0,1);}
  rin.update(dt,t,{state,mouthLevel:isWallpaper?remoteMouth:mouthLevel,lookX:pointer.x,lookY:pointer.y,reducedMotion:preferences.reducedMotion,speed});
  world.update(t,preferences.reducedMotion);controls.update();renderer.render(scene,camera);
  if(now-lastPublish>70&&!isWallpaper){if(speaking)publish({type:'mouth',value:mouthLevel});lastPublish=now;}
  frames++;if(now-fpsAt>1500){$('performance').textContent=Math.round(frames*1000/(now-fpsAt))+' FPS';frames=0;fpsAt=now;}
}
setState('idle');requestAnimationFrame(frame);
// Deterministic inspection/export entry point used by the local smoke test.
window.rinApp={rin,scene,camera,renderer,controls,perform,exportModel,speak,stopAll,getState:()=>({state,position:rin.root.position.toArray(),yaw:rin.root.rotation.y,speaking,preferences}),setScene:mode=>{preferences.scene=mode;applyPreferences();}};
