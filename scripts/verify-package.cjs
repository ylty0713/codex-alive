const {_electron:electron}=require('playwright-core');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
  const env={...process.env,RIN_PROFILE_DIR:path.resolve('.runtime/package-test-profile')};delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try{
    app=await electron.launch({executablePath:path.resolve('dist/Rin-v0.1.0/Rin.exe'),args:[],env});
    const page=await app.firstWindow();await page.waitForFunction(()=>!!window.rinApp,null,{timeout:30000});
    // Regression: stop while synthesis is pending must not launch a delayed walk.
    await page.locator('#autonomy').uncheck();await page.locator('#message').fill('走一走');await page.locator('#send').click();await page.locator('#stop').click();
    await page.waitForTimeout(3500);
    assert.equal(await page.evaluate(()=>window.rinApp.getState().state),'idle');
    assert.equal(await page.evaluate(()=>window.rinApp.getState().speaking),false);
    await page.locator('#autonomy').check();await page.evaluate(()=>window.rinApp.setScene('meadow'));
    await page.waitForTimeout(800);await fs.mkdir('previews/app',{recursive:true});await page.screenshot({path:'previews/app/desktop-companion-v01.png'});
    console.log('Packaged application loaded; delayed-command cancellation passed.');
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
