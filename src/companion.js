export const states = new Set(['idle','listening','thinking','speaking','wave','walking']);
export function localReply(input, now=new Date()) {
  const text=String(input).trim().slice(0,2000);
  if(!text)return {text:'',action:'idle'};
  if(/几点|时间/.test(text))return {text:`现在是${now.getHours()}点${now.getMinutes()}分。`,action:'idle'};
  if(/日期|几号|星期/.test(text))return {text:`今天是${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日，星期${'日一二三四五六'[now.getDay()]}。`,action:'idle'};
  if(/挥手|你好|早上好|晚上好|嗨/.test(text))return {text:'你好，我是凛。我在这里。',action:'wave'};
  if(/走|散步/.test(text))return {text:'好，我在这里走一会儿。',action:'walking'};
  if(/转身|转一圈/.test(text))return {text:'好呀，转一圈给你看。',action:'turn'};
  if(/安静|停止|别说|闭嘴/.test(text))return {text:'',action:'stop'};
  if(/谢谢/.test(text))return {text:'不用客气。',action:'wave'};
  if(/累|疲惫/.test(text))return {text:'辛苦了。要不要先喝口水，休息一小会儿？',action:'idle'};
  if(/晚安|睡觉/.test(text))return {text:'晚安。祝你做个好梦。',action:'idle'};
  if(/你是谁|介绍/.test(text))return {text:'我是凛，你的桌面伙伴。现在我会走动、挥手、报时和朗读。这一版还不能自由聊天。',action:'wave'};
  return {text:'我现在还在学习和你交流。这一版可以对我说：挥挥手、走一走、转一圈，或者问我现在几点。你也可以切换到朗读，让我念出你写的话。',action:'idle'};
}
export function angleTowards(current,target,maxStep) {
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+Math.sign(delta)*Math.min(Math.abs(delta),maxStep);
}
export function validatePreferences(value={}) {
  return {muted:!!value.muted,reducedMotion:!!value.reducedMotion,autonomy:value.autonomy!==false,scene:value.scene==='studio'?'studio':'meadow',voice:typeof value.voice==='string'?value.voice.slice(0,200):'',rate:Math.max(-3,Math.min(3,Number(value.rate)||0))};
}
