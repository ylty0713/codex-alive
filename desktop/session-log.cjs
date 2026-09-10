const fs=require('node:fs');
const path=require('node:path');
// Discover only rotations of the configured thread, never unrelated conversations.
function currentLog(config){
 const original=config.watchFile;
 if(!original||!config.watchThread||!path.basename(original).includes(config.watchThread))return original;
 let root=path.dirname(original);
 while(path.basename(root)!=='sessions'&&path.dirname(root)!==root)root=path.dirname(root);
 if(path.basename(root)!=='sessions')return original;
 let latest=original,modified=-1;
 function visit(dir,depth){
  if(depth>3)return;
  let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
  for(const entry of entries){
   const file=path.join(dir,entry.name);
   if(entry.isDirectory())visit(file,depth+1);
   else if(entry.isFile()&&entry.name.endsWith('.jsonl')&&entry.name.includes(config.watchThread)){
    try{const time=fs.statSync(file).mtimeMs;if(time>modified){latest=file;modified=time}}catch{}
   }
  }
 }
 visit(root,0);return latest;
}
module.exports={currentLog};
