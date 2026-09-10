const {_electron:electron}=require('playwright-core'),path=require('path'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const profile=path.resolve('.runtime/logo-startup-test');fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'empty.jsonl'),'');const env={...process.env,RIN_PROFILE_DIR:profile,RIN_WATCH_FILE:path.join(profile,'empty.jsonl')};delete env.ELECTRON_RUN_AS_NODE;const app=await electron.launch({executablePath:path.resolve('dist/Companion-v0.4.3/Rin.exe'),args:['--wallpaper','--codex-startup'],env});try{
const page=await app.firstWindow();await page.waitForFunction(()=>window.companionPreview?.animationsReady,null,{timeout:120000});
await new Promise(r=>setTimeout(r,4000));
const windows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),url:w.webContents.getURL()})));assert.equal(windows.length,2);assert.equal(windows.find(w=>!w.url.includes("mode=wallpaper")).visible,false);assert.equal(windows.find(w=>w.url.includes("mode=wallpaper")).visible,true);
assert.equal(await page.locator('.brand-icon').evaluate(img=>img.complete&&img.naturalWidth>0),true);
await app.evaluate(({app})=>app.emit('second-instance',{},['--codex-startup']));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes("mode=wallpaper")).isVisible()),false);
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes("mode=wallpaper")).show());await page.screenshot({path:'previews/v041-logo.png'});
console.log(JSON.stringify({logoLoaded:true,quietStartup:true,wallpaperVisible:true,duplicateStartupQuiet:true}));
}finally{await app.close()}})().catch(e=>{console.error(e);process.exitCode=1});
