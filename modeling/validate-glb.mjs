import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/rin');
function parse(name){const b=fs.readFileSync(path.join(root,name));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())}
const full=parse('rin_academy_v01.glb'),base=parse('rin_base_v01.glb'),outfit=parse('outfit_academy_v01.glb');
function meshes(g){return g.nodes.filter(n=>n.mesh!==undefined)}
for(const g of [full,base,outfit]){assert(g.skins.length>0);for(const n of meshes(g)){assert.notEqual(n.skin,undefined,`${n.name} missing skin`);assert(g.skins[n.skin]);}for(const m of g.meshes)for(const v of m.weights??[])assert.equal(v,0,'morph enabled at rest')}
assert(meshes(base).every(n=>!n.name.startsWith('Academy_')));
assert(meshes(outfit).every(n=>n.name.startsWith('Academy_')));
assert.equal(meshes(full).length,meshes(base).length+meshes(outfit).length);
function joints(g){return g.skins[0].joints.map(i=>{const n=g.nodes[i];return [n.name,n.translation,n.rotation,n.scale,n.matrix]}).sort((a,b)=>a[0].localeCompare(b[0]))}
assert.deepEqual(joints(base),joints(outfit),'independent files have different rest skeletons');
assert(full.animations?.length>0,'missing motion study');
const result={passed:true,combinedMeshes:meshes(full).length,baseMeshes:meshes(base).length,outfitMeshes:meshes(outfit).length,checks:['all meshes skinned','base and clothing separate','identical rest skeletons in independent GLBs','zero morph values at rest','animation exported']};
fs.writeFileSync(path.join(root,'glb-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
