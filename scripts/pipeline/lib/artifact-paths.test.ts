import assert from 'node:assert/strict';
import { resolveAutomationPath } from './artifact-paths.ts';

assert.equal(
  resolveAutomationPath('/repo/current', '/home/runner/work/uno-home/uno-home/.automation/baseline/base.json'),
  '/repo/current/.automation/baseline/base.json'
);
assert.equal(
  resolveAutomationPath('/repo/current', '.automation/snapshots/head.json'),
  '/repo/current/.automation/snapshots/head.json'
);
assert.equal(resolveAutomationPath('/repo/current', ''), '');
assert.equal(
  resolveAutomationPath('/repo/current', '/tmp/outside/file.json'),
  '/tmp/outside/file.json'
);

console.log('artifact-paths PASS');
