import test from 'node:test';
import assert from 'node:assert/strict';
import {localReply,angleTowards,validatePreferences} from '../src/companion.js';
import {createRin} from '../src/character.js';
test('local companion uses the actual time and handles stop without a spoken reply',()=>{
  assert.match(localReply('现在几点',new Date(2026,8,9,14,6)).text,/14点6分/);
  assert.deepEqual(localReply('请安静'),{text:'',action:'stop'});
  assert.match(localReply('写个故事').text,/这一版可以/);
});
test('turning takes the short path through the ±pi boundary',()=>{
  const a=angleTowards(Math.PI-.05,-Math.PI+.05,.02);
  assert.ok(a>Math.PI-.05);assert.ok(a<Math.PI);
});
test('preferences clamp voice rate and reject unsupported scene modes',()=>{
  assert.equal(validatePreferences({rate:Infinity}).rate,3);
  assert.equal(validatePreferences({rate:-100,scene:'remote'}).rate,-3);
  assert.equal(validatePreferences({scene:'remote'}).scene,'meadow');
});
test('the authored character has finite geometry and normalized skin weights',()=>{
  const rin=createRin();let count=0,skinned=0;
  rin.root.traverse(o=>{if(!o.isMesh)return;count++;
    for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),o.name);
    if(o.isSkinnedMesh){skinned++;const weights=o.geometry.attributes.skinWeight,indices=o.geometry.attributes.skinIndex;
      for(let i=0;i<weights.count;i++){let sum=0;for(let j=0;j<4;j++){sum+=weights.array[i*4+j];assert.ok(indices.array[i*4+j]<rin.skeleton.bones.length);}assert.ok(Math.abs(sum-1)<1e-6,o.name);}
    }
  });
  assert.ok(count>80);assert.ok(skinned>70);assert.ok(rin.skeleton.bones.length>=20);
  rin.update(.016,1,{state:'wave'});assert.notEqual(rin.bones.UpperArmR.rotation.z,0);
  rin.resetPose();assert.equal(rin.bones.UpperArmR.rotation.z,0);
});
