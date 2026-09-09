const {spawn}=require('node:child_process');const path=require('node:path');const os=require('node:os');
const voices=[{name:'zh-CN-XiaoxiaoNeural',label:'晓晓 · 自然女声（联网）',lang:'zh-CN',gender:'Female'},{name:'zh-CN-XiaoyiNeural',label:'晓伊 · 柔和女声（联网）',lang:'zh-CN',gender:'Female'}];
function synthesize(request,output,jobs){return new Promise((resolve,reject)=>{
 const python=require('./python-runtime.cjs').pythonExecutable();
 const child=spawn(python,[path.join(__dirname,'neural-speech.py'),request,output],{windowsHide:true,stdio:['ignore','ignore','pipe']});jobs.add(child);let error='';child.stderr.setEncoding('utf8');child.stderr.on('data',d=>error=(error+d).slice(-2000));const timer=setTimeout(()=>{child.kill();reject(Error('自然语音连接超时'))},45000);
 child.on('error',e=>{clearTimeout(timer);jobs.delete(child);reject(e)});child.on('close',code=>{clearTimeout(timer);jobs.delete(child);if(code===0)resolve();else reject(Error('自然语音暂不可用：'+error.slice(-350)))})
})}
module.exports={voices,synthesize};
