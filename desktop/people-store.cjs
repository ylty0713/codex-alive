const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');
class PeopleStore{
 constructor(dir,crypto){this.file=path.join(dir,'people.encrypted');this.crypto=crypto;this.queue=Promise.resolve()}
 async list(){try{return JSON.parse(this.crypto.decryptString(await fs.readFile(this.file)))}catch(e){if(e.code==='ENOENT')return [];throw Error('人物档案无法解密，未覆盖原文件。')}}
 update(fn){this.queue=this.queue.catch(()=>{}).then(async()=>{if(!this.crypto.isEncryptionAvailable())throw Error('本机加密服务不可用');const rows=await this.list(),next=fn(rows);await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(this.file,this.crypto.encryptString(JSON.stringify(next)));return next});return this.queue}
 save(data){if(data?.consent!==true||typeof data.name!=='string'||!data.name.trim()||data.name.length>40||!Array.isArray(data.descriptors)||data.descriptors.length<3||data.descriptors.length>8||!data.descriptors.every(d=>Array.isArray(d)&&d.length===128&&d.every(n=>Number.isFinite(n)&&Math.abs(n)<10)))throw Error('需要本人同意、姓名与稳定的人脸样本');return this.update(rows=>{if(rows.length>=30)throw Error('档案已达30人，请先删除不需要的档案');return [...rows,{id:randomUUID(),name:data.name.trim(),descriptors:data.descriptors,createdAt:new Date().toISOString()}]})}
 remove(id){return this.update(rows=>rows.filter(p=>p.id!==id))}
}
module.exports={PeopleStore};
