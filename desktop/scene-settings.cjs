const defaults={displayId:null,camera:{position:[.25,1.15,3.7],target:[0,.91,0],fov:30},lights:[{position:[2,3,4],intensity:2.5},{position:[-3,2,1],intensity:1},{position:[-1,3,-3],intensity:2}],ambient:2};
function normalize(value={}){
 const number=(v,d,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
 const vector=(v,d)=>d.map((n,i)=>number(v?.[i],n,-15,15));
 const camera={position:vector(value.camera?.position,defaults.camera.position),target:vector(value.camera?.target,defaults.camera.target),fov:number(value.camera?.fov,30,15,75)};
 if(Math.hypot(...camera.position.map((n,i)=>n-camera.target[i]))<.1)camera.position[2]=camera.target[2]+1;
 const h=value.hologram||{},m=value.motion||{},s=value.speech||{};
 return {displayId:Number.isSafeInteger(value.displayId)?value.displayId:null,camera,lights:defaults.lights.map((d,i)=>({position:vector(value.lights?.[i]?.position,d.position),intensity:number(value.lights?.[i]?.intensity,d.intensity,0,8)})),ambient:number(value.ambient,2,0,5),
 hologram:{enabled:h.enabled!==false,idleSeconds:number(h.idleSeconds,60,10,600),appear:number(h.appear,2.2,.3,6),disappear:number(h.disappear,1.8,.3,6),strength:number(h.strength,.35,0,1),scanlines:number(h.scanlines,.3,0,1),color:/^#[\da-f]{6}$/i.test(h.color)?h.color:'#d2e5ed',background:/^#[\da-f]{6}$/i.test(h.background)?h.background:'#f2f2f2'},
 motion:{enabled:m.enabled!==false,intensity:number(m.intensity,.55,0,1),frequency:number(m.frequency,.5,0,1),breathing:number(m.breathing,.5,0,1)},
 speech:{rate:number(s.rate,-6,-50,50),pitch:number(s.pitch,0,-30,30),volume:number(s.volume,.85,0,1)}};
}
module.exports={defaults,normalize};
