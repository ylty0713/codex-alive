const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const env={...process.env,RIN_PROFILE_DIR:path.resolve('.runtime/smoke-profile')};delete env.ELECTRON_RUN_AS_NODE;
  let app;
  const report={};
  try{
    app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
    const page=await app.firstWindow(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.waitForFunction(()=>!!window.rinApp,null,{timeout:30000});
    await page.locator('#autonomy').uncheck();await page.evaluate(()=>window.rinApp.setScene('meadow'));
    await page.waitForFunction(()=>document.querySelector('#voice').options[0]?.value);
    report.voices=await page.locator('#voice').textContent();assert.match(report.voices,/zh-CN/);
    const before=await page.evaluate(()=>window.rinApp.getState().position[0]);
    await page.locator('[data-action="walking"]').click();await page.waitForTimeout(2400);
    const after=await page.evaluate(()=>window.rinApp.getState().position[0]);assert.ok(Math.abs(after-before)>.08);report.walkDistance=after-before;
    await page.locator('#stop').click();const yawBefore=await page.evaluate(()=>window.rinApp.getState().yaw);await page.locator('#rotate').click();await page.waitForTimeout(1300);
    report.turnAngle=(await page.evaluate(()=>window.rinApp.getState().yaw))-yawBefore;assert.ok(report.turnAngle>.5);
    await page.locator('#stop').click();
    await page.locator('[data-action="wave"]').click();await page.waitForTimeout(700);
    report.armAngle=await page.evaluate(()=>window.rinApp.rin.bones.UpperArmR.rotation.z);assert.ok(report.armAngle<-.9);
    await page.locator('#stop').click();
    const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.rinApp.exportModel())));
    const buffer=Buffer.from(bytes);assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);
    const jsonLen=buffer.readUInt32LE(12),gltf=JSON.parse(buffer.toString('utf8',20,20+jsonLen));
    assert.ok(gltf.skins?.length);assert.ok(gltf.animations?.length);report.model={bytes:buffer.length,meshes:gltf.meshes.length,skins:gltf.skins.length,animations:gltf.animations.map(a=>a.name)};
    await fs.mkdir('assets',{recursive:true});await fs.writeFile('assets/rin-base-rig.glb',buffer);
    report.roundTrip=await page.evaluate(async bytes=>{const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const data=await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer,'');let skinned=0;data.scene.traverse(o=>{if(o.isSkinnedMesh)skinned++;});return {skinned,animations:data.animations.length};},bytes);
    assert.ok(report.roundTrip.skinned>70);
    // Generate and decode actual local Chinese speech. Playback is tested at zero gain.
    report.speech=await page.evaluate(async()=>{const voices=await window.desktop.voices();const voice=voices.voices.find(v=>v.lang==='zh-CN').name;const r=await window.desktop.synthesize('你好，我是凛。',voice,0);if(!r.ok)throw new Error(r.error);const a=Uint8Array.from(atob(r.audio),c=>c.charCodeAt(0));const bytes=a.length;const ctx=new AudioContext();const decoded=await ctx.decodeAudioData(a.buffer);const seconds=decoded.duration;await ctx.close();return {bytes,seconds};});
    assert.ok(report.speech.seconds>1);assert.ok(report.speech.bytes>1000);
    // The regular UI audio path should enter speaking and be interruptible.
    await page.evaluate(()=>{window.rinApp.speak('你好，我是凛，你的桌面伙伴。');});
    await page.waitForFunction(()=>window.rinApp.getState().speaking,null,{timeout:20000});
    await page.waitForFunction(()=>window.rinApp.rin.root.getObjectByName('Mouth').scale.y>.004,null,{timeout:10000});report.audioDrivenMouth=true;
    await page.locator('#stop').click();assert.equal(await page.evaluate(()=>window.rinApp.getState().speaking),false);report.interrupt=true;
    report.wallpaper=await page.evaluate(()=>window.desktop.wallpaper(true));
    if(report.wallpaper.ok){
      await page.waitForTimeout(1200);
      report.wallpaper.windows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),focusable:w.isFocusable(),url:w.webContents.getURL()})));
      const stop=await page.evaluate(()=>window.desktop.wallpaper(false));assert.equal(stop.enabled,false);
    }
    await page.locator('#stop').click();await page.evaluate(()=>{window.rinApp.rin.root.position.set(.36,0,0);window.rinApp.rin.root.rotation.y=0;window.rinApp.setScene('meadow');});await page.locator('#camera-reset').click();
    await page.waitForTimeout(1200);await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/app.png'});
    await page.locator('#face-view').click();await page.waitForTimeout(400);await page.screenshot({path:'test-results/face.png'});
    report.errors=errors;assert.deepEqual(errors,[]);
    await fs.writeFile('test-results/smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
