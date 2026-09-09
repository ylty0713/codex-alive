const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const {StringDecoder}=require('node:string_decoder');
const {companionPrompt}=require('./companion-prompt.cjs');
function visibleEvent(row){
 const p=row.payload||{};
 if(row.type==='event_msg'&&['task_started','turn_started','user_message'].includes(p.type))return {state:'thinking'};
 if(row.type==='event_msg'&&['task_complete','turn_complete','task_completed'].includes(p.type))return {state:'idle'};
 if(row.type==='event_msg'&&p.type==='turn_aborted')return {state:'idle',message:'任务已停止'};
 if(row.type==='response_item'&&p.type==='message'&&p.role==='assistant'){
  const phase=p.phase||p.channel;
  if(['final','final_answer','commentary'].includes(phase)){const text=(p.content||[]).filter(c=>c.type==='output_text'||c.type==='text').map(c=>c.text||'').join('\n');if(text)return {state:phase==='commentary'?'progress':'answer',text:text.slice(0,12000),...(p.id?{id:p.id}:{})};}
 }
 return null;
}
class CodexBridge{
 constructor({root,userData,onEvent,config}){Object.assign(this,{root,userData,onEvent,config});this.session=null;this.child=null;this.last={state:'idle'};this.offset=0;this.decoder=new StringDecoder('utf8');this.pending='';}
 emit(data){this.last={...data,time:Date.now()};this.onEvent(this.last)}
 executable(){if(this.config.executable&&fs.existsSync(this.config.executable))return this.config.executable;const dir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'OpenAI/Codex/bin');try{for(const name of fs.readdirSync(dir).reverse()){const p=path.join(dir,name,'codex.exe');if(fs.existsSync(p))return p}}catch{}return 'codex';}
 start(){const file=this.config.watchFile;try{this.offset=fs.statSync(file).size;this.watching=true}catch{this.watching=false}this.timer=setInterval(()=>this.poll(),800);this.timer.unref();return this.status()}
 status(){return {connected:this.watching,watchThread:this.config.watchThread,busy:!!this.child,last:this.last};}
 poll(){if(!this.watching)return;try{const file=this.config.watchFile,size=fs.statSync(file).size;if(size<this.offset){this.offset=0;this.pending='';this.decoder=new StringDecoder('utf8')}if(size===this.offset)return;const n=Math.min(size-this.offset,1024*1024),buf=Buffer.alloc(n),fd=fs.openSync(file,'r');try{fs.readSync(fd,buf,0,n,this.offset)}finally{fs.closeSync(fd)}this.offset+=n;this.pending+=this.decoder.write(buf);const lines=this.pending.split('\n');this.pending=lines.pop();for(const line of lines){try{const event=visibleEvent(JSON.parse(line));if(event)this.emit({...event,source:'desktop'})}catch{}}}catch{this.watching=false;this.emit({state:'error',message:'当前 Codex 任务连接已中断，请重新选择任务。'})}}
 send(text,imagePath,onCleanup){if(typeof text!=='string'||!text.trim()||text.length>4000)return {ok:false,error:'请输入 1–4000 字。'};if(this.child)return {ok:false,error:'Codex 正在回答，请先停止或等待完成。'};
 const args=['exec','--json','--color','never','--sandbox','read-only','-c','approval_policy="never"','-c','model_reasoning_effort="low"','-c','mcp_servers.node_repl.enabled=false','--skip-git-repo-check','-C',this.root];if(this.session)args.push('resume',this.session,'-');else args.push('-');
 if(imagePath)args.splice(args.length-1,0,'--image',imagePath);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(this.executable(),args,{cwd:this.root,env,windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;this.emit({state:'thinking',source:'panel'});let pending='',stderr='',answer='',failure='';
 if(onCleanup){let cleaned=false;const clean=()=>{if(!cleaned){cleaned=true;onCleanup()}};child.on('close',clean);child.on('error',clean)}
 child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',d=>stderr=(stderr+d).slice(-2500));
 child.stdout.on('data',d=>{pending+=d;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){let e;try{e=JSON.parse(line)}catch{continue}if(e.type==='thread.started')this.session=e.thread_id;if(e.type==='item.completed'&&e.item?.type==='agent_message')answer=e.item.text||answer;if(e.type==='error'||e.type==='turn.failed')failure=e.message||e.error?.message||'Codex 请求失败';}});
 const timer=setTimeout(()=>{if(this.child===child){this.stop();this.emit({state:'error',source:'panel',message:'Codex 响应超时，请重试。'})}},180000);
 child.on('error',e=>{clearTimeout(timer);if(this.child!==child)return;this.child=null;this.emit({state:'error',source:'panel',message:'无法启动 Codex：'+e.message})});
 child.on('close',code=>{clearTimeout(timer);if(this.child!==child)return;this.child=null;if(code===0&&answer)this.emit({state:'answer',text:answer.slice(0,12000),source:'panel'});else this.emit({state:'error',message:(failure||stderr||'Codex 没有返回回答').slice(0,1000),source:'panel'})});
 child.stdin.on('error',()=>{});child.stdin.end(companionPrompt(text,!!imagePath));
 return {ok:true};
 }
 stop(){if(this.child){const child=this.child;this.child=null;child.kill();this.emit({state:'idle',message:'已停止',source:'panel'})}}
 close(){clearInterval(this.timer);this.stop()}
}
module.exports={CodexBridge,visibleEvent};
