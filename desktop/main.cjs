const {app,BrowserWindow,ipcMain,dialog,Tray,Menu,nativeImage,globalShortcut,screen}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
let studio,wallpaper,tray,bridge;
const {CodexBridge}=require("./codex-bridge.cjs");
const neuralSpeech=require('./neural-speech.cjs');
const {PeopleStore}=require('./people-store.cjs');
let peopleStore,transcribing=false;const mediaPermissions={video:false,audio:false};
const {normalize:normalizeScene}=require('./scene-settings.cjs');
let sceneSettings=normalizeScene(),settingsQueue=Promise.resolve();
function displayList(){return screen.getAllDisplays().map((d,i)=>({id:d.id,number:i+1,label:d.label||String(d.id),bounds:d.bounds,primary:d.id===screen.getPrimaryDisplay().id}));}
function settingsSnapshot(){return {settings:sceneSettings,displays:displayList()};}
function broadcastSettings(){for(const w of [studio,wallpaper])if(w&&!w.isDestroyed())w.webContents.send('scene-settings',settingsSnapshot());}
async function positionWallpaper(w){
 const display=screen.getAllDisplays().find(d=>d.id===sceneSettings.displayId)||screen.getPrimaryDisplay();
 const rect=screen.dipToScreenRect(null,display.bounds);
 const raw=w.getNativeWindowHandle(),handle=raw.length===8?raw.readBigUInt64LE().toString():raw.readUInt32LE().toString();
 const placement=JSON.parse(await runPowerShell('wallpaper.ps1',['-Handle',handle,'-X',String(rect.x),'-Y',String(rect.y),'-Width',String(rect.width),'-Height',String(rect.height)]));
 await fs.writeFile(path.join(__dirname,'runtime-status.json'),JSON.stringify({pid:process.pid,wallpaper:true,handle,displayId:display.id,placement,at:new Date().toISOString(),codex:bridge?.status()},null,2));
 return placement;
}
app.commandLine.appendSwitch("autoplay-policy","no-user-gesture-required");
let wallpaperChanging=false;
const root=path.resolve(__dirname,'..');
const speechJobs=new Set();
app.setName('Rin Desktop Companion');
if(process.env.RIN_PROFILE_DIR){require('node:fs').mkdirSync(process.env.RIN_PROFILE_DIR,{recursive:true});app.setPath('userData',process.env.RIN_PROFILE_DIR);}
const hasInstanceLock=app.requestSingleInstanceLock();
if(!hasInstanceLock)app.quit();
app.on('second-instance',()=>{studio?.restore();showStudio();});
function runPowerShell(script,args=[],timeout=30000){
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,script),...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    speechJobs.add(child);let out='',err='';
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
    const timer=setTimeout(()=>{child.kill();reject(new Error('本地服务响应超时，请重试。'));},timeout);
    child.on('error',e=>{clearTimeout(timer);speechJobs.delete(child);reject(e);});
    child.on('close',code=>{clearTimeout(timer);speechJobs.delete(child);code===0?resolve(out.trim()):reject(new Error(err.trim()||'本地服务未能完成操作。'));});
  });
}
function secure(win){
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((wc,permission,cb,details)=>cb(wc===studio?.webContents&&permission==='media'&&Array.isArray(details.mediaTypes)&&details.mediaTypes.length>0&&details.mediaTypes.every(t=>mediaPermissions[t]===true)));
  win.webContents.session.setPermissionCheckHandler((wc,permission,_origin,details)=>wc===studio?.webContents&&permission==='media'&&(details.mediaType==='video'?mediaPermissions.video:details.mediaType==='audio'?mediaPermissions.audio:mediaPermissions.video||mediaPermissions.audio));
}
function showStudio(){if(studio&&!studio.isDestroyed()){studio.show();studio.focus();}}
function notifyWallpaper(){studio?.webContents.send('wallpaper-status',!!wallpaper&&!wallpaper.isDestroyed());}
async function setWallpaper(enabled){
  if(wallpaperChanging)return {ok:false,error:'桌面模式正在切换，请稍候。'};
  wallpaperChanging=true;
  try{
    if(!enabled){wallpaper?.destroy();wallpaper=null;notifyWallpaper();return {ok:true,enabled:false};}
    if(wallpaper&&!wallpaper.isDestroyed())return {ok:true,enabled:true};
    if(process.platform!=='win32')return {ok:false,error:'动态壁纸模式目前仅支持 Windows。'};
    const display=screen.getAllDisplays().find(d=>d.id===sceneSettings.displayId)||screen.getPrimaryDisplay();
    wallpaper=new BrowserWindow({...display.bounds,show:false,frame:false,thickFrame:false,roundedCorners:false,hasShadow:false,useContentSize:true,focusable:false,skipTaskbar:true,resizable:false,backgroundColor:'#f2f2f2',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
    secure(wallpaper);const w=wallpaper;
    w.on('closed',()=>{if(wallpaper===w)wallpaper=null;notifyWallpaper();});
    await w.loadFile(path.join(root,'modeling','companion.html'),{query:{mode:'wallpaper'}});
    w.setIgnoreMouseEvents(true);
    w.showInactive();await positionWallpaper(w);
    notifyWallpaper();
    return {ok:true,enabled:true};
  }catch(e){wallpaper?.destroy();wallpaper=null;notifyWallpaper();return {ok:false,error:'无法进入桌面壁纸模式：'+e.message};}
  finally{wallpaperChanging=false;}
}
function isStudio(e){return studio&&!studio.isDestroyed()&&e.sender===studio.webContents;}
ipcMain.handle('voices',async()=>{try{return {ok:true,voices:[...neuralSpeech.voices,...JSON.parse(await runPowerShell('speech.ps1',['-Mode','voices']))]};}catch(e){return {ok:true,voices:neuralSpeech.voices};}});
let synthesizing=0;
ipcMain.handle('synthesize',async(e,data)=>{
  if(!isStudio(e)||typeof data?.text!=='string'||data.text.length>2000||!data.text.trim())return {ok:false,error:'请输入 1–2000 字的内容。'};
  if(synthesizing>=2)return {ok:false,error:'语音正在准备，请稍后再试。'};
  synthesizing++;let dir;
  try{
    dir=path.join(app.getPath('temp'),'rin-speech-'+randomUUID());await fs.mkdir(dir,{recursive:true});
    const request=path.join(dir,'request.json'),audio=path.join(dir,'speech.wav');
    await fs.writeFile(request,JSON.stringify({text:data.text,voice:typeof data.voice==='string'?data.voice.slice(0,200):'',rate:Math.max(-50,Math.min(50,Number(data.rate)||0)),pitch:Math.max(-30,Math.min(30,Number(data.pitch)||0))}),'utf8');
    if(neuralSpeech.voices.some(v=>v.name===data.voice))await neuralSpeech.synthesize(request,audio,speechJobs);
    else await runPowerShell('speech.ps1',['-Mode','speak','-InputFile',request,'-OutputFile',audio],90000);
    let timing=[];try{timing=JSON.parse(await fs.readFile(audio+'.json','utf8'))}catch{}
    return {ok:true,audio:(await fs.readFile(audio)).toString('base64'),timing,engine:neuralSpeech.voices.some(v=>v.name===data.voice)?'neural':'local'};
  }catch(e){return {ok:false,error:'语音生成失败：'+e.message};}
  finally{synthesizing--;if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}
});
ipcMain.handle('wallpaper',(e,enabled)=>isStudio(e)?setWallpaper(enabled):{ok:false});
ipcMain.handle('save-model',async(e,data)=>{
  if(!isStudio(e)||!(data instanceof Uint8Array)||data.length>50*1024*1024)return {ok:false,error:'模型数据无效。'};
  const result=await dialog.showSaveDialog(studio,{defaultPath:'rin-base-rig.glb',filters:[{name:'glTF Binary',extensions:['glb']}]});
  if(result.canceled)return {ok:false,canceled:true};
  await fs.writeFile(result.filePath,data);return {ok:true,path:result.filePath};
});
ipcMain.on('companion-command',(e,data)=>{
  if(!isStudio(e)||!data||typeof data!=='object')return;
  const valid=['action','preferences','mouth','pose','caption','stop','expression','gaze','viseme','activity','gesture','speech'];
  if(!valid.includes(data.type)||JSON.stringify(data).length>5000)return;
  if(wallpaper&&!wallpaper.isDestroyed())wallpaper.webContents.send('companion-command',data);
});
app.whenReady().then(async()=>{
  if(!hasInstanceLock)return;
  peopleStore=new PeopleStore(app.getPath('userData'),require('electron').safeStorage);
  try{sceneSettings=normalizeScene(JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'scene-settings.json'),'utf8')))}catch{}
  if(!screen.getAllDisplays().some(d=>d.id===sceneSettings.displayId))sceneSettings.displayId=screen.getPrimaryDisplay().id;
  const changed=()=>{settingsQueue=settingsQueue.then(async()=>{if(!screen.getAllDisplays().some(d=>d.id===sceneSettings.displayId))sceneSettings.displayId=screen.getPrimaryDisplay().id;if(wallpaper&&!wallpaper.isDestroyed())await positionWallpaper(wallpaper);broadcastSettings()}).catch(()=>{});};
  screen.on('display-added',changed);screen.on('display-removed',changed);screen.on('display-metrics-changed',changed);
  studio=new BrowserWindow({width:1480,height:960,minWidth:1000,minHeight:720,show:false,title:'凛 · 桌面伙伴',backgroundColor:'#ffffff',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
  secure(studio);
  studio.on('close',e=>{if(!app.isQuitting&&wallpaper){e.preventDefault();studio.hide();}});
  bridge=new CodexBridge({root,userData:app.getPath('userData'),config:{...require('./companion-config.json'),...(require('node:fs').existsSync(path.join(__dirname,'companion-config.local.json'))?require('./companion-config.local.json'):{}),...(process.env.RIN_WATCH_FILE?{watchFile:process.env.RIN_WATCH_FILE}:{})},onEvent:data=>{studio?.webContents.send('codex-event',data);if(wallpaper&&!wallpaper.isDestroyed())wallpaper.webContents.send('codex-event',data)}});bridge.start(); await studio.loadFile(path.join(root,'modeling','companion.html'));studio.show(); if(process.argv.includes('--wallpaper'))await setWallpaper(true);
  // A small native tray icon keeps the wallpaper controls reachable.
  const icon=Buffer.alloc(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){let i=(y*32+x)*4,inside=(x-16)**2+(y-16)**2<196;icon[i]=111;icon[i+1]=100;icon[i+2]=168;icon[i+3]=inside?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(icon,{width:32,height:32}));tray.setToolTip('凛 · 桌面伙伴');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'打开控制面板',click:showStudio},{label:'退出壁纸模式',click:()=>setWallpaper(false)},{type:'separator'},{label:'退出凛',click:()=>app.quit()}]));tray.on('click',showStudio);
  globalShortcut.register('CommandOrControl+Alt+R',showStudio);
  globalShortcut.register('CommandOrControl+Alt+Q',()=>{setWallpaper(false);showStudio();});
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{app.isQuitting=true;bridge?.close();for(const child of speechJobs)child.kill();globalShortcut.unregisterAll();wallpaper?.destroy();});

ipcMain.handle('codex-status',e=>isStudio(e)?bridge?.status():{connected:false});
ipcMain.handle('codex-send',(e,text)=>isStudio(e)?bridge.send(text):{ok:false});
ipcMain.handle('codex-stop',e=>{if(isStudio(e))bridge.stop();return {ok:true}});
ipcMain.handle('media-permission',(e,{kind,enabled}={})=>{if(!isStudio(e)||!['video','audio'].includes(kind))return {ok:false};mediaPermissions[kind]=enabled===true;return {ok:true}});
ipcMain.handle('people-list',async e=>{if(!isStudio(e))return {ok:false};try{return {ok:true,people:await peopleStore.list()}}catch(error){return {ok:false,error:error.message}}});
ipcMain.handle('people-save',async(e,data)=>{if(!isStudio(e))return {ok:false};try{return {ok:true,people:await peopleStore.save(data)}}catch(error){return {ok:false,error:error.message}}});
ipcMain.handle('people-delete',async(e,id)=>{if(!isStudio(e))return {ok:false};try{return {ok:true,people:await peopleStore.remove(id)}}catch(error){return {ok:false,error:error.message}}});
require('./media-bridge.cjs').registerMedia({ipcMain,isStudio,permissions:mediaPermissions,getStudio:()=>studio,getBridge:()=>bridge,app});
ipcMain.handle('scene-settings-get',e=>[studio,wallpaper].some(w=>w&&!w.isDestroyed()&&w.webContents===e.sender)?settingsSnapshot():null);
ipcMain.handle('scene-settings-save',(e,value)=>{
 if(!isStudio(e))return {ok:false,error:'无法保存设置'};
 const next=normalizeScene(value);
 settingsQueue=settingsQueue.catch(()=>{}).then(async()=>{
  if(!screen.getAllDisplays().some(d=>d.id===next.displayId))return {ok:false,error:'所选显示器已断开，请重新选择。'};
  const previous=sceneSettings;sceneSettings=next;
  try{if(previous.displayId!==next.displayId&&wallpaper&&!wallpaper.isDestroyed())await positionWallpaper(wallpaper);
   await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(path.join(app.getPath('userData'),'scene-settings.json'),JSON.stringify(next,null,2));broadcastSettings();return {ok:true,settings:next};
  }catch(error){sceneSettings=previous;broadcastSettings();return {ok:false,error:error.message}}
 });return settingsQueue;
});
