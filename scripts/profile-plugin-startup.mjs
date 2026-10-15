// Exercise the installed dependency's actual bundle loader with controlled R2 latency.
// Optional baseline path: node scripts/profile-plugin-startup.mjs ../bundle-before.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = readFileSync(process.argv[2] ?? 'node_modules/emdash/dist/api-DBw_IWoi.mjs', 'utf8');
const start = source.indexOf('async function loadBundleFromR2(');
const end = source.indexOf('/** Delete a plugin bundle', start);
assert(start >= 0 && end > start);
const load = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
  validatePluginIdentifier() {}, validateVersion() {},
  bundlePrefix: (source, id, version) => `${source}/${id}/${version}`,
  streamToText: body => new Response(body).text(),
  pluginManifestSchema$1: { safeParse: value => ({ success: value.valid !== false, data: value }) },
  reconcileManifestAccess$1: value => value, warnDeprecatedPluginCapabilities() {},
});
const patched = source.includes('includeAdmin = true');
if (patched) {
  const runtime = readFileSync('node_modules/emdash/dist/emdash-runtime-C4oFeVpN.mjs', 'utf8');
  assert(runtime.includes('loadBundleFromR2(storage, plugin.pluginId, version, source, false)'));
}
function storage({ delay = 0, missing, invalid = false } = {}) {
  const calls = []; let active = 0; let peak = 0;
  return { calls, get peak() { return peak; }, async download(key) {
    calls.push(key); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, delay)); active--;
    if (key.endsWith(missing ?? 'NEVER')) throw Error('missing');
    return { body: new Response(key.endsWith('manifest.json') ? JSON.stringify({ id: 'test', valid: !invalid, capabilities: [] }) : 'code').body };
  }};
}
for (const tier of ['registry', 'marketplace']) {
  const s = storage(); const result = await load(s, 'test', '1.0.0', tier, false);
  assert.equal(result.backendCode, 'code');
  assert.equal(s.calls.length, patched ? 2 : 3);
  assert(s.calls.every(key => key.startsWith(`${tier}/test/1.0.0/`)));
  if (patched) { assert.equal(result.adminCode, undefined); assert.equal(s.peak, 2); }
}
const full = storage(); assert.equal((await load(full, 'test', '1.0.0')).adminCode, 'code');
assert.equal(full.calls.length, 3); // Existing non-startup callers retain admin code.
for (const missing of ['manifest.json', 'backend.js']) assert.equal(await load(storage({missing}), 'test', '1.0.0', 'registry', false), null);
assert.equal(await load(storage({invalid: true}), 'test', '1.0.0', 'registry', false), null);
assert.equal((await load(storage({missing: 'admin.js'}), 'test', '1.0.0')).backendCode, 'code');
const samples = [];
for (let run = 0; run < 7; run++) {
  const s = storage({delay: 25}); const t = performance.now();
  for (let plugin = 0; plugin < 4; plugin++) await load(s, `test${plugin}`, '1.0.0', 'registry', false);
  samples.push(performance.now() - t);
  assert.equal(s.calls.length, patched ? 8 : 12);
}
samples.sort((a,b) => a-b);
console.log(JSON.stringify({patched, fixture: '4 plugins, 25ms per R2 read, 7 runs; not a production latency prediction', medianMs: samples[3], minMs: samples[0], maxMs: samples[6], reads: patched ? 8 : 12, assertions: 'passed'}, null, 2));
