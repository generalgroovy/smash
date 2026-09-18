'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
test('standalone build is reproducible, self-contained, and hashes exact source bytes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smash-build-'));
  try {
    const out=path.join(dir,'game.html'),build=()=>execFileSync(process.execPath,['scripts/build.cjs',out],{cwd:root,encoding:'utf8'});
    build();const first=fs.readFileSync(out);build();assert.deepEqual(fs.readFileSync(out),first);
    const manifest=JSON.parse(fs.readFileSync(out+'.sha256.json','utf8'));
    const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(manifest.bundle,sha(first));for(const [name,hash]of Object.entries(manifest.sources))assert.equal(hash,sha(fs.readFileSync(path.join(root,name))));
    const html=first.toString();assert.ok(!html.includes('<script src='));assert.ok(!html.includes('rel="stylesheet"'));
    const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,4);
    for(const [,source]of scripts)new vm.Script(source);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
