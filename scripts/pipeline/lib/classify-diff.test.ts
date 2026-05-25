import assert from 'node:assert/strict';
import { classifyDiff } from './classify-diff.ts';
import type { DiffFile } from './diff-snapshot.ts';
import type { FigmaMapping } from './config-loader.ts';

const diff: DiffFile = {
  stage: 'diff',
  generatedAt: '2026-05-04T12:00:00.000Z',
  fileKey: 'file-1',
  comparisonMode: 'baseline',
  baseTs: '2026-05-04T10:00:00.000Z',
  headTs: '2026-05-04T11:00:00.000Z',
  basePath: 'baseline.json',
  headPath: 'head.json',
  changes: [
    {
      key: 'tokens',
      nodeId: null,
      nodeName: 'tokens.json',
      classes: ['token'],
      reasons: ['tokensHash changed'],
      before: { tokensHash: 'sha256:a' },
      after: { tokensHash: 'sha256:b' },
    },
    {
      key: 'button',
      nodeId: '1:1',
      nodeName: 'Button',
      classes: ['text'],
      reasons: ['textHash changed'],
      before: {},
      after: {},
    },
    {
      key: 'home',
      nodeId: '2:1',
      nodeName: 'Home screen',
      classes: ['text'],
      reasons: ['textHash changed'],
      before: {},
      after: {},
    },
    {
      key: 'unknownThing',
      nodeId: '3:1',
      nodeName: 'Unknown',
      classes: ['text'],
      reasons: ['textHash changed'],
      before: {},
      after: {},
    },
    {
      key: 'button',
      nodeId: '1:1',
      nodeName: 'Button',
      classes: ['layout'],
      reasons: ['boundingBox changed'],
      before: {},
      after: {},
    },
  ],
};

const mapping = {
  version: 2,
  project: { name: 'UNO HOME', figmaFileKey: 'file-1' },
  pathResolution: { base: 'config-dir' },
  tokens: {
    source: { file: '../../tokens.json' },
    output: { css: '../src/index.css' },
    automation: { apply: 'auto', classes: ['token'] },
  },
  components: {
    button: {
      figmaNodeId: '1:1',
      figmaNodeName: 'Button',
      figmaNodePath: ['Design System'],
      code: '../src/components/Button.tsx',
      targetType: 'atomic-component',
      automation: { apply: 'auto', allowedClasses: ['token', 'text', 'component-props'] },
    },
  },
  compositions: {},
  screens: {
    home: {
      figmaNodeId: '2:1',
      figmaNodeName: 'Home screen',
      figmaNodePath: ['Page 1'],
      code: '../src/screens/HomeScreen.tsx',
      targetType: 'screen',
      route: '/screens/home',
      automation: { apply: 'report-only', allowedClasses: ['token', 'text', 'layout'] },
    },
  },
} satisfies FigmaMapping;

const classified = classifyDiff(diff, mapping);

assert.equal(classified.stage, 'classified');
assert.equal(classified.summary.total, 5);
assert.equal(classified.summary.autoApply, 2);
assert.equal(classified.summary.reportOnly, 3);
assert.equal(classified.summary.unknown, 1);

assert.equal(classified.changes[0].decision, 'auto-apply');
assert.equal(classified.changes[0].target.section, 'tokens');

assert.equal(classified.changes[1].decision, 'auto-apply');
assert.equal(classified.changes[1].target.section, 'components');

assert.equal(classified.changes[2].decision, 'report-only');
assert.match(classified.changes[2].decisionReasons[0], /report-only/);

assert.equal(classified.changes[3].decision, 'report-only');
assert.equal(classified.changes[3].classes[0], 'unknown');
assert.match(classified.changes[3].decisionReasons[0], /매핑된 대상이 없습니다/);

assert.equal(classified.changes[4].decision, 'report-only');
assert.match(classified.changes[4].decisionReasons[0], /수동 처리가 필요합니다/);

// ============================================================================
// Stage 4 — compliance classes always report-only + subcategories derivation
// ============================================================================

type Case = () => void;
let s4Failed = 0;
function run(label: string, fn: Case): void {
  try {
    fn();
    console.log(`ok  ${label}`);
  } catch (err) {
    s4Failed++;
    console.error(`FAIL ${label}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}

const complianceDiff: DiffFile = {
  stage: 'diff',
  generatedAt: '2026-05-21T00:00:00.000Z',
  fileKey: 'file-1',
  comparisonMode: 'baseline',
  baseTs: '2026-05-21T00:00:00.000Z',
  headTs: '2026-05-21T01:00:00.000Z',
  basePath: 'b.json',
  headPath: 'h.json',
  changes: [
    {
      key: 'home',
      nodeId: '2:1',
      nodeName: 'Home screen',
      classes: ['new-frame'],
      reasons: ['1 new descendant frame(s)'],
      before: {},
      after: {},
      compliance: {
        newDetachedStyles: [],
        newFrames: [
          {
            nodeId: '99:1',
            nodeName: 'Promo',
            nodePath: ['Home', 'Promo'],
            name: 'Promo',
            parentRegisteredKey: 'home',
          },
        ],
        changedImageRefs: [],
      },
    },
    {
      key: 'home',
      nodeId: '2:1',
      nodeName: 'Home screen',
      classes: ['text', 'detached-style'],
      reasons: ['textHash changed', '1 new detached style(s)'],
      before: {},
      after: {},
      compliance: {
        newDetachedStyles: [
          {
            nodeId: '2:1:9',
            nodeName: 'Pill',
            nodePath: ['Home', 'Pill'],
            kind: 'color',
            property: 'fill',
            rawValue: { r: 1, g: 0, b: 0, a: 1 },
            suggestedToken: null,
            evidence: { hasNodeBoundVariables: false, styleId: null },
          },
        ],
        newFrames: [],
        changedImageRefs: [],
      },
    },
    {
      key: 'button',
      nodeId: '1:1',
      nodeName: 'Button',
      classes: ['image-change'],
      reasons: ['1 image asset change(s)'],
      before: {},
      after: {},
      compliance: {
        newDetachedStyles: [],
        newFrames: [],
        changedImageRefs: [
          {
            before: {
              nodeId: '1:1:5',
              nodeName: 'Icon',
              nodePath: ['Button', 'Icon'],
              kind: 'image',
              paintIndex: 0,
              ref: 'img-old',
            },
            after: {
              nodeId: '1:1:5',
              nodeName: 'Icon',
              nodePath: ['Button', 'Icon'],
              kind: 'image',
              paintIndex: 0,
              ref: 'img-new',
            },
          },
        ],
      },
    },
  ],
};

const complianceClassified = classifyDiff(complianceDiff, mapping);

run('classify: new-frame class → report-only regardless of mapping apply mode', () => {
  const change = complianceClassified.changes[0];
  assert.equal(change.decision, 'report-only');
  assert.ok(
    change.decisionReasons.some(r => /compliance|manual|allowed/i.test(r)),
    `unexpected reasons: ${change.decisionReasons.join('|')}`
  );
});

run('classify: derives subcategories from classes', () => {
  // [0] = new-frame only
  assert.deepEqual(complianceClassified.changes[0].subcategories, ['new-frame']);
  // [1] = text + detached-style
  assert.deepEqual(
    [...complianceClassified.changes[1].subcategories].sort(),
    ['detached-style', 'text-change']
  );
  // [2] = image-change
  assert.deepEqual(complianceClassified.changes[2].subcategories, ['image-change']);
});

run('classify: text+detached-style → report-only (compliance is manual-only)', () => {
  const change = complianceClassified.changes[1];
  assert.equal(change.decision, 'report-only');
});

run('classify: image-change for component mapped as auto → still report-only', () => {
  // button mapping is apply:'auto' with allowedClasses=['token','text','component-props']
  // image-change is compliance class → manual-only override
  const change = complianceClassified.changes[2];
  assert.equal(change.decision, 'report-only');
});

run('classify: !beforeNode new frame with detached/new-frame/image classes → all subcategories derived', () => {
  // Simulates the diff-snapshot.ts !beforeNode branch output for a newly added
  // top-level frame that brings in detached styles, descendant frames, and
  // image assets in its first cycle.
  const newFrameDiff: DiffFile = {
    stage: 'diff',
    generatedAt: '2026-05-25T00:00:00.000Z',
    fileKey: 'file-1',
    comparisonMode: 'baseline',
    baseTs: '2026-05-25T00:00:00.000Z',
    headTs: '2026-05-25T01:00:00.000Z',
    basePath: 'b.json',
    headPath: 'h.json',
    changes: [
      {
        key: 'home',
        nodeId: '2:1',
        nodeName: 'Home screen',
        classes: ['structure', 'detached-style', 'new-frame', 'image-change'],
        reasons: [
          `Node 'home' missing from base snapshot`,
          '1 new detached style(s) on newly added node',
          '1 new descendant frame(s) on newly added node',
          '1 image asset(s) on newly added node',
        ],
        before: {},
        after: {},
        compliance: {
          newDetachedStyles: [
            {
              nodeId: '2:1:9',
              nodeName: 'Pill',
              nodePath: ['Home', 'Pill'],
              kind: 'color',
              property: 'fill',
              rawValue: { r: 1, g: 0, b: 0, a: 1 },
              suggestedToken: null,
              evidence: { hasNodeBoundVariables: false, styleId: null },
            },
          ],
          newFrames: [
            {
              nodeId: '99:1',
              nodeName: 'Promo',
              nodePath: ['Home', 'Promo'],
              name: 'Promo',
              parentRegisteredKey: 'home',
            },
          ],
          changedImageRefs: [
            {
              before: null,
              after: {
                nodeId: '2:1:7',
                nodeName: 'Hero',
                nodePath: ['Home', 'Hero'],
                kind: 'image',
                paintIndex: 0,
                ref: 'img-new',
              },
            },
          ],
        },
      },
    ],
  };
  const c = classifyDiff(newFrameDiff, mapping);
  assert.equal(c.summary.total, 1);
  assert.equal(c.summary.reportOnly, 1);
  const change = c.changes[0];
  assert.equal(change.decision, 'report-only');
  const subs = [...change.subcategories].sort();
  // 'structure' doesn't map to a subcategory; the other three do.
  assert.deepEqual(subs, ['detached-style', 'image-change', 'new-frame']);
});

run('classify: original sample (no compliance) → subcategories array still present', () => {
  // The first 5 changes from the original sample (tokens, button text, home text, unknown, button layout)
  for (const c of classified.changes) {
    assert.ok(Array.isArray(c.subcategories), `change for key=${c.key} missing subcategories array`);
  }
  // tokens has class 'token' → no subcategory mapping → empty array
  assert.deepEqual(classified.changes[0].subcategories, []);
  // button text → text-change
  assert.deepEqual(classified.changes[1].subcategories, ['text-change']);
});

if (s4Failed > 0) {
  console.error(`\n${s4Failed} Stage 4 classify test(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll classify-diff tests (incl. Stage 4) passed.`);
