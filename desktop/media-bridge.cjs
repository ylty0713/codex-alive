const {spawn}=require('node:child_process');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {randomUUID}=require('node:crypto');
function registerMedia({ipcMain,isStudio,permissions,getStudio,getBridge,app}){
 let listener=null,pending='';
 function send(value){const w=getStudio();if(w&&!w.isDestroyed())w.webContents.send('mic-text',value)}
 function close(){if(listener){const p=listener;listener=null;p.kill()}pending=''}
 ipcMain.handle('listen-start',e=>{if(!isStudio(e)||!permissions.audio)return {ok:false,error:'请先启用麦克风'};if(listener)return {ok:true};
  const python=require('./python-runtime.cjs').pythonExecutable();const child=spawn(python,['-u',path.join(__dirname,'listen.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});listener=child;child.stdout.setEncoding('utf8');child.stdout.on('data',d=>{pending+=d;const rows=pending.split('\n');pending=rows.pop();for(const row of rows){try{send(JSON.parse(row))}catch{}}});let err='';child.stderr.setEncoding('utf8');child.stderr.on('data',d=>err=(err+d).slice(-300));child.on('error',e=>send({type:'error',message:e.message}));child.stdin.on('error',()=>{});child.on('close',()=>{if(listener===child){listener=null;send({type:'error',message:err||'语音识别已停止'})}});return {ok:true};
 });
 ipcMain.handle('listen-stop',e=>{if(isStudio(e))close();return {ok:true}});
 ipcMain.on('mic-audio',(e,data)=>{if(!isStudio(e)||!permissions.audio||!listener)return;if(data?.reset){listener.stdin.write('{"reset":true}\n');return}if(!(data instanceof Uint8Array)||data.length>64000||listener.stdin.writableLength>128000)return;listener.stdin.write(JSON.stringify({audio:Buffer.from(data).toString('base64')})+'\n')});
 ipcMain.handle('video-send',async(e,data)=>{
  if(!isStudio(e)||!permissions.audio||typeof data?.text!=='string'||data.text.length>4000)return {ok:false,error:'视频对话尚未启用'};
  let image;try{if(data.image){if(!permissions.video||!(data.image instanceof Uint8Array)||data.image.length>1500000||data.image[0]!==255||data.image[1]!==216)return {ok:false,error:'画面无效'};image=path.join(app.getPath('temp'),'companion-frame-'+randomUUID()+'.jpg');await fs.writeFile(image,data.image)}
   const r=getBridge().send(data.text,image,()=>{if(image)fs.unlink(image).catch(()=>{})});if(!r.ok&&image)await fs.unlink(image).catch(()=>{});return r;
  }catch(error){if(image)await fs.unlink(image).catch(()=>{});return {ok:false,error:error.message}}
 });
 app.on('before-quit',close);
}
module.exports={registerMedia};
