const {writeIntent}=require('../desktop/body-intent.cjs');
const [thread,gesture='none',expression='neutral',gaze='user',intensity='.35']=process.argv.slice(2);
try{const intent=writeIntent(thread,{gesture,expression,gaze,intensity:Number(intensity)});console.log(JSON.stringify({ok:true,...intent}));}catch(error){console.error(error.message);process.exitCode=1;}
