import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {Hologram} from '../modeling/hologram.js';
const {normalize}=createRequire(import.meta.url)('../desktop/scene-settings.cjs');
test('experience settings migrate existing scenes and clamp customization',()=>{const s=normalize({hologram:{idleSeconds:Infinity,color:'invalid'},speech:{rate:500,volume:-1}});assert.equal(s.hologram.idleSeconds,60);assert.equal(s.hologram.color,'#d2e5ed');assert.equal(s.speech.rate,50);assert.equal(s.speech.volume,0);assert.equal(s.motion.enabled,true)});
test('hologram sleeps after inactivity, wakes on feedback and does not sleep during speech',()=>{const h=new Hologram(new THREE.Group(),new THREE.Scene());const tick=(now)=>{for(let i=0;i<70;i++)h.update(.1,now)};h.touch();tick(h.lastActivity);assert.equal(h.state,'visible');tick(h.lastActivity+61000);assert.equal(h.state,'hidden');h.hold('speech',true);tick(h.lastActivity+90000);assert.equal(h.state,'visible');h.hold('speech',false);tick(h.lastActivity+61000);assert.equal(h.state,'hidden');h.preview(true);tick(h.lastActivity);assert.equal(h.state,'visible');tick(h.lastActivity+61000);assert.equal(h.state,'hidden');h.configure({enabled:false});tick(h.lastActivity+90000);assert.equal(h.state,'visible')});

test('shutdown lowers the projection before the emitter powers off and reverses continuously',()=>{
 const h=new Hologram(new THREE.Group(),new THREE.Scene());h.progress=1;h.preview(false);
 let previous=1;for(let i=0;i<16;i++){h.update(.1,performance.now());assert.ok(h.uniforms.uReveal.value<=previous);previous=h.uniforms.uReveal.value;}
 assert.equal(h.stage.visible,false);assert.ok(h.ring.material.opacity>0);
 h.update(1,performance.now());assert.equal(h.ring.material.opacity,0);assert.equal(h.ring.scale.x,0);
 h.progress=.5;h.preview(false);h.update(0,performance.now());const cutoff=h.uniforms.uReveal.value;
 h.touch();h.update(0,performance.now());assert.equal(h.uniforms.uReveal.value,cutoff);
 h.update(.1,performance.now());assert.ok(h.uniforms.uReveal.value>cutoff);
});
