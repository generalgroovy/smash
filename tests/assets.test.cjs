const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

test('HTML loads compatible engine, CPU and presentation revisions in dependency order', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"?]+)\?v=([a-f0-9]{12})"><\/script>/g)];
  assert.deepEqual(scripts.map(match => match[1]), ['combat.js', 'cpu.js', 'game.js']);
  const style = html.match(/<link rel="stylesheet" href="([^"?]+)\?v=([a-f0-9]{12})"/);
  assert.ok(style, 'stylesheet has a content revision');
  for (const [, name, revision] of [...scripts, style]) {
    const source = fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(revision, createHash('sha256').update(source).digest('hex').slice(0, 12),
      `${name}: run node tools/update-asset-revisions.cjs after editing runtime files`);
  }
});
