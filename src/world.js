import * as THREE from 'three';
export function createWorld(scene) {
  const group=new THREE.Group();scene.add(group);
  const light=new THREE.HemisphereLight('#e4f4ff','#b6bba4',1.0);scene.add(light);
  const sun=new THREE.DirectionalLight('#fff3dc',1.8);sun.position.set(-3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.012;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight('#ffe1de',.65);fill.position.set(3,2,-3);scene.add(fill);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(75,32,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#87b8cf')},bottom:{value:new THREE.Color('#e9eee1')}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform vec3 top;uniform vec3 bottom;void main(){float h=smoothstep(-.05,.65,normalize(p).y);gl_FragColor=vec4(mix(bottom,top,h),1.);}' }));group.add(sky);
  const groundMat=new THREE.MeshStandardMaterial({color:'#b7c59e',roughness:1});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;group.add(ground);
  const path=new THREE.Mesh(new THREE.CircleGeometry(2.6,96),new THREE.MeshStandardMaterial({color:'#d0d2b5',roughness:1,transparent:true,opacity:.55,depthWrite:false}));path.rotation.x=-Math.PI/2;path.position.y=.002;path.scale.set(1.3,.74,1);group.add(path);
  let seed=73;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  // Distant softened hills are genuinely three-dimensional terrain silhouettes.
  const hills=new THREE.Group();group.add(hills);
  for(let row=0;row<3;row++){
    const p=[],ids=[];
    for(let i=0;i<=100;i++){const x=-45+i*.9,h=.9+Math.sin(x*.24+row)*.6+Math.sin(x*.55+row*.6)*.22; p.push(x,-.01,-16-row*6,x,h+row*.2,-16-row*6);if(i<100){const k=i*2;ids.push(k,k+2,k+1,k+1,k+2,k+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ids);g.computeVertexNormals();
    const h=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:['#afc0ac','#a7bbb0','#a3b8b3'][row],side:THREE.DoubleSide}));hills.add(h);
  }
  const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.021,.16,3),new THREE.MeshStandardMaterial({color:'#93ad78',roughness:1,side:THREE.DoubleSide}),1500);
  const dummy=new THREE.Object3D(),col=new THREE.Color();
  for(let i=0;i<1500;i++) {
    let x=(rand()-.5)*22,z=(rand()-.5)*18;
    if(Math.abs(x)<2.6&&Math.abs(z)<1.4)z+=z>=0?1.7:-1.7;
    dummy.position.set(x,.05,z);dummy.rotation.set(rand()*.2,rand()*Math.PI,rand()*.25);let s=.5+rand()*.8;dummy.scale.set(s,s,s);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);col.setHSL(.21+rand()*.025,.19+rand()*.13,.48+rand()*.14);grass.setColorAt(i,col);
  }group.add(grass);
  const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.002,.003,.1,4),new THREE.MeshBasicMaterial({color:'#8b9f71'}),180);
  const petals=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),new THREE.MeshBasicMaterial({color:'#fff9e5'}),900);
  const centers=new THREE.InstancedMesh(new THREE.SphereGeometry(.008,8,6),new THREE.MeshBasicMaterial({color:'#dcb878'}),180);
  for(let i=0;i<180;i++){
    let x=(rand()-.5)*15,z=(rand()-.5)*11;if(Math.abs(x)<2.5&&Math.abs(z)<1.4)z+=2.6;
    const h=.085+rand()*.08;
    dummy.position.set(x,h/2,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,h/.1,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
    dummy.position.y=h;dummy.scale.set(1,1,1);dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<5;j++){const a=j/5*Math.PI*2;dummy.position.set(x+Math.sin(a)*.012,h,z+Math.cos(a)*.012);dummy.rotation.set(0,a,0);dummy.scale.set(.007,.003,.014);dummy.updateMatrix();petals.setMatrixAt(i*5+j,dummy.matrix);}
  }group.add(stems,petals,centers);
  const clouds=new THREE.Group();group.add(clouds);
  for(let i=0;i<16;i++){
    const x=(rand()-.5)*60,z=-25-rand()*25,y=6+rand()*9;
    for(let j=0;j<3;j++){const cloud=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:'#f1f4ed',transparent:true,opacity:.65,depthWrite:false}));cloud.position.set(x+j*1.5,y+rand()*.5,z);cloud.scale.set(2.8, .5+rand()*.6,1.1);clouds.add(cloud);}
  }
  const studio=new THREE.Group();scene.add(studio);studio.visible=false;
  const studioGround=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#dfd8d1',roughness:1}));studioGround.rotation.x=-Math.PI/2;studioGround.position.y=-.002;studioGround.receiveShadow=true;studio.add(studioGround);
  function setMode(mode){const meadow=mode!=='studio';group.visible=meadow;studio.visible=!meadow;scene.background=new THREE.Color(meadow?'#cdded8':'#e9e4df');scene.fog=new THREE.Fog(meadow?'#d4e1d3':'#e9e4df',meadow?9:10,meadow?38:35);}
  setMode('meadow');
  return {ground,setMode,update:(t,reduced)=>{clouds.position.x=reduced?0:Math.sin(t*.008)*1.5;}};
}
