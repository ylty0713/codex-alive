const {_electron:electron}=require('playwright-core');const {CodexBridge,visibleEvent}=require('../desktop/codex-bridge.cjs');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const log=path.resolve('.runtime/progress-speech-test.jsonl');fs.writeFileSync(log,'');
 const progress={type:'response_item',payload:{type:'message',id:'progress-one',role:'assistant',phase:'commentary',content:[{type:'output_text',text:'第一项检查已经完成。接下来，我会继续检查动作和语音是否同步。'}]}};
 assert.equal(visibleEvent(progress).state,'progress');assert.equal(visibleEvent({...progress,payload:{...progress.payload,phase:'analysis'}}),null);
 const final={...progress,payload:{...progress.payload,id:'final-two',phase:'final_answer',content:[{type:'output_text',text:'第二项检查也完成了。两句话会按顺序播放。'}]}};assert.equal(visibleEvent(final).state,'answer');
 const env={...process.env,RIN_PROFILE_DIR:path.resolve('.runtime/progress-speech-profile'),RIN_WATCH_FILE:log};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});let watcher;
 try{const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.companionPreview?.animationsReady&&document.querySelector('#voice').value==='zh-CN-XiaoyiNeural',null,{timeout:120000});assert.equal(await page.locator('aside').getByText('让她动起来。',{exact:true}).count(),0);
  const attached=await page.evaluate(()=>window.desktop.wallpaper(true));assert.ok(attached.ok,attached.error);const wallpaper=app.windows().find(p=>p.url().includes('mode=wallpaper'));await wallpaper.waitForFunction(()=>window.companionPreview?.animationsReady,null,{timeout:120000});
  fs.appendFileSync(log,JSON.stringify(progress)+'\n');
  await page.waitForFunction(()=>window.companionSpeech.getState().speaking,null,{timeout:60000});await wallpaper.waitForFunction(()=>window.companionPreview.morphs.some(m=>m.morphTargetInfluences[m.morphTargetDictionary.jawOpen]>.01));
  fs.appendFileSync(log,JSON.stringify(final)+'\n');await page.waitForFunction(()=>window.companionSpeech.getState().queued===1);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('mode=wallpaper')).hide());
  await page.waitForFunction(()=>window.companionSpeech.history.length===2,null,{timeout:90000});const report=await page.evaluate(()=>({history:window.companionSpeech.history,voice:document.querySelector('#voice').value,note:document.querySelector('#speech-note').textContent}));assert.ok(report.history.every(e=>!e.error));assert.deepEqual(report.history.map(e=>e.id),['progress-one','final-two']);
  fs.appendFileSync(log,JSON.stringify(final)+'\n');await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>window.companionSpeech.history.length),2);report.nativeWallpaperMouth=true;report.hiddenPanelPlayback=true;report.duplicateSuppressed=true;report.errors=errors;assert.deepEqual(errors,[]);fs.writeFileSync('test-results/progress-speech.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await page.evaluate(()=>window.desktop.wallpaper(false));
 }finally{watcher?.close();await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
