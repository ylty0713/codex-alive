const {CodexBridge,visibleEvent}=require('../desktop/codex-bridge.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
assert.equal(visibleEvent({type:'response_item',payload:{type:'reasoning',text:'hidden'}}),null);
assert.equal(visibleEvent({type:'response_item',payload:{type:'message',role:'assistant',channel:'analysis',content:[{type:'output_text',text:'hidden'}]}}),null);
assert.deepEqual(visibleEvent({type:'response_item',payload:{type:'message',role:'assistant',channel:'final',content:[{type:'output_text',text:'完成'}]}}),{state:'answer',text:'完成'});
const bridge=new CodexBridge({root:require('node:path').resolve('.'),userData:'.runtime',config:require('../desktop/companion-config.json'),onEvent:e=>{console.log(JSON.stringify(e));if(e.state==='answer'||e.state==='error'){fs.writeFileSync('test-results/codex-bridge.json',JSON.stringify({liveResponse:e,hiddenContentFiltered:true},null,2));bridge.close();process.exitCode=e.state==='error'?1:0;clearTimeout(deadline)}}});
console.log(bridge.start());const deadline=setTimeout(()=>{bridge.close();process.exitCode=1},180000);console.log(bridge.send('这是连接测试。不要使用工具，只回复：Codex 连接成功。'));
