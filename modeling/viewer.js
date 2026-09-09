import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const el=document.getElementById('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xe2e7e8);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;el.prepend(renderer.domElement);
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(28,1,.01,100);camera.position.set(1.6,1.25,4);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.84,0);controls.enableDamping=true;controls.minDistance=.3;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.92;
scene.add(new THREE.HemisphereLight(0xffffff,0xa9b7c4,2.1));
for(const [p,i] of [[[2,4,4],2.4],[[-3,2,-2],1.5]]){const l=new THREE.DirectionalLight(0xfff5eb,i);l.position.set(...p);scene.add(l)}
const grid=new THREE.GridHelper(5,50,0xc1c9ca,0xd2d9da);scene.add(grid);
let model,mixer,helper,animation=false;const garmentMeshes=[];const clock=new THREE.Clock();let blinkUntil=0;
const groupDefs=[['外套 / 袖子',/^Academy_(Jacket|Sleeve)/],['衬衫 / 领口 / 领结',/^Academy_(Shirt|Collar|Cuff|NeckRibbon|RibbonTail)/],['褶裙',/^Academy_(Skirt|Waistband)/],['袜裤',/^Academy_Tights/],['乐福鞋',/^Academy_(Loafer|Sole|PennyStrap)/]];
const settings=Object.fromEntries(groupDefs.map(([name])=>[name,true]));
function wardrobe(){for(const m of garmentMeshes){const entry=groupDefs.find(([,r])=>r.test(m.name));m.visible=document.getElementById('outfit').checked&&(!entry||settings[entry[0]])}}
for(const [name] of groupDefs){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=true;input.onchange=()=>{settings[name]=input.checked;wardrobe()};label.append(input,document.createTextNode(name));document.getElementById('garments').append(label)}
new GLTFLoader().load('/assets/rin/rin_academy_v01.glb',g=>{
 model=g.scene;scene.add(model);let meshCount=0,boneCount=0;model.traverse(o=>{if(o.isMesh){meshCount++;if(o.name.startsWith('Academy_'))garmentMeshes.push(o);const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m.side=THREE.DoubleSide}if(o.isBone)boneCount++});
 helper=new THREE.SkeletonHelper(model);helper.visible=false;scene.add(helper);
 mixer=new THREE.AnimationMixer(model);if(g.animations.length)mixer.clipAction(g.animations[0]).play();
 document.getElementById('status').textContent=`已加载 · ${meshCount} 个独立网格 · ${boneCount} 根骨骼`;
 window.rinPreview={model,garmentMeshes,clips:g.animations,renderer,scene,ready:true};
},undefined,e=>{document.getElementById('status').textContent='加载失败：'+e.message;console.error(e)});
document.getElementById('outfit').onchange=wardrobe;
document.getElementById('animate').onchange=e=>{animation=e.target.checked;if(!animation&&mixer)mixer.setTime(0)};
document.getElementById('skeleton').onchange=e=>{if(helper)helper.visible=e.target.checked};
document.getElementById('wire').onchange=e=>model?.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=e.target.checked});
document.getElementById('blink').onclick=()=>{blinkUntil=performance.now()+450};
function view(p,t){camera.position.set(...p);controls.target.set(...t);controls.update()}
document.getElementById('front').onclick=()=>view([0,.94,3.8],[0,.84,0]);
document.getElementById('back').onclick=()=>view([0,.94,-3.8],[0,.84,0]);
document.getElementById('face').onclick=()=>view([.10,1.46,.94],[0,1.45,0]);
document.getElementById('reset').onclick=()=>view([1.6,1.25,4],[0,.84,0]);
function resize(){renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(el);resize();
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.1);if(animation&&mixer)mixer.update(dt);model?.traverse(o=>{if(o.morphTargetDictionary){for(const [name,index] of Object.entries(o.morphTargetDictionary))if(name.startsWith('Blink_'))o.morphTargetInfluences[index]=performance.now()<blinkUntil?1:0}});controls.update();renderer.render(scene,camera)});
