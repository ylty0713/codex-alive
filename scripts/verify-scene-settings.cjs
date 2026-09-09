const {_electron:electron}=require('playwright-core'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,RIN_PROFILE_DIR:path.resolve('.runtime/scene-settings-test')};delete env.ELECTRON_RUN_AS_NODE;
 let app;const report={};
 async function launch(){app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});const p=await app.firstWindow();await p.waitForFunction(()=>window.companionPreview?.animationsReady&&window.companionSettings,null,{timeout:120000});await p.locator('#autoread').uncheck();return p}
 try{
  let page=await launch();const initial=await page.evaluate(()=>window.desktop.sceneSettings());report.displays=initial.displays;assert.ok(initial.displays.length);
  await page.locator('#camera-X').fill('1.2');await page.locator('#light-X').fill('-4');await page.locator('#light-power').fill('3.5');
  await page.waitForFunction(async()=>{const r=await window.desktop.sceneSettings();return r.settings.camera.position[0]===1.2&&r.settings.lights[0].position[0]===-4&&r.settings.lights[0].intensity===3.5});
  let result=await page.evaluate(()=>window.desktop.wallpaper(true));assert.ok(result.ok,result.error);const w=app.windows().find(p=>p.url().includes('mode=wallpaper'));await w.waitForFunction(()=>window.companionSettings&&window.companionPreview?.animationsReady,null,{timeout:120000});
  assert.equal(await w.evaluate(()=>window.companionSettings.camera.position.x),1.2);assert.equal(await w.evaluate(()=>window.companionSettings.lights[0].position.x),-4);
  report.placements=[];
  for(const display of initial.displays){result=await page.evaluate(async id=>{const r=await window.desktop.sceneSettings();return window.desktop.saveSceneSettings({...r.settings,displayId:id})},display.id);assert.ok(result.ok,result.error);
   const actual=JSON.parse(fs.readFileSync('desktop/runtime-status.json'));const expected=await app.evaluate(({screen},id)=>{const d=screen.getAllDisplays().find(d=>d.id===id);return screen.dipToScreenRect(null,d.bounds)},display.id);
   for(const key of ['x','y','width','height'])assert.equal(actual.placement[key],expected[key],key);report.placements.push({id:display.id,actual:actual.placement,expected});
  }
  await page.screenshot({path:'previews/scene-settings.png'});await page.evaluate(()=>window.desktop.wallpaper(false));await app.close();app=null;
  page=await launch();const saved=await page.evaluate(()=>window.desktop.sceneSettings());assert.equal(saved.settings.camera.position[0],1.2);assert.equal(saved.settings.lights[0].intensity,3.5);report.savedAcrossRestart=true;report.cameraAndLightSynced=true;fs.writeFileSync('test-results/scene-settings.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(app)await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
