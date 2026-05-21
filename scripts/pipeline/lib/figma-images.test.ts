import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  baselineImagePath,
  buildFigmaImagesUrl,
  imageFileNameForNodeId,
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
console.log('figma-images PASS');
