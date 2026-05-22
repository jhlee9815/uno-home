import assert from 'node:assert/strict';
import type { ClassifiedDiffFile } from './classify-diff.ts';
import { buildManualEditMarkdown, manualEditFilePath } from './manual-edits.ts';

assert.equal(
  manualEditFilePath('/repo', 'cs-2026-05-21T05-49-48'),
  '/repo/.automation/manual-edits/cs-2026-05-21T05-49-48.md'
);

const classified = {
  stage: 'classified',
  sourceStage: 'diff',
  generatedAt: '2026-05-21T05:49:58.000Z',
  fileKey: 'file-1',
  comparisonMode: 'baseline',
  baseTs: '2026-05-21T03:00:00.000Z',
  headTs: '2026-05-21T05:49:48.000Z',
  basePath: 'base.json',
  headPath: 'head.json',
  summary: { total: 2, autoApply: 0, reportOnly: 2, unknown: 0 },
  changes: [
    {
      key: 'pesse_home',
      nodeId: '7:3',
      nodeName: 'Phone Home',
      classes: ['detached-style'],
      subcategories: ['detached-style'],
      reasons: ['detached style detected'],
      before: {},
      after: {},
      decision: 'report-only',
      decisionReasons: ['detached-style is report-only'],
      target: {
        section: 'screens',
        apply: 'report-only',
        allowedClasses: [],
        code: '../src/screens/PesseHomeScreen.tsx',
        targetType: 'screen',
      },
    },
    {
      key: 'pesse_send',
      nodeId: '7:5',
      nodeName: 'Phone Send',
      classes: ['new-frame'],
      subcategories: ['new-frame'],
      reasons: ['new frame added'],
      before: {},
      after: {},
      decision: 'report-only',
      decisionReasons: ['new-frame is report-only'],
      target: {
        section: 'screens',
        apply: 'report-only',
        allowedClasses: [],
        code: '../src/screens/PesseSendScreen.tsx',
        targetType: 'screen',
      },
    },
  ],
} satisfies ClassifiedDiffFile;

const md = buildManualEditMarkdown({
  csId: 'cs-2026-05-21T05-49-48',
  classified,
  viewerUrl: 'https://jhlee9815.github.io/design-review-bot/cs/cs-2026-05-21T05-49-48/',
  missingMarkers: [
    { kind: 'text', code: '../src/screens/PesseHomeScreen.tsx', nodeIds: ['7:3'] },
  ],
});

assert.match(md, /# cs-2026-05-21T05-49-48 — Manual edit needed/);
assert.match(md, /Designer approved this change set/);
assert.match(md, /Before\/after viewer: https:\/\/jhlee9815\.github\.io/);
assert.match(md, /`\.\.\/src\/screens\/PesseHomeScreen\.tsx`/);
assert.match(md, /`\.\.\/src\/screens\/PesseSendScreen\.tsx`/);
assert.match(md, /## Missing markers/);
assert.match(md, /\| `pesse_home` \| detached-style \| Phone Home \|/);
assert.match(md, /\| `pesse_send` \| new-frame \| Phone Send \|/);

// No code paths case
const noPaths = buildManualEditMarkdown({
  csId: 'cs-x',
  classified: { ...classified, changes: [{ ...classified.changes[0], target: { ...classified.changes[0].target, code: '' } }] } satisfies ClassifiedDiffFile,
  missingMarkers: [],
});
assert.match(noPaths, /No mapped code paths/);

console.log('manual-edits PASS');
