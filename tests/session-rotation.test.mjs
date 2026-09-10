import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bridgeModule from '../desktop/codex-bridge.cjs';
const {CodexBridge}=bridgeModule;
test('follows thread log rotation without replaying history or another thread',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rin-rotation-'));
 const dir=path.join(root,'sessions','2026','09','10');fs.mkdirSync(dir,{recursive:true});
 const old=path.join(dir,'rollout-thread-one.jsonl'),next=path.join(dir,'rollout-thread-one_rotation.jsonl');
 const event=(text,time)=>JSON.stringify({timestamp:new Date(time).toISOString(),type:'response_item',payload:{type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text}]}})+'\n';
 fs.writeFileSync(old,event('old history',Date.now()-10000));
 const received=[];const bridge=new CodexBridge({root,userData:root,config:{watchThread:'thread-one',watchFile:old},onEvent:e=>received.push(e)});
 try{
  bridge.start();clearInterval(bridge.timer);
  const first=event('first live update',Date.now()+1);fs.appendFileSync(old,first);bridge.poll();
  fs.writeFileSync(next,event('old history',Date.now()-10000)+first+event('after rotation',Date.now()+2));
  fs.utimesSync(next,new Date(Date.now()+1000),new Date(Date.now()+1000));
  fs.writeFileSync(path.join(dir,'rollout-other-thread.jsonl'),event('unrelated',Date.now()+3));
  bridge.lastDiscovery=0;bridge.poll();
  assert.equal(bridge.status().watchFile,next);
  assert.deepEqual(received.map(e=>e.text),['first live update','after rotation']);
  fs.renameSync(next,next+'.missing');bridge.poll();assert.equal(bridge.status().connected,false);
  fs.renameSync(next+'.missing',next);bridge.poll();assert.equal(bridge.status().connected,true);
  fs.appendFileSync(next,event('recovered',Date.now()+4));bridge.poll();
  assert.equal(received.at(-1).text,'recovered');
  const restarted=new CodexBridge({root,userData:root,config:{watchThread:'thread-one',watchFile:old},onEvent:()=>assert.fail('must not replay on startup')});
  restarted.start();assert.equal(restarted.status().watchFile,next);restarted.poll();restarted.close();
 }finally{bridge.close();fs.rmSync(root,{recursive:true,force:true});}
});
