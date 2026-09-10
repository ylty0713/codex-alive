import * as THREE from 'three';
export class MotionDirector{
 constructor(){this.settings={enabled:true,intensity:.55,frequency:.5,breathing:.5};this.applied=[];this.gesture=null;this.next=5;this.random=Math.random()*20;this.look={x:0,y:0};this.lookTarget={x:0,y:0};this.nextLook=2;}
 attach(bones){this.bones=new Map(bones.map(b=>[b.name,b]));}
 trigger(kind,time){this.gesture={kind,start:time,duration:kind==='wave'?3.6:kind==='stretch'?4.5:2.8};}
 before(){for(const [bone,q] of this.applied.reverse())bone.quaternion.multiply(q.invert());this.applied=[];}
 turnWorld(bone,from,to){const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()),delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());const local=parent.clone().invert().multiply(delta).multiply(parent),old=bone.quaternion.clone();bone.quaternion.premultiply(local);this.applied.push([bone,old.invert().multiply(bone.quaternion)]);bone.updateWorldMatrix(false,true);}
 waveArm(amount,phase){const upper=this.bones.get('CC_Base_R_Upperarm'),fore=this.bones.get('CC_Base_R_Forearm'),hand=this.bones.get('CC_Base_R_Hand');if(!upper||!fore||!hand)return;const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=fore.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3());const target=wrist.clone().lerp(new THREE.Vector3(-.30,1.55,.12),amount);const l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(wrist),direction=target.clone().sub(shoulder);const distance=THREE.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+.001,l1+l2-.001);direction.normalize();const a=(l1*l1-l2*l2+distance*distance)/(2*distance),b=Math.sqrt(Math.max(0,l1*l1-a*a));const pole=new THREE.Vector3(-1,-1,.2);pole.addScaledVector(direction,-pole.dot(direction)).normalize();const bend=shoulder.clone().addScaledVector(direction,a).addScaledVector(pole,b);this.turnWorld(upper,elbow.clone().sub(shoulder),bend.sub(shoulder));const pivot=fore.getWorldPosition(new THREE.Vector3());this.turnWorld(fore,hand.getWorldPosition(new THREE.Vector3()).sub(pivot),target.sub(pivot));this.rotate('R_Hand',0,Math.sin(phase*Math.PI*12)*.24*amount,0);}
 rotate(name,x,y,z){const b=this.bones?.get('CC_Base_'+name);if(!b)return;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));b.quaternion.multiply(q);this.applied.push([b,q]);}
 update(dt,time,speaking,tracked){const s=this.settings;if(!s.enabled)return;const amount=s.intensity;
 if(time>this.nextLook){this.nextLook=time+3+Math.random()*5;this.lookTarget={x:(Math.random()-.5)*.32,y:(Math.random()-.5)*.12}}
 this.look.x=THREE.MathUtils.damp(this.look.x,this.lookTarget.x,1.5,dt);this.look.y=THREE.MathUtils.damp(this.look.y,this.lookTarget.y,1.5,dt);
 this.rotate('Spine01',Math.sin(time*1.35)*.012*s.breathing,0,Math.sin(time*.46+this.random)*.012*amount);
 this.rotate('Spine02',Math.sin(time*1.35-.3)*.009*s.breathing,Math.sin(time*.37)*.012*amount,0);
 if(!tracked)this.rotate('NeckTwist01',this.look.y*amount,this.look.x*amount,0);
 if(s.frequency>0&&time>this.next){this.next=time+8+(1-s.frequency)*22+Math.random()*10;this.trigger(speaking?['nod','explain','tilt'][Math.floor(Math.random()*3)]:['look','tilt','settle'][Math.floor(Math.random()*3)],time)}
 const g=this.gesture;if(!g)return;const p=(time-g.start)/g.duration;if(p>=1){this.gesture=null;return}const e=Math.sin(Math.PI*Math.max(0,p))**2*amount;
 if(g.kind==='nod')this.rotate('Head',Math.sin(p*Math.PI*4)*.10*e,0,0);
 if(g.kind==='tilt')this.rotate('Head',0,0,.08*e);
 if(g.kind==='look')this.rotate('Head',0,Math.sin(p*Math.PI*2)*.2*e,0);
 if(g.kind==='settle')this.rotate('Spine01',0,.035*e,.025*e);
 if(g.kind==='wave')this.waveArm(Math.sin(Math.PI*Math.max(0,p))**2*Math.min(1,amount*1.7),p);
 if(g.kind==='explain'){this.rotate('L_Upperarm',-.2*e,0,.22*e);this.rotate('L_Forearm',0,.55*e,0);this.rotate('Head',-.025*e,0,0)}
 if(g.kind==='stretch'){this.rotate('L_Upperarm',0,0,.22*e);this.rotate('R_Upperarm',0,0,-.22*e);this.rotate('Spine02',-.06*e,0,0)}
 }
}
