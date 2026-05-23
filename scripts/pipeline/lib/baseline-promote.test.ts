import assert from 'node:assert/strict';
import {
  baselineBranchForCs,
  buildPromotePrBody,
  buildPromotePrTitle,
  currentBaselineFilenameTimestamp,
  decideBaselinePromote,
  toFilenameTimestamp,
} from './baseline-promote.ts';

const csId = 'cs-2026-05-23T02-42-47';

// Helpers
assert.equal(toFilenameTimestamp('2026-05-23T02:42:47.123Z'), '2026-05-23T02-42-47');
assert.equal(toFilenameTimestamp('2026-05-23T02:42:47Z'), '2026-05-23T02-42-47');
assert.equal(toFilenameTimestamp('2026-05-23T02:42:47'), '2026-05-23T02-42-47');

assert.equal(currentBaselineFilenameTimestamp([]), undefined);
assert.equal(
  currentBaselineFilenameTimestamp(['2026-05-21T07-43-40.json', '2026-04-30T06-54-11.json']),
  '2026-05-21T07-43-40',
);
assert.equal(
  currentBaselineFilenameTimestamp(['2026-05-21T07-43-40.json', 'README.md', 'index.css']),
  '2026-05-21T07-43-40',
);

assert.equal(baselineBranchForCs(csId), 'baseline-promote/cs-2026-05-23T02-42-47');
assert.equal(buildPromotePrTitle(csId), '[baseline-promote] cs-2026-05-23T02-42-47 — promote approved snapshot to baseline');
assert.throws(() => baselineBranchForCs('not-a-cs'), /Invalid cs id/);

const body = buildPromotePrBody({
  csId,
  newBaselineName: '2026-05-23T05-10-00.json',
  previousBaseline: '2026-05-21T07-43-40',
  sourceWorkflow: 'designer-approval',
  sourceRunUrl: 'https://github.com/jhlee9815/design-review-bot/actions/runs/26324151811',
});
assert.match(body, /cs-2026-05-23T02-42-47/);
assert.match(body, /2026-05-23T05-10-00\.json/);
assert.match(body, /2026-05-21T07-43-40\.json/);
assert.match(body, /designer-approval/);
assert.match(body, /26324151811/);
assert.match(body, /rollback/);

// Case 1: normal promote
const promoteCase = decideBaselinePromote({
  manifest: { csId, createdAt: '2026-05-23T02:42:59.633Z' },
  snapshotPath: '.automation/snapshots/2026-05-23T02-42-47.json',
  baselineFiles: ['2026-05-21T07-43-40.json', '2026-04-30T06-54-11.json'],
  baselineDir: '.automation/baseline',
  now: new Date('2026-05-23T05:10:00Z'),
  fileExists: (p) => p === '.automation/snapshots/2026-05-23T02-42-47.json',
  readFile: () => '{"fileKey":"X","nodes":{}}',
});
assert.equal(promoteCase.action, 'promote');
if (promoteCase.action === 'promote') {
  assert.equal(promoteCase.newBaselineName, '2026-05-23T05-10-00.json');
  assert.equal(promoteCase.newBaselineRelPath, '.automation/baseline/2026-05-23T05-10-00.json');
  assert.equal(promoteCase.snapshotContent, '{"fileKey":"X","nodes":{}}');
  assert.equal(promoteCase.currentBaseline, '2026-05-21T07-43-40');
}

// Case 2: skip — snapshot not found
const snapshotMissing = decideBaselinePromote({
  manifest: { csId, createdAt: '2026-05-23T02:42:59.633Z' },
  snapshotPath: undefined,
  baselineFiles: ['2026-05-21T07-43-40.json'],
  baselineDir: '.automation/baseline',
  now: new Date('2026-05-23T05:10:00Z'),
  fileExists: () => false,
  readFile: () => { throw new Error('should not be called'); },
});
assert.equal(snapshotMissing.action, 'skip');
if (snapshotMissing.action === 'skip') {
  assert.match(snapshotMissing.reason, /snapshot not found/);
}

// Case 3: skip — cs older than current baseline (regression guard)
const olderCs = decideBaselinePromote({
  manifest: { csId: 'cs-2026-05-19T01-00-00', createdAt: '2026-05-19T01:00:00.000Z' },
  snapshotPath: '.automation/snapshots/2026-05-19T01-00-00.json',
  baselineFiles: ['2026-05-21T07-43-40.json'],
  baselineDir: '.automation/baseline',
  now: new Date('2026-05-23T05:10:00Z'),
  fileExists: () => true,
  readFile: () => { throw new Error('should not be called'); },
});
assert.equal(olderCs.action, 'skip');
if (olderCs.action === 'skip') {
  assert.match(olderCs.reason, /older than current baseline/);
}

// Case 4: skip — target filename already exists (cs newer than current baseline, but now() collides)
const collisionCase = decideBaselinePromote({
  manifest: { csId: 'cs-2026-05-23T05-11-00', createdAt: '2026-05-23T05:11:00.000Z' },
  snapshotPath: '.automation/snapshots/2026-05-23T05-11-00.json',
  baselineFiles: ['2026-05-21T07-43-40.json', '2026-05-23T05-10-00.json'],
  baselineDir: '.automation/baseline',
  now: new Date('2026-05-23T05:10:00Z'),
  fileExists: () => true,
  readFile: () => 'x',
});
assert.equal(collisionCase.action, 'skip');
if (collisionCase.action === 'skip') {
  assert.match(collisionCase.reason, /already exists/);
}

// Case 5: first-ever promote (no existing baseline)
const firstPromote = decideBaselinePromote({
  manifest: { csId, createdAt: '2026-05-23T02:42:59.633Z' },
  snapshotPath: '.automation/snapshots/2026-05-23T02-42-47.json',
  baselineFiles: [],
  baselineDir: '.automation/baseline',
  now: new Date('2026-05-23T05:10:00Z'),
  fileExists: () => true,
  readFile: () => '{}',
});
assert.equal(firstPromote.action, 'promote');
if (firstPromote.action === 'promote') {
  assert.equal(firstPromote.currentBaseline, undefined);
}

console.log('baseline-promote.test.ts: OK');
