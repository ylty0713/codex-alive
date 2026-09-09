const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
function pythonExecutable(){const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');return process.env.RIN_PYTHON||(fs.existsSync(bundled)?bundled:'python')}
module.exports={pythonExecutable};
