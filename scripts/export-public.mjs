import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'.runtime','codex-alive-public');
await fs.mkdir(output,{recursive:true});
const skip=new Set(['node_modules','dist','.git','.runtime','test-results','__pycache__','tts-deps','stt-deps']);
const privateFiles=new Set(['companion-config.json','runtime-status.json']);
let count=0,bytes=0;
async function copy(from,to){for(const entry of await fs.readdir(from,{withFileTypes:true})){
 if(skip.has(entry.name)||privateFiles.has(entry.name)||entry.name.endsWith('.log')||entry.name.endsWith('.pyc')||entry.name.endsWith('.blend1'))continue;
 const source=path.join(from,entry.name),target=path.join(to,entry.name.replaceAll('companion-character','companion-character'));
 if(entry.isDirectory()){await fs.mkdir(target,{recursive:true});await copy(source,target)}else if(entry.isFile()){
 await fs.copyFile(source,target);const stat=await fs.stat(target);count++;bytes+=stat.size;
 if(stat.size<3e6&&/\.(?:md|json|js|mjs|cjs|py|ps1|html|txt|vbs|yaml|toml)$/i.test(entry.name)){
 let text=await fs.readFile(target,'utf8');text=text.replaceAll('companion-character','companion-character').replaceAll('<PROJECT_ROOT>','<PROJECT_ROOT>').replaceAll('C:\\Users\\<USER>\\Documents\\ChatGPT\\P','<PROJECT_ROOT>').replaceAll('<THREAD_ID>','<THREAD_ID>').replaceAll('<USER>','<USER>');await fs.writeFile(target,text);
 }
 }
}}
for(const name of ['assets','design','desktop','modeling','previews','scripts','src','tests']){const dir=path.join(output,name);await fs.mkdir(dir,{recursive:true});await copy(path.join(root,name),dir)}
for(const name of ['index.html','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','启动凛.vbs'])await fs.copyFile(path.join(root,name),path.join(output,name));
await fs.writeFile(path.join(output,'desktop','companion-config.json'),JSON.stringify({watchThread:'',watchFile:'',executable:''},null,2)+'\n');
await fs.writeFile(path.join(output,'.gitignore'),'node_modules/\ndist/\n.runtime/\ntest-results/\ndesktop/tts-deps/\ndesktop/stt-deps/\ndesktop/runtime-status.json\ndesktop/companion-config.local.json\n**/__pycache__/\n*.pyc\n*.log\n.env*\n');
await fs.writeFile(path.join(output,'.gitattributes'),'assets/** filter=lfs diff=lfs merge=lfs -text\ndesign/** filter=lfs diff=lfs merge=lfs -text\npreviews/** filter=lfs diff=lfs merge=lfs -text\n');
await fs.writeFile(path.join(output,'desktop','requirements.txt'),'edge-tts==7.2.8\nvosk==0.3.45\n');
console.log(JSON.stringify({output,count,bytes}));
