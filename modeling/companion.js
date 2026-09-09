import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {setupSceneSettings} from './scene-settings.js';
import {setupPresence} from './presence.js';
import {makeTimeline,lipTarget} from './lip-sync.js';
const $=id=>document.getElementById(id),viewport=$('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xe8e6e2);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;viewport.prepend(renderer.domElement);
const isWallpaper=new URLSearchParams(location.search).get('mode')==='wallpaper';document.body.classList.toggle('wallpaper',isWallpaper);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=8;
const ambient=new THREE.HemisphereLight(0xeaf3ff,0xa8a094,2),lights=[];scene.add(ambient);for(const [p,intensity] of [[[2,3,4],2.5],[[-3,2,1],1],[[-1,3,-3],2]]){const l=new THREE.DirectionalLight(0xfff5e6,intensity);l.position.set(...p);l.target.position.set(0,1,0);scene.add(l,l.target);lights.push(l)}
const floor=new THREE.Mesh(new THREE.CircleGeometry(3,96),new THREE.MeshStandardMaterial({color:0xd9dcd4,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
const stage=new THREE.Group();scene.add(stage);let model,mixer,helper,current,head,headBase,bones=[],morphs=[],rest=[],time=0,blinkStart=-10,nextBlink=3,smiling=false,speaking=false,speechToken=0;const actions={},clock=new THREE.Clock(),loader=new GLTFLoader();
function view(mode){controls.target.set(0,mode==='face'?1.55:.91,0);camera.position.set(mode==='face'?.02:.25,mode==='face'?1.57:1.15,mode==='face'?.95:mode==='back'?-3.7:3.7);controls.update()}
view('full');if(isWallpaper){controls.enabled=false;controls.target.set(-1.15,.91,0);camera.position.set(-.9,1.15,4.1);controls.update()}for(const id of ['full','face','back'])$(id).onclick=()=>view(id);
setupSceneSettings({camera,controls,lights,ambient,isWallpaper}).catch(e=>console.error('设置载入失败',e));
function morph(name,value){for(const m of morphs){const i=m.morphTargetDictionary[name];if(i!==undefined)m.morphTargetInfluences[i]=value}}
function motion(name){if(!mixer)return;publish({type:"action",action:name});if(head&&headBase)head.quaternion.copy(headBase);if(name==='rest'){mixer.stopAllAction();current=null;for(const [b,p,q,s] of rest){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s)}if(head)headBase.copy(head.quaternion)}else{const next=actions[name];if(!next)return;if(current!==next){next.reset().setEffectiveWeight(1).play();if(current)current.crossFadeTo(next,.35,false);current=next}}document.querySelectorAll('[data-motion]').forEach(b=>b.classList.toggle('active',b.dataset.motion===name))}
document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>motion(b.dataset.motion));$('skeleton').onchange=()=>{if(helper)helper.visible=$('skeleton').checked};$('blink').onclick=()=>blinkStart=time;$('smile').onclick=()=>smiling=!smiling;$('neutral').onclick=()=>{smiling=false;$('mouth').value=0;$('head').value=0};
function voices(){if(window.desktop)return;const list=window.speechSynthesis?.getVoices()||[];$('voice').replaceChildren();for(const v of list){const o=new Option(`${v.name} (${v.lang})`,v.voiceURI);$('voice').add(o)}const preferred=list.find(v=>v.lang.startsWith('zh'));if(preferred)$('voice').value=preferred.voiceURI;if(!list.length)$('voice').add(new Option('设备默认声音',''))}
voices();if(window.speechSynthesis)window.speechSynthesis.addEventListener('voiceschanged',voices);
function stopPlayback(){speechToken++;audioSource?.stop();audioSource=null;audioLevel=0;audioComplete?.();audioComplete=null;publish({type:"stop"});window.speechSynthesis?.cancel();speaking=false;$('caption').hidden=true;$('mouth').value=0;morph('jawOpen',0);motion('idle')}
function stop(){narrationQueue.length=0;stopPlayback()}
$('stop').onclick=stop;$('speak').onclick=()=>{stop();const text=$('text').value.trim();if(!text)return;if(!window.speechSynthesis){$('speech-note').textContent='当前环境没有可用的系统语音。';return}const token=speechToken,utter=new SpeechSynthesisUtterance(text);utter.lang='zh-CN';utter.voice=speechSynthesis.getVoices().find(v=>v.voiceURI===$('voice').value)||null;utter.rate=.95;utter.onstart=()=>{if(token!==speechToken)return;speaking=true;motion('talk');$('caption').textContent=text;$('caption').hidden=false};utter.onend=()=>{if(token===speechToken)stop()};utter.onerror=e=>{if(token!==speechToken)return;stop();$('speech-note').textContent=`语音未能播放（${e.error}），可继续使用动作和口型滑杆。`};speechSynthesis.speak(utter)};
window.addEventListener('pagehide',stop);
async function load(){
 const g=await loader.loadAsync(new URL('../assets/companion/character-runtime.glb',import.meta.url).href,e=>{if(e.total)$('status').textContent=`正在载入角色 ${Math.round(e.loaded/e.total*100)}%`});model=g.scene;stage.add(model);model.updateMatrixWorld(true);
 model.traverse(o=>{if(o.isBone)bones.push(o);if(o.isMesh){o.frustumCulled=false;if(o.morphTargetDictionary)morphs.push(o)}});
 const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y,scale=1.72/height;model.scale.multiplyScalar(scale);model.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2).multiplyScalar(scale));model.updateMatrixWorld(true);
 rest=bones.map(b=>[b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);head=bones.find(b=>b.name==='CC_Base_Head');headBase=head?.quaternion.clone();mixer=new THREE.AnimationMixer(model);helper=new THREE.SkeletonHelper(model);helper.visible=false;scene.add(helper);
 const names=new Set(morphs.flatMap(m=>Object.keys(m.morphTargetDictionary)));$('status').textContent=`角色已加载 · ${bones.length} 根骨骼 · ${names.size} 个面部形变`;$('details').textContent='正在准备附带的待机与交谈动作…';
 for(const id of ['blink','smile','neutral','speak'])$(id).disabled=false;document.querySelector('[data-motion="rest"]').disabled=false;
 window.companionPreview={ready:true,model,stage,mixer,bones,morphs,renderer,scene,actions,morph,motion,rest};
 for(const name of ['idle','talk']){try{const a=await loader.loadAsync(new URL(`../assets/companion/${name}.glb`,import.meta.url).href);const clip=a.animations.reduce((best,c)=>!best||c.duration>best.duration?c:best,null);if(!clip)throw Error('没有动画片段');const valid=clip.tracks.filter(t=>model.getObjectByName(t.name.slice(0,t.name.lastIndexOf('.'))));if(!valid.length)throw Error('骨骼名称不匹配');const sourceArm=a.scene.getObjectByName("Armature"),targetArm=model.getObjectByName("Armature"); const correction=targetArm.quaternion.clone().invert().multiply(sourceArm.quaternion); const tracks=valid.map(track=>{const out=track.clone();if(out.name==="CC_Base_BoneRoot.quaternion"){for(let i=0;i<out.values.length;i+=4){const q=new THREE.Quaternion().fromArray(out.values,i).premultiply(correction);q.toArray(out.values,i)}}if(out.name==="CC_Base_BoneRoot.position"){for(let i=0;i<out.values.length;i+=3)new THREE.Vector3().fromArray(out.values,i).applyQuaternion(correction).toArray(out.values,i)}return out});const normalized=new THREE.AnimationClip(name,clip.duration,tracks);actions[name]=mixer.clipAction(normalized);document.querySelector(`[data-motion="${name}"]`).disabled=false;if(name==='idle')motion('idle')}catch(e){$('details').textContent=`${name} 动作载入失败：${e.message}`;console.error(e)}}
 if(actions.idle&&actions.talk)$('details').textContent='已接入原资源的待机与交谈动作。表情、转头和口型可以叠加；当前为角色原型。';window.companionPreview.animationsReady=!!(actions.idle&&actions.talk);
}
load().catch(e=>{$('status').textContent='角色加载失败：'+e.message;console.error(e)});
let audioSource=null,audioContext=null,audioLevel=0,remoteMouth=0,wallpaperEnabled=false,analyser=null,samples=null,lastAudioPublish=0,audioComplete=null,narrating=false,audioStarted=0,timeline=[];
let gazeTarget={x:0,y:0,active:false},gazeX=0,gazeY=0;
const lipState={jawOpen:0,mouthFunnel:0,mouthPucker:0,mouthStretchLeft:0,mouthStretchRight:0,mouthClose:0};let desiredLips={...lipState};
if(!isWallpaper)setupPresence({gaze:value=>{gazeTarget=value;publish({type:'gaze',...value})},say:text=>enqueueNarration(text),busy:()=>speaking||narrating,stopSpeech:stop}).catch(e=>console.error(e));
const narrationQueue=[],seenMessages=new Set(),speechHistory=[];
window.companionSpeech={history:speechHistory,getState:()=>({speaking,narrating,queued:narrationQueue.length,mouth:audioLevel})};
async function enqueueNarration(text,id){
 if(id&&seenMessages.has(id))return;if(id)seenMessages.add(id);
 const plain=text.replace(/```[\s\S]*?```/g,' 代码请查看控制面板。 ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[#*_`>]/g,'');
 const sentences=plain.match(/[^。！？\n]+[。！？\n]?/g)||[plain];let part='';
 for(const s of sentences){if(part.length+s.length>1800){if(part)narrationQueue.push({text:part,id});part=''}for(let i=0;i<s.length;i+=1800){const chunk=s.slice(i,i+1800);if(part.length+chunk.length>1800){narrationQueue.push({text:part,id});part=''}part+=chunk}}if(part.trim())narrationQueue.push({text:part,id});
 if(narrating)return;narrating=true;
 try{while(narrationQueue.length){const item=narrationQueue.shift();try{await nativeSpeak(item.text);speechHistory.push({id:item.id,completedAt:Date.now()})}catch(e){$('speech-note').textContent=e.message;speechHistory.push({id:item.id,error:e.message})}}}finally{narrating=false}
}
function publish(data){if(!isWallpaper)window.desktop?.publish(data)}
function caption(text){$('caption').textContent=text;$('caption').hidden=!text;publish({type:'caption',text:text.slice(0,4500)})}
async function nativeSpeak(text){
 stopPlayback();caption(text);const serial=speechToken;
 const clean=text.replace(/```[\s\S]*?```/g,' 代码请查看控制面板。 ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[#*_`>]/g,'').slice(0,2000);
 if(!clean.trim())return;
 if(!audioContext)audioContext=new AudioContext();await audioContext.resume();
 $('speech-note').textContent='正在准备本地语音…';
 const result=await window.desktop.synthesize(clean,$('voice').value,0);if(serial!==speechToken)return;
 if(!result.ok)throw Error(result.error);
 const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));const buffer=await audioContext.decodeAudioData(bytes.buffer);if(serial!==speechToken)return;
 timeline=makeTimeline(result.timing);audioStarted=audioContext.currentTime;
 audioSource=audioContext.createBufferSource();audioSource.buffer=buffer;analyser=audioContext.createAnalyser();analyser.fftSize=512;samples=new Uint8Array(analyser.fftSize);audioSource.connect(analyser);analyser.connect(audioContext.destination);speaking=true;motion('talk');
 return new Promise(resolve=>{audioComplete=resolve;audioSource.onended=()=>{if(serial!==speechToken)return;audioSource=null;speaking=false;audioLevel=0;audioComplete=null;publish({type:'mouth',value:0});motion('idle');$('speech-note').textContent='朗读结束。';resolve()};audioSource.start();$('speech-note').textContent=result.engine==='neural'?'正在使用自然音色朗读':'正在使用本地音色朗读';});
}
function audioTick(now){if(audioSource&&analyser){analyser.getByteTimeDomainData(samples);let energy=0;for(const n of samples)energy+=((n-128)/128)**2;desiredLips=lipTarget(timeline,audioContext.currentTime-audioStarted,Math.sqrt(energy/samples.length));audioLevel=desiredLips.jawOpen;if(now-lastAudioPublish>50){publish({type:'viseme',value:desiredLips});lastAudioPublish=now}}else if(!isWallpaper)desiredLips={...lipState,jawOpen:0,mouthFunnel:0,mouthPucker:0,mouthStretchLeft:0,mouthStretchRight:0,mouthClose:0};requestAnimationFrame(audioTick)}requestAnimationFrame(audioTick);
if(window.desktop){
 if(!isWallpaper){
  window.desktop.voices().then(r=>{const list=r.voices||[];$('voice').replaceChildren(...list.map(v=>new Option(v.label||`${v.name} (${v.lang})`,v.name)));if(!localStorage.getItem('companion.voice.v2')){localStorage.setItem('companion.voice','zh-CN-XiaoyiNeural');localStorage.setItem('companion.voice.v2','1')}const preferred=list.find(v=>v.name===localStorage.getItem('companion.voice'))||list.find(v=>v.name==='zh-CN-XiaoyiNeural')||list[0];if(preferred)$('voice').value=preferred.name});
  $('voice').onchange=()=>localStorage.setItem('companion.voice',$('voice').value);
  $('speak').onclick=()=>{stop();enqueueNarration($('text').value)};
  $('autoread').onchange=()=>{if(!$('autoread').checked)stop()};
  $('ask').disabled=false;$('ask').onclick=async()=>{stop();const r=await window.desktop.codexSend($('text').value);if(!r.ok)$('codex-status').textContent=r.error};
  $('stop').onclick=()=>{stop();window.desktop.codexStop()};
  window.desktop.codexStatus().then(r=>{$('codex-status').textContent=r.connected?'已连接当前 Codex 任务':'面板聊天可用 · 当前任务同步未连接'});
  $('wallpaper').onclick=async()=>{$('wallpaper').disabled=true;try{const r=await window.desktop.wallpaper(!wallpaperEnabled);if(!r.ok)$('codex-status').textContent=r.error}finally{$('wallpaper').disabled=false}};
  window.desktop.onWallpaper(enabled=>{wallpaperEnabled=enabled;$('wallpaper').textContent=enabled?'退出桌面壁纸':'进入桌面壁纸'});
 }
 window.desktop.onCodex(data=>{
  if(data.state==='thinking'){if(!isWallpaper)$('codex-status').textContent='Codex 正在处理…';if(!speaking&&!narrating){$('head').value=.12;motion('idle');}}
  if(data.state==='answer'||data.state==='progress'){$('head').value=0;smiling=data.state==='answer';if(!isWallpaper){$('codex-status').textContent=data.state==='progress'?'Codex 进度汇报':'Codex 已回答';if($('autoread').checked)enqueueNarration(data.text,data.id);else{caption(data.text);motion('talk');setTimeout(()=>{if(!speaking)motion('idle')},4000)}}}
  if(data.state==='error'){$('head').value=0;motion('idle');if(!isWallpaper){$('codex-status').textContent=data.message;$('ask').disabled=false}}
  if(data.state==='idle'&&!speaking&&!narrating){$('head').value=0;motion('idle')}
  if(!isWallpaper)$('ask').disabled=data.state==='thinking'&&data.source==='panel';
 });
 window.desktop.subscribe(data=>{if(!isWallpaper)return;if(data.type==='action')motion(data.action);if(data.type==='gaze')gazeTarget=data;if(data.type==='viseme'){desiredLips=data.value;remoteMouth=0}if(data.type==='mouth'){remoteMouth=Number(data.value)||0;if(!remoteMouth)for(const key in desiredLips)desiredLips[key]=0}if(data.type==='caption')caption(data.text);if(data.type==='stop'){remoteMouth=0;for(const key in desiredLips)desiredLips[key]=0;caption('');motion('idle')}});
}else{$('codex-status').textContent='请启动桌面版以连接 Codex 和设置壁纸';$('wallpaper').disabled=true;}
function resize(){renderer.setSize(viewport.clientWidth,viewport.clientHeight);camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(viewport);resize();
let lastRender=0;
renderer.setAnimationLoop(now=>{
 if(isWallpaper&&now-lastRender<32)return;lastRender=now;
 const dt=Math.min(clock.getDelta(),.1);time+=dt;
 if(model){
  if(head&&headBase)head.quaternion.copy(headBase);mixer.update(dt);
  gazeX=THREE.MathUtils.damp(gazeX,gazeTarget.active?THREE.MathUtils.clamp(gazeTarget.x,-1,1):0,5,dt);gazeY=THREE.MathUtils.damp(gazeY,gazeTarget.active?THREE.MathUtils.clamp(gazeTarget.y,-1,1):0,5,dt);
  if(head){headBase.copy(head.quaternion);head.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-gazeY*.15,Number($('head').value)+gazeX*.32,0)))}
  morph('eyeLookInLeft',Math.max(0,gazeX)*.3);morph('eyeLookOutRight',Math.max(0,gazeX)*.3);morph('eyeLookOutLeft',Math.max(0,-gazeX)*.3);morph('eyeLookInRight',Math.max(0,-gazeX)*.3);for(const side of ['Left','Right']){morph('eyeLookUp'+side,Math.max(0,gazeY)*.25);morph('eyeLookDown'+side,Math.max(0,-gazeY)*.25)}
  if($('autoblink').checked&&time>nextBlink){blinkStart=time;nextBlink=time+2.8+Math.random()*3.5}
  const phase=(time-blinkStart)/.24,b=phase>=0&&phase<1?Math.sin(phase*Math.PI):0;
  morph('eyeBlinkLeft',b);morph('eyeBlinkRight',b);morph('mouthSmileLeft',smiling?(speaking?.08:.25):0);morph('mouthSmileRight',smiling?(speaking?.08:.25):0);
  const mouth=isWallpaper?remoteMouth:audioSource?audioLevel:speaking?.1+.22*Math.abs(Math.sin(time*11)*Math.sin(time*7)):Number($('mouth').value);
  for(const key in lipState){const target=key==='jawOpen'&&!audioSource&&!isWallpaper?mouth:desiredLips[key]||0;lipState[key]=THREE.MathUtils.damp(lipState[key],target,target>lipState[key]?18:12,dt);morph(key,lipState[key])}if(isWallpaper&&remoteMouth)morph('jawOpen',remoteMouth);if($('rotate').checked)stage.rotation.y+=dt*.3;helper.updateMatrixWorld(true);
 }
 controls.update();renderer.render(scene,camera);
});
