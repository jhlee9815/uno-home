import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createManifest,
  loadManifest,
  transitionManifest,
  updateManifest,
} from './cs-manifest.ts';

const root = mkdtempSync(join(tmpdir(), 'cs-manifest-'));

const created = createManifest(root, {
  csId: 'cs-2026-05-21T02-00-00',
  createdAt: '2026-05-21T02:00:00.000Z',
  fileKey: 'figma-file',
  baseSnapshotPath: '.automation/baseline/base.json',
  headSnapshotPath: '.automation/snapshots/head.json',
  classifiedDiffPath: '.automation/diffs/head-classified.json',
  reportPath: '.automation/reports/cs-2026-05-21T02-00-00.md',
  classifiedDiffSha256: 'sha256:classified',
  headSnapshotSha256: 'sha256:head',
  imageRefs: { '7:3': { before: 'sha256:before', after: 'sha256:after' } },
  runId: '12345',
  actor: 'github-actions[bot]',
});

assert.equal(created.csId, 'cs-2026-05-21T02-00-00');
assert.equal(created.state, 'pending');
assert.equal(created.stateHistory.length, 1);
assert.equal(created.stateHistory[0].state, 'pending');
assert.equal(created.stateHistory[0].by, 'github-actions[bot]');

const loaded = loadManifest(root, 'cs-2026-05-21T02-00-00');
assert.equal(loaded.fileKey, 'figma-file');
assert.deepEqual(loaded.imageRefs['7:3'], { before: 'sha256:before', after: 'sha256:after' });

const updated = updateManifest(root, 'cs-2026-05-21T02-00-00', manifest => ({
  ...manifest,
  githubIssueNumber: 9,
  githubIssueUrl: 'https://github.com/jhlee9815/design-review-bot/issues/9',
  viewerUrl: 'https://example.test/cs/cs-2026-05-21T02-00-00/',
}));
assert.equal(updated.githubIssueNumber, 9);
assert.equal(updated.viewerUrl, 'https://example.test/cs/cs-2026-05-21T02-00-00/');

const transitioned = transitionManifest(root, 'cs-2026-05-21T02-00-00', {
  state: 'designer-approved',
  at: '2026-05-21T02:10:00.000Z',
  by: '@designer',
  via: 'label:designer-approved',
});
assert.equal(transitioned.state, 'designer-approved');
assert.equal(transitioned.stateHistory.length, 2);
assert.equal(transitioned.stateHistory[1].via, 'label:designer-approved');

assert.throws(() =>
  transitionManifest(root, 'cs-2026-05-21T02-00-00', {
    state: 'pending',
    at: '2026-05-21T02:11:00.000Z',
    by: '@designer',
  })
);

const raw = readFileSync(join(root, '.automation/cs/cs-2026-05-21T02-00-00.json'), 'utf-8');
assert.match(raw, /"state": "designer-approved"/);
console.log('cs-manifest PASS');
