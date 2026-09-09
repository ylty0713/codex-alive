const defaults={displayId:null,camera:{position:[.25,1.15,3.7],target:[0,.91,0],fov:30},lights:[{position:[2,3,4],intensity:2.5},{position:[-3,2,1],intensity:1},{position:[-1,3,-3],intensity:2}],ambient:2};
function normalize(value={}){
 const number=(v,d,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
 const vector=(v,d)=>d.map((n,i)=>number(v?.[i],n,-15,15));
 const camera={position:vector(value.camera?.position,defaults.camera.position),target:vector(value.camera?.target,defaults.camera.target),fov:number(value.camera?.fov,30,15,75)};
 if(Math.hypot(...camera.position.map((n,i)=>n-camera.target[i]))<.1)camera.position[2]=camera.target[2]+1;
 return {displayId:Number.isSafeInteger(value.displayId)?value.displayId:null,camera,lights:defaults.lights.map((d,i)=>({position:vector(value.lights?.[i]?.position,d.position),intensity:number(value.lights?.[i]?.intensity,d.intensity,0,8)})),ambient:number(value.ambient,2,0,5)};
}
module.exports={defaults,normalize};
