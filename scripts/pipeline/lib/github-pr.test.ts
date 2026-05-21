import assert from 'node:assert/strict';
import { selectPathsForPrBranch } from './github-pr.ts';

const sampleStatus = [
  ' M src/components/Badge.tsx',
  '?? src/components/NewWidget.tsx',
  ' M .automation/cs/cs-2026-05-21T05-49-48.json',
  '?? .automation/images/snapshots/cs-x/7-3.png',
  ' M dist-viewer/index.html',
  '?? .automation/manual-edits/cs-x.md',
].join('\n');

// Cron path: filter out anything under .automation/ or dist-viewer/
assert.deepEqual(
  selectPathsForPrBranch(sampleStatus, ['.automation/', 'dist-viewer/']),
  ['src/components/Badge.tsx', 'src/components/NewWidget.tsx'],
  'cron filter keeps only src/ paths'
);

// Designer-approval (Tier 3): keep src + .automation/manual-edits, drop the rest
assert.deepEqual(
  selectPathsForPrBranch(sampleStatus, [
    '.automation/cs/',
    '.automation/diffs/',
    '.automation/images/',
    '.automation/reports/',
    '.automation/snapshots/',
    'dist-viewer/',
  ]),
  ['src/components/Badge.tsx', 'src/components/NewWidget.tsx', '.automation/manual-edits/cs-x.md'],
  'designer filter keeps src + manual-edits'
);

// Empty input
assert.deepEqual(selectPathsForPrBranch('', ['.automation/']), []);

// No matching prefix (e.g. someone passes [] by mistake): everything kept
assert.deepEqual(
  selectPathsForPrBranch(' M foo.ts', []),
  ['foo.ts']
);

console.log('github-pr PASS');
