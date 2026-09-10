import {createRequire} from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{normalizeBody,writeIntent,takeIntent,intentPath,parseReply}=require('../desktop/body-intent.cjs');
test('body plans are bounded and malformed replies never narrate JSON',()=>{
 assert.deepEqual(normalizeBody({gesture:'run',intensity:100}),{gesture:'none',expression:'neutral',gaze:'user',intensity:.7});
 assert.equal(parseReply('{broken').body.gesture,'none');assert.ok(!parseReply('{broken').text.includes('{'));
 assert.equal(parseReply('{"text":"你好","body":{"gesture":"wave"}}').body.gesture,'wave');
});
test('plans bind to a thread and only a later fresh message consumes them once',()=>{
 const thread='body-test-'+process.pid,seen=new Set();try{const p=writeIntent(thread,{gesture:'nod'});
 assert.equal(takeIntent(thread,p.createdAt-1,seen).gesture,'none');
 assert.equal(takeIntent(thread+'-other',p.createdAt+1,seen).gesture,'none');
 assert.equal(takeIntent(thread,p.createdAt+1,seen).gesture,'nod');
 assert.equal(takeIntent(thread,p.createdAt+2,seen).gesture,'none');
 assert.equal(takeIntent(thread,p.createdAt+120001,new Set()).gesture,'none');
 }finally{fs.unlinkSync(intentPath(thread))}
});
