import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('HTTP server serves the app and modules, rejects hidden paths and non-reads',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 try {const [data]=await once(child.stdout,'data');const url=String(data).match(/http:\/\/[^\s]+/)[0];
 for(const file of ['/','/src/app.js','/src/engine.js','/src/simulation-worker.js','/styles.css','/app.json']){const r=await fetch(url+file);assert.equal(r.status,200,file);assert.ok((await r.text()).length>50);}
 assert.equal((await fetch(url+'/.git/config')).status,404);assert.equal((await fetch(url+'/%2eenv')).status,404);assert.equal((await fetch(url+'/absent')).status,404);assert.equal((await fetch(url+'/',{method:'POST'})).status,405);assert.equal((await fetch(url+'/',{method:'HEAD'})).status,200);
 }finally{child.kill();await once(child,'exit');}
});
