const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
function normalizeBody(value={}){
 const v=value&&typeof value==='object'?value:{};
 return {gesture:['none','nod','tilt','settle','wave','explain'].includes(v.gesture)?v.gesture:'none',expression:v.expression==='softSmile'?'softSmile':'neutral',gaze:v.gaze==='away'?'away':'user',intensity:Number.isFinite(v.intensity)?Math.max(0,Math.min(.7,v.intensity)):.35};
}
function intentPath(thread){
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(thread||''))throw Error('A valid thread ID is required');
 return path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'codex-alive','body-intents',thread+'.json');
}
function readIntents(file){try{const value=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(value)?value:[value]}catch{return []}}
function writeIntent(thread,body){const file=intentPath(thread),value={id:crypto.randomUUID(),createdAt:Date.now(),body:normalizeBody(body)};fs.mkdirSync(path.dirname(file),{recursive:true});const pending=readIntents(file).filter(v=>value.createdAt-v.createdAt<120000).slice(-99);const tmp=file+'.'+value.id;fs.writeFileSync(tmp,JSON.stringify([...pending,value]));fs.renameSync(tmp,file);return value;}
function takeIntent(thread,eventTime,seen){try{const eligible=readIntents(intentPath(thread)).filter(v=>eventTime>=v.createdAt&&eventTime-v.createdAt<=120000&&!seen.has(v.id));for(const v of eligible)seen.add(v.id);while(seen.size>1000)seen.delete(seen.values().next().value);return normalizeBody(eligible.at(-1)?.body)}catch{return normalizeBody()}}
function parseReply(answer){try{const value=JSON.parse(answer.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));if(typeof value.text==='string'&&value.text.trim())return {text:value.text.slice(0,12000),body:normalizeBody(value.body)}}catch{}
 // Never narrate malformed control objects as speech.
 return {text:/^\s*(?:```|\{)/.test(answer)?'我刚才没组织好这句话，请再说一次。':answer.slice(0,12000),body:normalizeBody()};
}
module.exports={normalizeBody,intentPath,writeIntent,takeIntent,parseReply};
