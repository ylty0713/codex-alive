// Dense strands write depth first; fine strands retain their original soft coverage.
export function fixCharacterMaterials(model){
 const changed=new Set();
 const depthPasses=[];
 model.traverse(object=>{
  if(!object.isMesh)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material||!/(?:hair|scalp)_transparency/i.test(material.name)||changed.has(material))continue;
   changed.add(material);
   material.transparent=true;
   material.opacity=1;
   material.alphaTest=.005;
   material.alphaToCoverage=false;
   if(!material.userData.hairCoverage){
    const compile=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,...args){compile?.call(this,shader,...args);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a = smoothstep(0.005, 0.85, diffuseColor.a);\n#include <alphatest_fragment>');};
    material.customProgramCacheKey=()=> 'hair-soft-coverage-v2';
    material.userData.hairCoverage=true;
   }
   material.depthWrite=false;
   material.depthTest=true;
   material.metalness=0;
   material.roughness=.72;
   material.roughnessMap=null;
   material.envMapIntensity=.2;
   if('specularIntensity' in material){material.specularIntensity=.15;material.specularIntensityMap=null;material.specularColorMap=null;material.specularColor.setRGB(1,1,1);}
   if('clearcoat' in material)material.clearcoat=0;
   if('transmission' in material)material.transmission=0;
   material.needsUpdate=true;
  }
  if(!object.userData.hairDepthPass&&(Array.isArray(object.material)?object.material:[object.material]).some(m=>changed.has(m))){
   depthPasses.push(object);object.userData.hairDepthPass=true;
  }
 });
 for(const object of depthPasses){
  const depth=object.clone(false);
  depth.name=object.name+'_coverageDepth';
  depth.position.set(0,0,0);depth.quaternion.identity();depth.scale.set(1,1,1);depth.updateMatrix();
  const materials=(Array.isArray(object.material)?object.material:[object.material]).map(m=>{
   const d=m.clone();d.name='CoverageDepth';d.colorWrite=false;d.depthWrite=true;d.transparent=false;d.alphaTest=.65;d.userData={};
   if(!changed.has(m))d.visible=false;
   return d;
  });
  depth.material=Array.isArray(object.material)?materials:materials[0];depth.renderOrder=-1;depth.frustumCulled=false;
  if(object.morphTargetInfluences)depth.morphTargetInfluences=object.morphTargetInfluences;
  object.add(depth);
 }
 return changed.size;
}
