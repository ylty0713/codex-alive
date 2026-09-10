import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fixCharacterMaterials} from '../modeling/character-materials.js';
test('soft hair uses a separate depth pass without changing skin or duplicating passes',()=>{
 const model=new T.Group(),hair=new T.MeshPhysicalMaterial({name:'Hair_Transparency'}),skin=new T.MeshStandardMaterial({name:'Skin'});
 const mesh=new T.Mesh(new T.PlaneGeometry(),hair);model.add(mesh,new T.Mesh(new T.PlaneGeometry(),skin));
 assert.equal(fixCharacterMaterials(model),1);assert.equal(mesh.children.length,1);
 assert.equal(hair.depthWrite,false);assert.equal(hair.transparent,true);assert.ok(hair.specularIntensity<.2);
 const depth=mesh.children[0];assert.equal(depth.material.colorWrite,false);assert.equal(depth.material.depthWrite,true);assert.equal(depth.material.transparent,false);assert.ok(depth.material.alphaTest>.5);
 assert.equal(skin.roughness,1);assert.equal(skin.transparent,false);
 fixCharacterMaterials(model);assert.equal(mesh.children.length,1);
 const shader={fragmentShader:'#include <alphatest_fragment>'};hair.onBeforeCompile(shader);assert.match(shader.fragmentShader,/0\.85/);
});
