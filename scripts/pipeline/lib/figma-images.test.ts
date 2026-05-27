import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  baselineImagePath,
  buildFigmaImagesUrl,
  imageFileNameForNodeId,
  listSnapshotImageNodeIdsForCs,
  promoteSnapshotImagesToBaseline,
  saveImageBuffer,
  snapshotImagePath,
} from './figma-images.ts';

assert.equal(imageFileNameForNodeId('7:3'), '7-3.png');
assert.equal(imageFileNameForNodeId('1:2/3'), '1-2-3.png');
assert.equal(
  buildFigmaImagesUrl('file key', ['7:3', '7:4'], { format: 'png', scale: 2 }),
  'https://api.figma.com/v1/images/file%20key?ids=7%3A3%2C7%3A4&format=png&scale=2'
);

const root = mkdtempSync(join(tmpdir(), 'figma-images-'));
const baseline = baselineImagePath(root, '7:3');
const snapshot = snapshotImagePath(root, 'cs-test', '7:3');
assert.equal(baseline.endsWith('.automation/images/baseline/7-3.png'), true);
assert.equal(snapshot.endsWith('.automation/images/snapshots/cs-test/7-3.png'), true);

const hash = saveImageBuffer(baseline, Buffer.from('png-data'));
assert.equal(hash.startsWith('sha256:'), true);
assert.equal(existsSync(baseline), true);
assert.equal(readFileSync(baseline, 'utf-8'), 'png-data');
// promoteSnapshotImagesToBaseline: copies every PNG from a cs snapshot dir
// into the baseline image directory so that promoting the JSON also promotes
// the matching reference images. Fixes the "이전 baseline 이미지 없음" gap
// for nodes first captured mid-cycle (e.g. auto-registered 81:302).
{
  const promoteRoot = mkdtempSync(join(tmpdir(), 'figma-images-promote-'));
  const csId = 'cs-2026-05-27T00-00-00';
  saveImageBuffer(snapshotImagePath(promoteRoot, csId, '81:302'), Buffer.from('after-81-302'));
  saveImageBuffer(snapshotImagePath(promoteRoot, csId, '7:3'), Buffer.from('after-7-3'));
  saveImageBuffer(baselineImagePath(promoteRoot, '7:3'), Buffer.from('stale-baseline-7-3'));
  const copied = promoteSnapshotImagesToBaseline(promoteRoot, csId);
  assert.deepEqual(copied.sort(), ['7-3', '81-302']);
  assert.equal(
    readFileSync(baselineImagePath(promoteRoot, '81:302'), 'utf-8'),
    'after-81-302',
    'new baseline image must be written for previously-unbaselined node'
  );
  assert.equal(
    readFileSync(baselineImagePath(promoteRoot, '7:3'), 'utf-8'),
    'after-7-3',
    'existing baseline image must be overwritten with the approved snapshot'
  );

  // Graceful: no snapshot dir → empty list, no throw.
  const emptyRoot = mkdtempSync(join(tmpdir(), 'figma-images-empty-'));
  assert.deepEqual(promoteSnapshotImagesToBaseline(emptyRoot, 'cs-missing'), []);
}

// listSnapshotImageNodeIdsForCs: dry-run/preview path — reports which nodeIds
// WOULD be promoted without touching the filesystem. Prevents the dry-run
// regression Codex flagged where the working tree mutated even when the
// caller only intended to log "would refresh".
{
  const previewRoot = mkdtempSync(join(tmpdir(), 'figma-images-preview-'));
  const csId = 'cs-2026-05-27T01-00-00';
  saveImageBuffer(snapshotImagePath(previewRoot, csId, '81:302'), Buffer.from('a'));
  saveImageBuffer(snapshotImagePath(previewRoot, csId, '7:3'), Buffer.from('b'));
  const ids = listSnapshotImageNodeIdsForCs(previewRoot, csId);
  assert.deepEqual(ids.sort(), ['7-3', '81-302']);
  // Baseline dir must NOT exist yet — listing must not mkdir.
  assert.equal(
    existsSync(baselineImagePath(previewRoot, '81:302')),
    false,
    'listing must not write any file to the baseline dir'
  );
  // Missing source dir → empty, no throw.
  assert.deepEqual(listSnapshotImageNodeIdsForCs(previewRoot, 'cs-missing'), []);
}

console.log('figma-images PASS');
