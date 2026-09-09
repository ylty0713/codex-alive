const { _electron: electron } = require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..')],env});
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.waitForFunction(()=>!!window.rinApp,{timeout:30000});await page.waitForTimeout(1800);
  await fs.mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/first-render.png'});
  console.log(JSON.stringify({state:await page.evaluate(()=>window.rinApp.getState()),errors}));
  await page.evaluate(()=>window.rinApp.setScene('studio'));await page.locator('#face-view').click();await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/face-render.png'});
  await app.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
