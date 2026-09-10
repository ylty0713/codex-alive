// Make hair interiors opaque while blending only the narrow strand edges.
// Keep the original texture alpha so the spaces between individual strands remain.
export function fixCharacterMaterials(model){
 const changed=new Set();
 model.traverse(object=>{
  if(!object.isMesh)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material||!/(?:hair|scalp)_transparency/i.test(material.name)||changed.has(material))continue;
   changed.add(material);
   material.transparent=true;
   material.opacity=1;
   material.alphaTest=.05;
   material.alphaToCoverage=false;
   if(!material.userData.hairCoverage){
    const compile=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,...args){compile?.call(this,shader,...args);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a = smoothstep(0.015, 0.16, diffuseColor.a);\n#include <alphatest_fragment>');};
    material.customProgramCacheKey=()=> 'hair-coverage-v1';
    material.userData.hairCoverage=true;
   }
   material.depthWrite=true;
   material.depthTest=true;
   material.metalness=0;
   material.roughness=.92;
   material.roughnessMap=null;
   material.envMapIntensity=.2;
   if('specularIntensity' in material){material.specularIntensity=.15;material.specularIntensityMap=null;material.specularColorMap=null;material.specularColor.setRGB(1,1,1);}
   if('clearcoat' in material)material.clearcoat=0;
   if('transmission' in material)material.transmission=0;
   material.needsUpdate=true;
  }
 });
 return changed.size;
}
