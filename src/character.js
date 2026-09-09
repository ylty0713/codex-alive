import * as THREE from 'three';

// All shapes are authored in metres, facing +Z. No image planes are used for the body.
// The modest first-pass mesh remains editable here, and can be exported as skinned GLB.
export function createRin() {
  const root = new THREE.Group(); root.name = 'Rin';
  const bones = {}, bind = {}, materials = {};
  const palette = {skin: '#ffe0ca', hair: '#965968', hairLight: '#a96575', hairDark: '#794456', blouse: '#dce5e9', trim: '#faf0e8', pink: '#dca5aa', skirt: '#c28c96', skirtLight: '#ebbec1', sole: '#aa8570', lash: '#503035', iris: '#88433e', white: '#fff9f2'};
  const ramp = new THREE.DataTexture(new Uint8Array([145, 207, 244, 255]), 4, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  for (const [name, color] of Object.entries(palette)) materials[name] = new THREE.MeshToonMaterial({color, gradientMap: ramp});
  for(const name of ['hair','hairLight','hairDark'])materials[name]=new THREE.MeshStandardMaterial({color:palette[name],roughness:.72});
  function bone(name, parent, world) {
    const b = new THREE.Bone(); b.name = name; bind[name] = new THREE.Vector3(...world);
    b.position.copy(bind[name]); if (parent) b.position.sub(bind[parent]);
    (parent ? bones[parent] : root).add(b); bones[name] = b; return b;
  }
  bone('Root', null, [0,0,0]); bone('Hips','Root',[0,.86,0]);
  bone('Spine','Hips',[0,1.045,0]); bone('Chest','Spine',[0,1.23,0]);
  bone('Neck','Chest',[0,1.325,0]); bone('Head','Neck',[0,1.47,0]);
  for (const [side,s] of [['L',1],['R',-1]]) {
    bone(`UpperArm${side}`,'Chest',[s*.185,1.265,0]);
    bone(`LowerArm${side}`,`UpperArm${side}`,[s*.235,1.055,.008]);
    bone(`Hand${side}`,`LowerArm${side}`,[s*.275,.85,.022]);
    bone(`UpperLeg${side}`,'Hips',[s*.091,.865,0]);
    bone(`LowerLeg${side}`,`UpperLeg${side}`,[s*.093,.48,.014]);
    bone(`Foot${side}`,`LowerLeg${side}`,[s*.093,.092,.015]);
  }
  bone('HairBack','Head',[0,1.53,-.09]);
  bone('HairTip','HairBack',[0,1.17,-.12]);
  bone('HairL','Head',[.136,1.48,.075]); bone('HairR','Head',[-.136,1.48,.075]);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(Object.values(bones));
  const indexOf = name => Object.keys(bones).indexOf(name);
  function mesh(geometry, material, name, boneName, weights) {
    geometry.computeVertexNormals();
    let m;
    if (boneName) {
      const count=geometry.attributes.position.count, indices=[], values=[];
      for (let i=0;i<count;i++) {
        const p = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i);
        const w=weights ? weights(p) : [[boneName,1]];
        for (let j=0;j<4;j++) { indices.push(w[j]?indexOf(w[j][0]):0); values.push(w[j]?.[1]??0); }
      }
      geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
      geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));
      m = new THREE.SkinnedMesh(geometry,material); m.bind(skeleton);
    } else m=new THREE.Mesh(geometry,material);
    m.name=name; m.castShadow=true; m.receiveShadow=true; root.add(m); return m;
  }
  function ellipsoid(name, mat, pos, scale, boneName, segments=32) {
    const g=new THREE.SphereGeometry(1,segments,24); g.scale(...scale); g.translate(...pos);
    return mesh(g,materials[mat],name,boneName);
  }
  function rings(name,mat,rows,boneName,{segments=48,modify,weights}={}) {
    const p=[],uv=[],ids=[];
    rows.forEach(([y,rx,rz,cx=0,cz=0],j)=>{
      for(let i=0;i<=segments;i++) {
        const a=i/segments*Math.PI*2;
        let v=new THREE.Vector3(cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz);
        if(modify) v=modify(v,a,j,rows.length);
        p.push(v.x,v.y,v.z); uv.push(i/segments,j/(rows.length-1));
        if(j<rows.length-1&&i<segments){let k=j*(segments+1)+i;ids.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
      }
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);
    return mesh(g,materials[mat],name,boneName,weights);
  }
  const blend=(a,b,y0,y1)=>p=>{const t=THREE.MathUtils.smoothstep(p.y,y0,y1);return [[a,t],[b,1-t]];};
  rings('Body','skin',[[.84,.10,.063],[1.00,.125,.075],[1.11,.122,.074],[1.23,.15,.075],[1.285,.10,.056]],'Spine');
  rings('Neck','skin',[[1.27,.044,.045],[1.36,.041,.044],[1.39,.048,.047]],'Neck');
  // A deliberately shaped chin/jaw profile instead of a spherical head.
  const faceProfile=[[1.325,.006,.01,0,.04],[1.341,.039,.041,0,.038],[1.366,.075,.065,0,.026],[1.404,.114,.093,0,.005],[1.454,.140,.118],[1.51,.145,.122],[1.565,.130,.110],[1.61,.093,.08],[1.634,.015,.017]];
  const faceCurve=new THREE.CatmullRomCurve3(faceProfile.map(r=>new THREE.Vector3(r[1],r[0],r[2])));
  const faceRows=Array.from({length:36},(_,i)=>{const p=faceCurve.getPoint(i/35),z=p.y<1.454?THREE.MathUtils.lerp(.04,0,(p.y-1.325)/.129):0;return [p.y,p.x,p.z,0,z];});
  rings('Face','skin',faceRows,'Head');
  for(const s of [-1,1]) ellipsoid('Ear','skin',[s*.139,1.437,0],[.017,.032,.018],'Head');
  // Sleeves and body clothing follow the official layered silhouette.
  const cloth=materials.blouse.clone();cloth.side=THREE.DoubleSide;
  const tunic=rings('Asymmetric pale tunic','blouse',[[.95,.27,.15],[1.015,.169,.11],[1.09,.148,.098],[1.17,.16,.107],[1.255,.177,.084],[1.294,.09,.05]],'Spine',{
    modify:(p,a,j)=>{if(j===0)p.y-=.225*Math.pow(Math.abs(Math.sin(a)),7);p.z+=.002*Math.cos(a*16);return p;},
    weights:blend('Chest','Spine',1.09,1.23)
  });tunic.material=cloth;
  // Skirt stripes are actual connected three-dimensional bands.
  const skirtRows=[[.785,.248,.16],[.81,.245,.157],[.85,.225,.148],[.885,.206,.132],[.94,.177,.119],[1.005,.15,.094]];
  for(let j=0;j<skirtRows.length-1;j++) {
    const skirt=rings('Skirt band '+j,j===1||j===3?'skirtLight':'skirt',skirtRows.slice(j,j+2),'Hips',{modify:(p,a,k)=>{
      const pleat=.006*Math.cos(a*12);p.x+=Math.sin(a)*pleat;p.z+=Math.cos(a)*pleat;
      if(j===0&&k===0)p.y+=.004*Math.cos(a*24);return p;
    }});skirt.material=skirt.material.clone();skirt.material.side=THREE.DoubleSide;
  }
  function tube(name,mat,points,radius,boneName) {
    const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*6),radius,7,false);
    return mesh(g,materials[mat],name,boneName);
  }
  tube('Neckline','trim',[[-.085,1.292,.03],[-.062,1.277,.057],[0,1.269,.077],[.062,1.277,.057],[.085,1.292,.03]],.003,'Chest');
  for(const s of [-1,1]) {
    const pts=[];for(let i=0;i<=30;i++){let y=.96+i*.01;let z=y<1.015?.149-(y-.95)*.6:y<1.10?.116:.113;pts.push([s*(.022+.004*Math.sin(i*1.7)),y,z]);}
    tube('Front ruffle','trim',pts,.004,'Spine');
  }
  for(let i=0;i<8;i++){const y=.968+i*.04,z=y<1.015?.149-(y-.95)*.6:.116;ellipsoid('Button','sole',[0,y,z],[.004,.004,.0025],'Spine',12);}
  for (const [side,s] of [['L',1],['R',-1]]) {
    const ua=`UpperArm${side}`,la=`LowerArm${side}`,hand=`Hand${side}`,ul=`UpperLeg${side}`,ll=`LowerLeg${side}`,foot=`Foot${side}`;
    rings('Upper sleeve '+side,'blouse',[[1.12,.066,.061,s*.222,.001],[1.20,.064,.065,s*.20,0],[1.265,.06,.068,s*.18,0],[1.288,.019,.031,s*.16,0]],ua);
    rings('Pink sleeve '+side,'pink',[[.846,.039,.036,s*.274,.02],[.87,.05,.044,s*.272,.018],[.925,.041,.039,s*.259,.015],[1.025,.04,.039,s*.24,.008],[1.095,.047,.044,s*.228,.004],[1.18,.048,.046,s*.208,0]],ua,{weights:blend(ua,la,1.035,1.095),modify:(p,a,j)=>{if(j===1)p.y+=.004*Math.sin(a*5);return p;}});
    rings('Cuff '+side,'trim',[[.84,.04,.036,s*.275,.02],[.858,.042,.039,s*.273,.02]],la);
    ellipsoid('Palm '+side,'skin',[s*.277,.812,.023],[.029,.041,.016],hand);
    for(let k=0;k<4;k++) {
      const x=s*(.257+k*.013),len=[.038,.047,.045,.034][k];
      tube('Finger '+side+k,'skin',[[x,.80,.024],[x+s*.003,.78,.027],[x+s*.005,.80-len,.029]],.006,hand);
    }
    tube('Thumb '+side,'skin',[[s*.254,.83,.03],[s*.239,.808,.04],[s*.235,.793,.042]],.008,hand);
    rings('Leg '+side,'skin',[[.085,.026,.033,s*.093,.015],[.17,.029,.032,s*.093,.007],[.29,.045,.048,s*.093,-.004],[.39,.041,.044,s*.093,.004],[.475,.037,.039,s*.093,.016],[.52,.041,.043,s*.093,.014],[.65,.06,.061,s*.092,.004],[.79,.069,.07,s*.091,0],[.89,.069,.069,s*.09,0]],ul,{weights:blend(ul,ll,.45,.51)});
    ellipsoid('Foot '+side,'skin',[s*.093,.056,.055],[.034,.031,.079],foot);
    ellipsoid('Sandal sole '+side,'sole',[s*.093,.021,.049],[.04,.014,.095],foot);
    tube('Toe strap '+side,'trim',[[s*.093-.038,.04,.082],[s*.093-.022,.073,.087],[s*.093,.085,.089],[s*.093+.023,.072,.087],[s*.093+.038,.04,.082]],.008,foot);
    tube('Ankle tie '+side,'trim',[[s*.093-.028,.085,.02],[s*.093,.097,.051],[s*.093+.028,.085,.02],[s*.093,.083,-.022],[s*.093-.028,.085,.02]],.006,foot);
    bow('Sandal bow '+side,[s*.093,.105,.063],.044,foot);
  }
  function petal(name,mat,points,widths,depth,boneName,weights) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),p=[],ids=[];
    const steps=26,around=10;
    for(let j=0;j<=steps;j++) {
        const t=j/steps,c=curve.getPoint(t),tip=t>.65?Math.pow((1-t)/.35,.65):1,w=THREE.MathUtils.lerp(widths[0],widths[1],t)*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.55)*tip+.00005;
      for(let i=0;i<=around;i++){const a=i/around*Math.PI*2;p.push(c.x+Math.cos(a)*w,c.y,c.z+Math.sin(a)*depth*Math.sin(Math.PI*t));if(j<steps&&i<around){let k=j*(around+1)+i;ids.push(k,k+1,k+around+1,k+1,k+around+2,k+around+1);}}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ids);return mesh(g,materials[mat],name,boneName,weights);
  }
  function bow(name,pos,size,boneName) {
    const [x,y,z]=pos;
    for(const s of [-1,1]) {
      // Loop and ribbon end with actual thickness.
      petal(name+' loop','white',[[x,y,z],[x+s*size*.62,y+size*.65,z],[x+s*size,y+size*.72,z-.006]],[size*.23,size*.24],size*.12,boneName);
      petal(name+' tail','white',[[x,y,z],[x+s*size*.32,y-size*.56,z+.002],[x+s*size*.48,y-size,z+.006]],[size*.17,size*.21],.003,boneName);
    }
    ellipsoid(name+' knot','white',pos,[size*.19,size*.2,size*.15],boneName,16);
  }
  // Hair cap covers the back of the head; forehead remains visible.
  const cap=new THREE.SphereGeometry(1,48,28,0,Math.PI*2,0,Math.PI*.57);
  const cp=cap.attributes.position;
  for(let i=0;i<cp.count;i++){
    const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i),phi=Math.atan2(x,z),theta=Math.acos(THREE.MathUtils.clamp(y,-1,1));
    const limit=1.76-.7*Math.max(0,Math.cos(phi));const a=theta/(Math.PI*.57)*limit;
    cp.setXYZ(i,Math.sin(phi)*Math.sin(a)*.152,1.481+Math.cos(a)*.18,-.012+Math.cos(phi)*Math.sin(a)*.132);
  }
  mesh(cap,materials.hair,'Hair crown','Head');
  for(let i=0;i<15;i++) {
    const a=-Math.PI*.76+i/14*Math.PI*1.52,x=Math.sin(a)*.126,z=-Math.cos(a)*.117;
    petal('Long back hair '+i,i%4===1?'hairLight':i%4===3?'hairDark':'hair',[[x*.45,1.636,z*.5-.015],[x*1.13,1.475,z-.025],[x*1.28,1.21,z-.05],[x*1.4+Math.sin(i)*.016,1.015+(i%3)*.017,z-.025],[x*1.28,.966+(i%4)*.018,z+.015]],[.035,.025],.012,'HairBack',blend('HairBack','HairTip',1.10,1.31));
  }
  // Layered diagonal fringe leaves both eyes exposed.
  const fringe=[[-.111,-.117,1.486,.04],[-.075,-.081,1.535,.043],[-.036,-.030,1.511,.046],[.005,.032,1.526,.043],[.045,.084,1.532,.039],[.09,.137,1.49,.034]];
  fringe.forEach(([x,end,y,w],i)=>petal('Fringe '+i,i%2?'hairLight':'hair',[[x*.7,1.651,.018],[x-.012,1.611,.108],[end-.008,1.566,.137],[end+.015,y,.13]],[w,w*.7],.006,'Head'));
  for(const s of [-1,1]) {
    const side=s>0?'L':'R';
    petal('Long front lock '+side,'hair',[[s*.138,1.536,.074],[s*.151,1.391,.094],[s*.153,1.215,.106],[s*.164,1.076,.1],[s*.157,1.018,.118]],[.023,.014],.014,`Hair${side}`);
    petal('Side lock '+side,'hairLight',[[s*.137,1.572,.018],[s*.165,1.426,.011],[s*.193,1.214,.0],[s*.181,1.054,.047]],[.023,.01],.012,`Hair${side}`);
    for(let i=0;i<8;i++) {
      const a=i/7;ellipsoid('Side braid '+side+i,i%2?'hairLight':'hair',[s*(.073+a*.066),1.624-a*.12,.035+a*.026],[.019,.016,.014],'Head',16);
    }
  }
  bow('Hair white ribbon',[-.16,1.505,-.035],.075,'Head');
  // Face details sit on the shaped surface and rotate with the head bone.
  const eyeGroups=[];
  function attach(object,name,pos,boneName) {object.name=name;object.position.set(...pos).sub(bind[boneName]);bones[boneName].add(object);return object;}
  function faceShape(points,mat){const sh=new THREE.Shape();sh.moveTo(...points[0]);for(const p of points.slice(1))sh.quadraticCurveTo(...p);return new THREE.Mesh(new THREE.ShapeGeometry(sh,24),materials[mat]);}
  for(const s of [-1,1]) {
    const eye=new THREE.Group();attach(eye,'Eye '+s,[s*.061,1.46,.12],'Head');eye.rotation.y=s*.28;
    const white=faceShape([[-.037,0],[-.025,.033,0,.033],[.03,.034,.038,.004],[.024,-.023,0,-.025],[-.027,-.025,-.037,0]],'white');eye.add(white);
    const iris=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),materials.iris);iris.scale.set(.019,.027,.0025);iris.position.set(0,.001,.003);eye.add(iris);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),materials.lash);pupil.scale.set(.0075,.017,.001);pupil.position.set(0,.005,.006);eye.add(pupil);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),materials.skirtLight);glow.scale.set(.011,.006,.001);glow.position.set(0,-.015,.006);eye.add(glow);
    for(const [x,y,scale] of [[-.006,.014,.007],[.008,-.008,.003]]){const glint=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),materials.white);glint.scale.set(scale,scale,.001);glint.position.set(x,y,.009);eye.add(glint);}
    const lash=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.039,0,.003),new THREE.Vector3(-.025,.027,.003),new THREE.Vector3(.002,.033,.003),new THREE.Vector3(.027,.024,.003),new THREE.Vector3(.04,.009,.003)]),24,.003,6),materials.lash);eye.add(lash);
    const lower=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.03,-.013,.002),new THREE.Vector3(0,-.025,.002),new THREE.Vector3(.029,-.014,.002)]),16,.001,5),materials.hairDark);eye.add(lower);
    const brow=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.027,.05,-.006),new THREE.Vector3(0,.056,-.004),new THREE.Vector3(.027,.05,-.007)]),16,.0023,6),materials.hairDark);eye.add(brow);
    eyeGroups.push({eye,iris,pupil,brow});
    const blushMat=new THREE.MeshBasicMaterial({color:'#e79b96',transparent:true,opacity:.19,depthWrite:false});
    const blush=new THREE.Mesh(new THREE.CircleGeometry(.019,24),blushMat);blush.scale.y=.35;attach(blush,'Cheek',[s*.087,1.414,.096],'Head');blush.rotation.y=s*.5;
  }
  ellipsoid('Nose','skin',[0,1.426,.105],[.009,.014,.016],'Head',20);
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),materials.lash);mouth.scale.set(.015,.0015,.001);attach(mouth,'Mouth',[0,1.384,.093],'Head');
  const lowerLip=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),materials.pink);lowerLip.scale.set(.012,.0015,.001);attach(lowerLip,'Lip',[0,1.378,.094],'Head');
  root.userData={character:'Rin / Shelter',stage:'Procedural base mesh, first rig',source:'https://www.sheltertheanimation.com/',notOfficial:true};
  let blinkAt=2.6, blinkStart=-10;
  const rest={};for(const [name,b] of Object.entries(bones))rest[name]=b.position.clone();
  const damp=THREE.MathUtils.damp;
  let currentSpeed=0;
  function update(dt,t,{state='idle',mouthLevel=0,lookX=0,lookY=0,reducedMotion=false,speed=0}={}) {
    dt=Math.min(dt,.05);currentSpeed=damp(currentSpeed,speed,7,dt);
    const movement=reducedMotion?.18:1,walk=currentSpeed;
    const step=Math.sin(t*7.4),breath=Math.sin(t*1.65)*.0025*movement;
    bones.Hips.position.y=rest.Hips.y+breath+Math.abs(Math.cos(t*7.4))*.007*walk;
    bones.Spine.rotation.z=Math.sin(t*.9)*.012*movement;
    bones.Chest.rotation.x=breath*1.6;
    bones.Head.rotation.y=damp(bones.Head.rotation.y,lookX*.22+(state==='thinking'?.18:0),5,dt);
    bones.Head.rotation.x=damp(bones.Head.rotation.x,-lookY*.12+(state==='listening'?Math.sin(t*2.5)*.025:0),5,dt);
    bones.Head.rotation.z=damp(bones.Head.rotation.z,state==='thinking'?-.07:Math.sin(t*.67)*.018*movement,5,dt);
    for(const [side,s] of [['L',1],['R',-1]]) {
      bones[`UpperLeg${side}`].rotation.x=step*s*.3*walk;
      bones[`LowerLeg${side}`].rotation.x=Math.max(0,-step*s)*.48*walk;
      bones[`Foot${side}`].rotation.x=-Math.max(0,-step*s)*.18*walk;
      const waving=state==='wave'&&side==='R';
      bones[`UpperArm${side}`].rotation.x=damp(bones[`UpperArm${side}`].rotation.x,-step*s*.24*walk+(state==='speaking'?-.12:0),9,dt);
      bones[`UpperArm${side}`].rotation.z=damp(bones[`UpperArm${side}`].rotation.z,waving?-1.85:s*.035,7,dt);
      bones[`LowerArm${side}`].rotation.x=damp(bones[`LowerArm${side}`].rotation.x,waving?-.35:state==='speaking'?-.22+Math.sin(t*3)*.055:-.025,7,dt);
      bones[`Hand${side}`].rotation.z=damp(bones[`Hand${side}`].rotation.z,waving?Math.sin(t*9)*.25:0,9,dt);
      bones[`Hair${side}`].rotation.z=(Math.sin(t*1.3+s)*.017+step*.028*walk)*movement;
    }
    bones.HairBack.rotation.x=(Math.sin(t*1.1)*.018+walk*.045)*movement;
    bones.HairTip.rotation.z=(Math.sin(t*1.25)*.02+step*.02*walk)*movement;
    if(t>blinkAt){blinkStart=t;blinkAt=t+3.2+Math.random()*2.7;}
    const elapsed=t-blinkStart,blink=elapsed<.16?Math.sin(elapsed/.16*Math.PI):0;
    for(const {eye,iris,pupil,brow} of eyeGroups){eye.scale.y=Math.max(.05,1-blink*.97);iris.position.x=lookX*.006;pupil.position.x=lookX*.006;brow.rotation.z=state==='thinking'?.07:0;}
    mouth.scale.y=damp(mouth.scale.y,.0015+mouthLevel*.015,22,dt);mouth.scale.x=damp(mouth.scale.x,.015-mouthLevel*.004,18,dt);
    root.updateMatrixWorld(true);
  }
  function resetPose(){for(const b of Object.values(bones)){b.rotation.set(0,0,0);b.position.copy(rest[b.name]);}for(const {eye} of eyeGroups)eye.scale.y=1;mouth.scale.y=.0015;root.updateMatrixWorld(true);}
  return {root,bones,skeleton,materials,update,resetPose};
}
