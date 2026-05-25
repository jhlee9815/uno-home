import assert from 'node:assert/strict';
import { diffCompliance, diffSnapshots, selectSnapshotPair } from './diff-snapshot.ts';
import type { SnapshotFile } from './diff-snapshot.ts';
import type {
  AssetRefEntry,
  DescendantFrameEntry,
  DetachedStyleEntry,
} from './compliance-types.ts';
import type { SnapshotNodeEntry } from './snapshot-node.ts';

const baseSnapshot: SnapshotFile = {
  fileKey: 'file-1',
  timestamp: '2026-05-04T10:00:00.000Z',
  source: 'figma-rest',
  tokensHash: 'sha256:tokens-a',
  nodes: {
    button: {
      id: '1:1',
      name: 'Button',
      lastModified: '2026-05-04T10:00:00.000Z',
      visible: true,
      boundingBox: { x: 0, y: 0, width: 100, height: 40 },
      textHash: 'sha256:text-a',
      propsHash: 'sha256:props-a',
      componentPropsHash: 'sha256:component-a',
      texts: [],
      componentProps: [],
    },
    removed: {
      id: '1:2',
      name: 'Removed',
      lastModified: '2026-05-04T10:00:00.000Z',
      visible: true,
      boundingBox: { x: 0, y: 0, width: 50, height: 50 },
      textHash: 'sha256:removed-text',
      propsHash: 'sha256:removed-props',
      componentPropsHash: 'sha256:removed-component',
      texts: [],
      componentProps: [],
    },
  },
};

const headSnapshot: SnapshotFile = {
  ...baseSnapshot,
  timestamp: '2026-05-04T11:00:00.000Z',
  tokensHash: 'sha256:tokens-b',
  nodes: {
    button: {
      ...baseSnapshot.nodes.button,
      textHash: 'sha256:text-b',
      boundingBox: { x: 0, y: 0, width: 112, height: 40 },
    },
    added: {
      id: '1:3',
      name: 'Added',
      lastModified: '2026-05-04T11:00:00.000Z',
      visible: true,
      boundingBox: { x: 0, y: 0, width: 50, height: 50 },
      textHash: 'sha256:added-text',
      propsHash: 'sha256:added-props',
      componentPropsHash: 'sha256:added-component',
      texts: [],
      componentProps: [],
    },
  },
};

const diff = diffSnapshots(baseSnapshot, headSnapshot, {
  comparisonMode: 'baseline',
  basePath: '.automation/baseline/approved.json',
  headPath: '.automation/snapshots/head.json',
});

assert.equal(diff.stage, 'diff');
assert.equal(diff.comparisonMode, 'baseline');
assert.equal(diff.baseTs, '2026-05-04T10:00:00.000Z');
assert.equal(diff.headTs, '2026-05-04T11:00:00.000Z');

const tokenChange = diff.changes.find(change => change.key === 'tokens');
assert.ok(tokenChange);
assert.deepEqual(tokenChange.classes, ['token']);

const buttonChange = diff.changes.find(change => change.key === 'button');
assert.ok(buttonChange);
assert.deepEqual(buttonChange.classes, ['text', 'layout']);
assert.equal(buttonChange.nodeId, '1:1');

const removedChange = diff.changes.find(change => change.key === 'removed');
assert.ok(removedChange);
assert.deepEqual(removedChange.classes, ['structure']);
assert.match(removedChange.reasons[0], /missing from head/);

const addedChange = diff.changes.find(change => change.key === 'added');
assert.ok(addedChange);
assert.deepEqual(addedChange.classes, ['structure']);
assert.match(addedChange.reasons[0], /missing from base/);

assert.equal(
  selectSnapshotPair(['2026-05-04T09-00-00.json'], []),
  null
);

assert.deepEqual(
  selectSnapshotPair(
    ['2026-05-04T09-00-00.json', '2026-05-04T10-00-00.json'],
    ['2026-05-04T08-00-00.json']
  ),
  {
    comparisonMode: 'baseline',
    baseFile: '2026-05-04T08-00-00.json',
    headFile: '2026-05-04T10-00-00.json',
  }
);

assert.deepEqual(
  selectSnapshotPair(['2026-05-04T09-00-00.json', '2026-05-04T10-00-00.json'], []),
  {
    comparisonMode: 'bootstrap-latest-two',
    baseFile: '2026-05-04T09-00-00.json',
    headFile: '2026-05-04T10-00-00.json',
  }
);

// ============================================================================
// Stage 3 — diffCompliance unit tests
// ============================================================================

type Case = () => void;
let s3Failed = 0;
function run(label: string, fn: Case): void {
  try {
    fn();
    console.log(`ok  ${label}`);
  } catch (err) {
    s3Failed++;
    console.error(`FAIL ${label}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}

function mkDetachedStyle(over: Partial<DetachedStyleEntry>): DetachedStyleEntry {
  return {
    nodeId: '10:1',
    nodeName: 'X',
    nodePath: ['Root', 'X'],
    kind: 'color',
    property: 'fill',
    rawValue: { r: 1, g: 0, b: 0, a: 1 },
    suggestedToken: null,
    evidence: { hasNodeBoundVariables: false, styleId: null },
    ...over,
  };
}

function mkFrame(over: Partial<DescendantFrameEntry>): DescendantFrameEntry {
  return {
    nodeId: '20:1',
    nodeName: 'Promo',
    nodePath: ['Root', 'Promo'],
    name: 'Promo',
    parentRegisteredKey: 'pesse_home',
    ...over,
  };
}

function mkAsset(over: Partial<AssetRefEntry>): AssetRefEntry {
  return {
    nodeId: '30:1',
    nodeName: 'Card art',
    nodePath: ['Root', 'Card art'],
    kind: 'image',
    paintIndex: 0,
    ref: 'img-old',
    ...over,
  };
}

function mkSnapshotNode(over: Partial<SnapshotNodeEntry>): SnapshotNodeEntry {
  return {
    id: 'r:1',
    name: 'Root',
    lastModified: '2026-05-04T10:00:00.000Z',
    visible: true,
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    textHash: 'sha256:t',
    propsHash: 'sha256:p',
    componentPropsHash: 'sha256:c',
    texts: [],
    componentProps: [],
    detachedStyles: [],
    descendantFrames: [],
    assetRefs: [],
    ...over,
  };
}

run('diffCompliance: newDetachedStyles — head has entry, base does not', () => {
  const before = mkSnapshotNode({ detachedStyles: [] });
  const after = mkSnapshotNode({ detachedStyles: [mkDetachedStyle({ nodeId: '10:1', property: 'fill' })] });
  const r = diffCompliance(before, after);
  assert.equal(r.newDetachedStyles.length, 1);
  assert.equal(r.newDetachedStyles[0].nodeId, '10:1');
});

run('diffCompliance: existing detached style in both → not flagged', () => {
  const e = mkDetachedStyle({ nodeId: '10:1', property: 'fill' });
  const r = diffCompliance(mkSnapshotNode({ detachedStyles: [e] }), mkSnapshotNode({ detachedStyles: [e] }));
  assert.equal(r.newDetachedStyles.length, 0);
});

run('diffCompliance: resolved detached style (base only) → not in newDetachedStyles', () => {
  const r = diffCompliance(
    mkSnapshotNode({ detachedStyles: [mkDetachedStyle({ nodeId: '10:1', property: 'fill' })] }),
    mkSnapshotNode({ detachedStyles: [] })
  );
  assert.equal(r.newDetachedStyles.length, 0);
});

run('diffCompliance: same nodeId different property → both flagged when only one is new', () => {
  const base = mkSnapshotNode({
    detachedStyles: [mkDetachedStyle({ nodeId: '10:1', property: 'fill' })],
  });
  const head = mkSnapshotNode({
    detachedStyles: [
      mkDetachedStyle({ nodeId: '10:1', property: 'fill' }),
      mkDetachedStyle({ nodeId: '10:1', kind: 'typography', property: 'fontSize', rawValue: 18 }),
    ],
  });
  const r = diffCompliance(base, head);
  assert.equal(r.newDetachedStyles.length, 1);
  assert.equal(r.newDetachedStyles[0].property, 'fontSize');
});

run('diffCompliance: newFrames — head has new descendant frame', () => {
  const r = diffCompliance(
    mkSnapshotNode({ descendantFrames: [] }),
    mkSnapshotNode({ descendantFrames: [mkFrame({ nodeId: '20:1', name: 'Promo' })] })
  );
  assert.equal(r.newFrames.length, 1);
  assert.equal(r.newFrames[0].nodeId, '20:1');
});

run('diffCompliance: same frame in both → not flagged', () => {
  const f = mkFrame({ nodeId: '20:1' });
  const r = diffCompliance(mkSnapshotNode({ descendantFrames: [f] }), mkSnapshotNode({ descendantFrames: [f] }));
  assert.equal(r.newFrames.length, 0);
});

run('diffCompliance: changedImageRefs — same nodeId+paintIndex different ref', () => {
  const r = diffCompliance(
    mkSnapshotNode({ assetRefs: [mkAsset({ nodeId: '30:1', paintIndex: 0, ref: 'img-old' })] }),
    mkSnapshotNode({ assetRefs: [mkAsset({ nodeId: '30:1', paintIndex: 0, ref: 'img-new' })] })
  );
  assert.equal(r.changedImageRefs.length, 1);
  assert.equal(r.changedImageRefs[0].before?.ref, 'img-old');
  assert.equal(r.changedImageRefs[0].after.ref, 'img-new');
});

run('diffCompliance: changedImageRefs — same ref → not flagged', () => {
  const a = mkAsset({ nodeId: '30:1', paintIndex: 0, ref: 'img-x' });
  const r = diffCompliance(mkSnapshotNode({ assetRefs: [a] }), mkSnapshotNode({ assetRefs: [a] }));
  assert.equal(r.changedImageRefs.length, 0);
});

run('diffCompliance: changedImageRefs — new IMAGE paint where base had none → before:null', () => {
  const r = diffCompliance(
    mkSnapshotNode({ assetRefs: [] }),
    mkSnapshotNode({ assetRefs: [mkAsset({ nodeId: '30:1', paintIndex: 0, ref: 'img-new' })] })
  );
  assert.equal(r.changedImageRefs.length, 1);
  assert.equal(r.changedImageRefs[0].before, null);
  assert.equal(r.changedImageRefs[0].after.ref, 'img-new');
});

run('diffCompliance: undefined base node → all head compliance entries treated as new', () => {
  const head = mkSnapshotNode({
    detachedStyles: [mkDetachedStyle({})],
    descendantFrames: [mkFrame({})],
    assetRefs: [mkAsset({})],
  });
  const r = diffCompliance(undefined, head);
  assert.equal(r.newDetachedStyles.length, 1);
  assert.equal(r.newFrames.length, 1);
  assert.equal(r.changedImageRefs.length, 1);
  assert.equal(r.changedImageRefs[0].before, null);
});

run('diffCompliance: existing old-schema base node skips compliance to avoid rollout flood', () => {
  const oldSchemaBase = {
    id: 'r:1',
    name: 'Root',
    textHash: 'sha256:t',
    propsHash: 'sha256:p',
    componentPropsHash: 'sha256:c',
  };
  const head = mkSnapshotNode({
    detachedStyles: [mkDetachedStyle({})],
    descendantFrames: [mkFrame({})],
    assetRefs: [mkAsset({})],
  });
  const r = diffCompliance(oldSchemaBase, head);
  assert.equal(r.newDetachedStyles.length, 0);
  assert.equal(r.newFrames.length, 0);
  assert.equal(r.changedImageRefs.length, 0);
});

run('diffSnapshots: compliance-only change emits DiffChange (no text/props change)', () => {
  const base: SnapshotFile = {
    fileKey: 'file-x',
    timestamp: '2026-05-21T00:00:00.000Z',
    source: 'figma-rest',
    tokensHash: 'sha256:tok',
    nodes: {
      pesse_home: mkSnapshotNode({
        id: '7:3',
        name: 'Phone · Home',
        descendantFrames: [],
      }),
    },
  };
  const head: SnapshotFile = {
    ...base,
    timestamp: '2026-05-21T01:00:00.000Z',
    nodes: {
      pesse_home: mkSnapshotNode({
        id: '7:3',
        name: 'Phone · Home',
        descendantFrames: [mkFrame({ nodeId: '20:1', name: 'New Banner', parentRegisteredKey: 'pesse_home' })],
      }),
    },
  };
  const d = diffSnapshots(base, head, {
    comparisonMode: 'baseline',
    basePath: 'b.json',
    headPath: 'h.json',
  });
  const change = d.changes.find(c => c.key === 'pesse_home');
  assert.ok(change, 'expected a DiffChange for pesse_home');
  assert.ok(change.classes.includes('new-frame'), `expected new-frame class, got [${change.classes.join(',')}]`);
  assert.ok(change.compliance, 'expected compliance metadata');
  assert.equal(change.compliance.newFrames.length, 1);
});

run('diffSnapshots: !beforeNode with head detachedStyles → classes include detached-style + compliance attached', () => {
  const base: SnapshotFile = {
    fileKey: 'file-x',
    timestamp: '2026-05-25T00:00:00.000Z',
    source: 'figma-rest',
    tokensHash: 'sha256:tok',
    nodes: {},
  };
  const head: SnapshotFile = {
    ...base,
    timestamp: '2026-05-25T01:00:00.000Z',
    nodes: {
      brand_new_frame: mkSnapshotNode({
        id: '99:1',
        name: 'Phone · Brand New',
        detachedStyles: [
          mkDetachedStyle({ nodeId: '99:1:1', property: 'fill' }),
          mkDetachedStyle({ nodeId: '99:1:2', kind: 'typography', property: 'fontSize', rawValue: 18 }),
        ],
      }),
    },
  };
  const d = diffSnapshots(base, head, {
    comparisonMode: 'baseline',
    basePath: 'b.json',
    headPath: 'h.json',
  });
  const change = d.changes.find(c => c.key === 'brand_new_frame');
  assert.ok(change);
  assert.ok(change.classes.includes('structure'));
  assert.ok(change.classes.includes('detached-style'), `expected detached-style, got [${change.classes.join(',')}]`);
  assert.ok(change.compliance);
  assert.equal(change.compliance.newDetachedStyles.length, 2);
  assert.match(change.reasons.join('\n'), /2 new detached style/);
});

run('diffSnapshots: !beforeNode with clean head → only structure, no compliance attached (regression guard)', () => {
  const base: SnapshotFile = {
    fileKey: 'file-x',
    timestamp: '2026-05-25T00:00:00.000Z',
    source: 'figma-rest',
    tokensHash: 'sha256:tok',
    nodes: {},
  };
  const head: SnapshotFile = {
    ...base,
    timestamp: '2026-05-25T01:00:00.000Z',
    nodes: {
      clean_new_frame: mkSnapshotNode({ id: '99:2', name: 'Phone · Clean New' }),
    },
  };
  const d = diffSnapshots(base, head, {
    comparisonMode: 'baseline',
    basePath: 'b.json',
    headPath: 'h.json',
  });
  const change = d.changes.find(c => c.key === 'clean_new_frame');
  assert.ok(change);
  assert.deepEqual(change.classes, ['structure']);
  assert.equal(change.compliance, undefined);
});

run('diffSnapshots: !beforeNode with descendantFrames + assetRefs → classes include new-frame + image-change', () => {
  const base: SnapshotFile = {
    fileKey: 'file-x',
    timestamp: '2026-05-25T00:00:00.000Z',
    source: 'figma-rest',
    tokensHash: 'sha256:tok',
    nodes: {},
  };
  const head: SnapshotFile = {
    ...base,
    timestamp: '2026-05-25T01:00:00.000Z',
    nodes: {
      new_frame_with_extras: mkSnapshotNode({
        id: '99:3',
        name: 'Phone · Extras',
        descendantFrames: [mkFrame({ nodeId: '99:3:f1', name: 'Inner Frame' })],
        assetRefs: [mkAsset({ nodeId: '99:3:a1', paintIndex: 0, ref: 'img-fresh' })],
      }),
    },
  };
  const d = diffSnapshots(base, head, {
    comparisonMode: 'baseline',
    basePath: 'b.json',
    headPath: 'h.json',
  });
  const change = d.changes.find(c => c.key === 'new_frame_with_extras');
  assert.ok(change);
  assert.ok(change.classes.includes('new-frame'));
  assert.ok(change.classes.includes('image-change'));
  assert.ok(change.compliance);
  assert.equal(change.compliance.newFrames.length, 1);
  assert.equal(change.compliance.changedImageRefs.length, 1);
  assert.equal(change.compliance.changedImageRefs[0].before, null);
});

run('diffSnapshots: !beforeNode with legacy head (no compliance arrays) → only structure', () => {
  const base: SnapshotFile = {
    fileKey: 'file-x',
    timestamp: '2026-05-25T00:00:00.000Z',
    source: 'figma-rest',
    tokensHash: 'sha256:tok',
    nodes: {},
  };
  const head: SnapshotFile = {
    ...base,
    timestamp: '2026-05-25T01:00:00.000Z',
    nodes: {
      legacy_new_frame: {
        id: '99:4',
        name: 'Phone · Legacy New',
        lastModified: '2026-05-25T01:00:00.000Z',
        visible: true,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        textHash: 'sha256:t',
        propsHash: 'sha256:p',
        componentPropsHash: 'sha256:c',
        texts: [],
        componentProps: [],
      },
    },
  };
  const d = diffSnapshots(base, head, {
    comparisonMode: 'baseline',
    basePath: 'b.json',
    headPath: 'h.json',
  });
  const change = d.changes.find(c => c.key === 'legacy_new_frame');
  assert.ok(change);
  assert.deepEqual(change.classes, ['structure']);
  assert.equal(change.compliance, undefined);
});

run('diffSnapshots: text change + compliance change → both classes attached', () => {
  const base: SnapshotFile = {
    fileKey: 'file-x',
    timestamp: '2026-05-21T00:00:00.000Z',
    source: 'figma-rest',
    tokensHash: 'sha256:tok',
    nodes: {
      pesse_cards: mkSnapshotNode({
        id: '7:4',
        name: 'Phone · Cards',
        textHash: 'sha256:text-old',
        detachedStyles: [],
      }),
    },
  };
  const head: SnapshotFile = {
    ...base,
    timestamp: '2026-05-21T01:00:00.000Z',
    nodes: {
      pesse_cards: mkSnapshotNode({
        id: '7:4',
        name: 'Phone · Cards',
        textHash: 'sha256:text-new',
        detachedStyles: [mkDetachedStyle({ nodeId: '7:4:1', property: 'fill' })],
      }),
    },
  };
  const d = diffSnapshots(base, head, {
    comparisonMode: 'baseline',
    basePath: 'b.json',
    headPath: 'h.json',
  });
  const change = d.changes.find(c => c.key === 'pesse_cards');
  assert.ok(change);
  assert.ok(change.classes.includes('text'));
  assert.ok(change.classes.includes('detached-style'));
});

if (s3Failed > 0) {
  console.error(`\n${s3Failed} Stage 3 test(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll diff-snapshot tests (incl. Stage 3) passed.`);
