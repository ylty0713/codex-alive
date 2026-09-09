class Capture extends AudioWorkletProcessor{
 constructor(){super();this.data=[];this.phase=0}
 process(inputs){const input=inputs[0]?.[0];if(!input)return true;for(const value of input){this.phase+=16000;if(this.phase>=sampleRate){this.phase-=sampleRate;this.data.push(Math.max(-32768,Math.min(32767,Math.round(value*32767))))}}if(this.data.length>=4000){const pcm=new Int16Array(this.data);this.port.postMessage(pcm.buffer,[pcm.buffer]);this.data=[]}return true}
}
registerProcessor('companion-capture',Capture);
