import * as THREE from 'three';
export class Hologram {
 constructor(stage,scene){this.stage=stage;this.settings={enabled:true,idleSeconds:60,appear:2.2,disappear:1.8,strength:.35,scanlines:.3,color:'#d2e5ed',background:'#f2f2f2'};this.progress=0;this.lastActivity=performance.now();this.busy=new Set();this.force=null;this.state='appearing';this.uniforms={uFlicker:{value:1},uReveal:{value:0},uHoloTime:{value:0},uHoloStrength:{value:.35},uScan:{value:.3},uTint:{value:new THREE.Color('#d2e5ed')}};
 this.ring=new THREE.Mesh(new THREE.RingGeometry(.39,.405,96),new THREE.MeshBasicMaterial({color:0xb6cbd5,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.003;scene.add(this.ring);}
 attach(model){model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.userData.hologram)continue;m.userData.hologram=true;const old=m.onBeforeCompile;m.onBeforeCompile=shader=>{old?.(shader);Object.assign(shader.uniforms,this.uniforms);shader.vertexShader='varying vec3 vHoloWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvHoloWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 vHoloWorld;\nuniform float uFlicker,uReveal,uHoloTime,uHoloStrength,uScan;\nuniform vec3 uTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 float hEdge=uReveal*1.85-.06;
 if(vHoloWorld.y>hEdge||uReveal<.001)discard;`);shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
 float hBand=1.0-smoothstep(0.0,.10,abs(vHoloWorld.y-hEdge));
 float hLines=pow(.5+.5*sin(vHoloWorld.y*380.0-uHoloTime*3.0),8.0);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*uTint*1.16,uHoloStrength*.25);
 gl_FragColor.rgb+=uTint*(hBand*1.2*uHoloStrength+hLines*.12*uScan);
 gl_FragColor.rgb*=uFlicker;`);};m.customProgramCacheKey=()=> 'codex-alive-hologram-v2';m.needsUpdate=true;}})}
 configure(settings){Object.assign(this.settings,settings);this.uniforms.uHoloStrength.value=this.settings.enabled?this.settings.strength:0;this.uniforms.uScan.value=this.settings.enabled?this.settings.scanlines:0;this.uniforms.uTint.value.set(this.settings.color);this.ring.material.color.set(this.settings.color);if(!this.settings.enabled)this.progress=1;}
 touch(){this.lastActivity=performance.now();this.force=null;}
 hold(key,active){active?this.busy.add(key):this.busy.delete(key);this.touch()}
 preview(show){this.force=show?null:false;this.lastActivity=performance.now();}
 update(dt,now){const s=this.settings,visible=!s.enabled||(this.force??(this.busy.size>0||now-this.lastActivity<s.idleSeconds*1000));const goal=visible?1:0;this.progress=THREE.MathUtils.clamp(this.progress+(goal?1:-1)*dt/(goal?s.appear:s.disappear),0,1);if(!s.enabled)this.progress=1;this.state=this.progress===0?'hidden':this.progress===1?'visible':goal?'appearing':'dissolving';// Use the same height curve in both directions so a new reply reverses shutdown smoothly.
 const body=THREE.MathUtils.smoothstep(this.progress,.12,.88);
 this.uniforms.uReveal.value=body;
 const shutdownPulse=!goal&&this.progress>.88?Math.sin((1-this.progress)/.12*Math.PI)**2:0;
 this.uniforms.uFlicker.value=1-shutdownPulse*(.10+.06*Math.sin(now*.055));this.uniforms.uHoloTime.value=now/1000;this.stage.visible=body>0;
 // The emitter stays on until the projected body has fully retracted, then contracts and powers off.
 const power=THREE.MathUtils.smoothstep(this.progress,0,.12);
 this.ring.material.opacity=s.enabled?power*(.15*s.strength+Math.sin(this.progress*Math.PI)*.65):0;
 this.ring.scale.setScalar(power*(1+Math.sin(now*.0016)*.025));}
 snapshot(){return {state:this.state,progress:this.progress,remaining:Math.max(0,Math.ceil(this.settings.idleSeconds-(performance.now()-this.lastActivity)/1000)),busy:this.busy.size}};
}
