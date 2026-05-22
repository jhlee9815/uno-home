import assert from 'node:assert/strict';
import {
  buildManifestPrBody,
  buildManifestPrTitle,
  manifestBranchForCs,
  pathsFromPorcelain,
} from './manifest-pr.ts';

const csId = 'cs-2026-05-22T01-12-45';

assert.equal(manifestBranchForCs(csId), 'manifest/cs-2026-05-22T01-12-45');
assert.equal(buildManifestPrTitle(csId), '[manifest] cs-2026-05-22T01-12-45 — persist CS state');

const body = buildManifestPrBody({
  csId,
  sourceWorkflow: 'figma-pipeline',
  sourceRunUrl: 'https://github.com/jhlee9815/design-review-bot/actions/runs/26262567586',
  paths: ['.automation/cs/cs-2026-05-22T01-12-45.json'],
});
assert.match(body, /main is protected/);
assert.match(body, /validate/);
assert.match(body, /cs-2026-05-22T01-12-45\.json/);
assert.match(body, /26262567586/);

assert.deepEqual(
  pathsFromPorcelain('?? .automation/cs/cs-1.json\n M .automation/cs/cs-2.json\n M src/App.tsx\n'),
  ['.automation/cs/cs-1.json', '.automation/cs/cs-2.json']
);

console.log('manifest-pr PASS');
