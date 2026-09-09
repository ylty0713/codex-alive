import {pinyin} from '../node_modules/pinyin-pro/dist/index.mjs';
export function makeTimeline(words){const result=[];for(const w of words||[]){const syllables=pinyin(w.text,{toneType:'none',type:'array'});const duration=w.duration/Math.max(1,syllables.length);syllables.forEach((s,i)=>result.push({start:w.start+i*duration,end:w.start+(i+1)*duration,syllable:s.toLowerCase()}))}return result}
export function lipTarget(timeline,time,energy){
 const s=timeline.find(s=>time>=s.start&&time<s.end),e=Math.max(0,Math.min(1,(energy-.005)*16));
 const target={jawOpen:e*.19,mouthFunnel:0,mouthPucker:0,mouthStretchLeft:0,mouthStretchRight:0,mouthClose:0};if(!s||e<.02)return target;
 const phase=(time-s.start)/Math.max(.01,s.end-s.start),text=s.syllable;
 if(/^[bpm]/.test(text)&&phase<.2){target.jawOpen=0;target.mouthClose=.25*e;return target}
 if(/[ouüv]/.test(text)){target.mouthFunnel=.2*e;target.mouthPucker=.12*e;target.jawOpen*=.65}
 else if(/[ie]/.test(text)){target.mouthStretchLeft=target.mouthStretchRight=.1*e;target.jawOpen*=.7}
 if(/a/.test(text))target.jawOpen=Math.min(.24,e*.23);return target;
}
