const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const name of ['style.css', 'combat.js', 'cpu.js', 'game.js']) {
  const source = fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
  const revision = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const reference = new RegExp(`((?:src|href)="${name.replace('.', '\\.')})(?:\\?v=[a-f0-9]+)?"`);
  if (!reference.test(html)) throw new Error(`Missing asset reference: ${name}`);
  html = html.replace(reference, `$1?v=${revision}"`);
}
fs.writeFileSync(path.join(root, 'index.html'), html.replace(/\r\n/g, '\n'));
