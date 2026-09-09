export function matchPerson(descriptor,people){
 const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
 const candidates=people.map(p=>({person:p,distance:Math.min(...p.descriptors.map(d=>distance(descriptor,d)))})).sort((a,b)=>a.distance-b.distance);
 if(!candidates.length)return {kind:'unknown'};const [best,second]=candidates;
 if(best.distance<.45&&(!second||second.distance-best.distance>.08))return {kind:'known',person:best.person,distance:best.distance};
 return {kind:best.distance>.6?'unknown':'uncertain',distance:best.distance};
}
export class PresenceGate{
 constructor(){this.key='';this.since=0;this.lastPrompt=-Infinity;this.greeted=new Map()}
 update(result,now){const key=result.kind==='known'?result.person.id:result.kind;if(key!==this.key){this.key=key;this.since=now;return null}if(now-this.since<3000)return null;
 if(result.kind==='unknown'&&now-this.lastPrompt>90000){this.lastPrompt=now;return {text:'之前好像没见过你，请问你叫什么名字？',unknown:true}}
 if(result.kind==='known'&&now-(this.greeted.get(key)??-Infinity)>300000){this.greeted.set(key,now);return {text:`你好，${result.person.name}，很高兴见到你。`}}return null;
 }
}
