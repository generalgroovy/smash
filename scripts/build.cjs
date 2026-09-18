'use strict';
// Reproducible offline bundle. No bundler, downloads, timestamps or runtime loader.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'dist','smash-movement-lab.html'));
const sources=['index.html','style.css','engine.js','animation.js','game.js'];
const text=Object.fromEntries(sources.map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
let html=text['index.html'];
const style='<link rel="stylesheet" href="style.css">';
if(!html.includes(style))throw new Error('Build contract: style.css entry is missing.');
html=html.replace(style,`<style>\n${text['style.css']}\n</style>`);
for(const name of sources.slice(2)) {
  const tag=`<script src="${name}" defer></script>`;
  if(!html.includes(tag))throw new Error(`Build contract: ${name} entry is missing.`);
  html=html.replace(tag,'');
}
const scripts=sources.slice(2).map(name=>`<script>\n${text[name].replace(/<\/script/gi,'<\\/script')}\n</script>`).join('\n');
html=html.replace('</body>',scripts+'\n</body>');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const manifest={version:require('../package.json').version,sources:Object.fromEntries(sources.map(n=>[n,sha(text[n])])),bundle:sha(html)};
fs.writeFileSync(out+'.sha256.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${out} (${Buffer.byteLength(html)} bytes)\nSHA-256 ${manifest.bundle}`);
