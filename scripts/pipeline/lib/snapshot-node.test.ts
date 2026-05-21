import assert from 'node:assert/strict';
import {
  buildSnapshotNodeEntry,
  collectAssetRefs,
  collectComponentPropLeaves,
  collectDescendantFrames,
  collectDetachedStyles,
  collectTextLeaves,
  type FigmaNodeDetail,
} from './snapshot-node.ts';

type Case = () => void;
let failed = 0;
function run(label: string, fn: Case): void {
  try {
    fn();
    console.log(`ok  ${label}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}

// --- Existing behavior (must remain green) ---

const sampleNode = {
  id: '1:1',
  name: 'Button',
  type: 'COMPONENT',
  visible: true,
  absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 44 },
  componentPropertyDefinitions: {
    Variant: { type: 'VARIANT', defaultValue: 'Primary' },
  },
  children: [
    {
      id: '1:2',
      name: 'Label',
      type: 'TEXT',
      characters: 'Confirm',
    },
    {
      id: '1:3',
      name: 'Icon instance',
      type: 'INSTANCE',
      componentProperties: {
        Size: { type: 'VARIANT', value: 'lg' },
        Disabled: { type: 'BOOLEAN', value: false },
      },
      variantProperties: {
        State: 'Default',
      },
    },
  ],
} as const;

run('collectTextLeaves: existing sample', () => {
  assert.deepEqual(collectTextLeaves(sampleNode), [
    {
      nodeId: '1:2',
      nodeName: 'Label',
      path: ['Button', 'Label'],
      value: 'Confirm',
    },
  ]);
});

run('collectComponentPropLeaves: existing sample', () => {
  assert.deepEqual(collectComponentPropLeaves(sampleNode), [
    {
      nodeId: '1:1',
      nodeName: 'Button',
      path: ['Button'],
      source: 'componentPropertyDefinitions',
      propName: 'Variant',
      propType: 'VARIANT',
      value: 'Primary',
    },
    {
      nodeId: '1:3',
      nodeName: 'Icon instance',
      path: ['Button', 'Icon instance'],
      source: 'componentProperties',
      propName: 'Disabled',
      propType: 'BOOLEAN',
      value: false,
    },
    {
      nodeId: '1:3',
      nodeName: 'Icon instance',
      path: ['Button', 'Icon instance'],
      source: 'componentProperties',
      propName: 'Size',
      propType: 'VARIANT',
      value: 'lg',
    },
    {
      nodeId: '1:3',
      nodeName: 'Icon instance',
      path: ['Button', 'Icon instance'],
      source: 'variantProperties',
      propName: 'State',
      propType: 'VARIANT',
      value: 'Default',
    },
  ]);
});

run('buildSnapshotNodeEntry: hashes unchanged from baseline (backwards-compat lock)', () => {
  const entry = buildSnapshotNodeEntry(sampleNode, '2026-04-30T00:00:00.000Z');
  assert.equal(entry.id, '1:1');
  assert.equal(entry.texts.length, 1);
  assert.equal(entry.componentProps.length, 4);
  assert.equal(
    entry.textHash,
    'sha256:eebdd24a77d9ad32222660c07777163bf5f6732df2b172351f3f8d5783e4f529'
  );
  assert.equal(
    entry.propsHash,
    'sha256:b4f86e31d21803d58dbb2df1981cd922e617a378de57991f0216c42442aece68'
  );
  assert.equal(
    entry.componentPropsHash,
    'sha256:9d9f9523e5dde12acf8c5906325e2c7d145d2e9c9c32f9c3ded2b44f4161e27e'
  );
});

run('buildSnapshotNodeEntry: returns empty compliance fields for sample without fills/frames', () => {
  const entry = buildSnapshotNodeEntry(sampleNode, '2026-04-30T00:00:00.000Z', 'button_key');
  assert.deepEqual(entry.detachedStyles, []);
  assert.deepEqual(entry.descendantFrames, []);
  assert.deepEqual(entry.assetRefs, []);
});

// --- collectDescendantFrames ---

run('collectDescendantFrames: collects direct child FRAMEs, excludes root', () => {
  const node: FigmaNodeDetail = {
    id: 'r:1',
    name: 'Home Screen',
    type: 'FRAME',
    children: [
      { id: 'r:2', name: 'Header', type: 'FRAME', children: [] },
      { id: 'r:3', name: 'Promo Banner', type: 'FRAME', children: [] },
      { id: 'r:4', name: 'Avatar', type: 'INSTANCE' },
    ],
  };
  const frames = collectDescendantFrames(node, 'pesse_home');
  assert.equal(frames.length, 2);
  assert.deepEqual(
    frames.map(f => f.nodeId).sort(),
    ['r:2', 'r:3']
  );
  for (const f of frames) {
    assert.equal(f.parentRegisteredKey, 'pesse_home');
    assert.equal(typeof f.name, 'string');
    assert.ok(Array.isArray(f.nodePath));
    assert.equal(f.nodePath[0], 'Home Screen');
  }
});

run('collectDescendantFrames: filters wrapper noise names', () => {
  const node: FigmaNodeDetail = {
    id: 'w:1',
    name: 'Cards Screen',
    type: 'FRAME',
    children: [
      { id: 'w:2', name: 'Wrapper', type: 'FRAME', children: [] },
      { id: 'w:3', name: '_', type: 'FRAME', children: [] },
      { id: 'w:4', name: 'Auto layout', type: 'FRAME', children: [] },
      { id: 'w:5', name: 'Container', type: 'FRAME', children: [] },
      { id: 'w:6', name: '_internal', type: 'FRAME', children: [] },
      { id: 'w:7', name: 'Card Detail', type: 'FRAME', children: [] },
    ],
  };
  const frames = collectDescendantFrames(node, 'pesse_cards');
  assert.deepEqual(
    frames.map(f => f.nodeId),
    ['w:7']
  );
});

run('collectDescendantFrames: deep traversal through non-frame containers', () => {
  const node: FigmaNodeDetail = {
    id: 'd:1',
    name: 'Send Screen',
    type: 'FRAME',
    children: [
      {
        id: 'd:2',
        name: 'Section',
        type: 'GROUP',
        children: [
          { id: 'd:3', name: 'Promo', type: 'FRAME', children: [] },
        ],
      },
    ],
  };
  const frames = collectDescendantFrames(node, 'pesse_send');
  assert.equal(frames.length, 1);
  assert.equal(frames[0].nodeId, 'd:3');
  assert.deepEqual(frames[0].nodePath, ['Send Screen', 'Section', 'Promo']);
});

// --- collectAssetRefs ---

run('collectAssetRefs: collects IMAGE paint imageRef with paintIndex', () => {
  const node: FigmaNodeDetail = {
    id: 'a:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 'a:2',
        name: 'Card art',
        type: 'RECTANGLE',
        fills: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } },
          { type: 'IMAGE', imageRef: 'img-abc-123', scaleMode: 'FILL' },
        ],
      },
    ],
  };
  const refs = collectAssetRefs(node);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].nodeId, 'a:2');
  assert.equal(refs[0].kind, 'image');
  assert.equal(refs[0].paintIndex, 1);
  assert.equal(refs[0].ref, 'img-abc-123');
  assert.deepEqual(refs[0].nodePath, ['Home', 'Card art']);
});

run('collectAssetRefs: ignores non-IMAGE paints and IMAGE without imageRef', () => {
  const node: FigmaNodeDetail = {
    id: 'a:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 'a:2',
        name: 'Solid',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
      },
      {
        id: 'a:3',
        name: 'Empty image',
        type: 'RECTANGLE',
        fills: [{ type: 'IMAGE' }],
      },
    ],
  };
  assert.deepEqual(collectAssetRefs(node), []);
});

// --- collectDetachedStyles ---

run('collectDetachedStyles: raw SOLID fill without boundVariables/styleId → color entry', () => {
  const node: FigmaNodeDetail = {
    id: 's:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 's:2',
        name: 'Pill',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
      },
    ],
  };
  const detached = collectDetachedStyles(node);
  assert.equal(detached.length, 1);
  const [entry] = detached;
  assert.equal(entry.nodeId, 's:2');
  assert.equal(entry.kind, 'color');
  assert.equal(entry.property, 'fill');
  assert.deepEqual(entry.rawValue, { r: 1, g: 0, b: 0, a: 1 });
  assert.equal(entry.suggestedToken, null);
  assert.equal(entry.evidence.hasNodeBoundVariables, false);
  assert.equal(entry.evidence.styleId, null);
});

run('collectDetachedStyles: SOLID with paint-level boundVariables → no entry (bound)', () => {
  const node: FigmaNodeDetail = {
    id: 's:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 's:2',
        name: 'Bound Pill',
        type: 'RECTANGLE',
        fills: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:1' } },
          },
        ],
      },
    ],
  };
  assert.deepEqual(collectDetachedStyles(node), []);
});

run('collectDetachedStyles: fillStyleId present → no entry (style-bound)', () => {
  const node: FigmaNodeDetail = {
    id: 's:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 's:2',
        name: 'Styled Pill',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
        fillStyleId: 'S:abc',
      },
    ],
  };
  assert.deepEqual(collectDetachedStyles(node), []);
});

run('collectDetachedStyles: TEXT with raw fontSize, no textStyleId, no boundVariables → typography entry', () => {
  const node: FigmaNodeDetail = {
    id: 't:1',
    name: 'Send',
    type: 'FRAME',
    children: [
      {
        id: 't:2',
        name: 'CTA',
        type: 'TEXT',
        characters: 'Send money',
        style: { fontFamily: 'Inter', fontSize: 18, fontWeight: 600 },
      },
    ],
  };
  const detached = collectDetachedStyles(node);
  const properties = detached.map(d => d.property).sort();
  assert.ok(properties.includes('fontSize'), `expected fontSize entry, got ${properties.join(',')}`);
  const fontSize = detached.find(d => d.property === 'fontSize')!;
  assert.equal(fontSize.kind, 'typography');
  assert.equal(fontSize.nodeId, 't:2');
  assert.equal(fontSize.rawValue, 18);
});

run('collectDetachedStyles: TEXT with textStyleId → no typography entry', () => {
  const node: FigmaNodeDetail = {
    id: 't:1',
    name: 'Send',
    type: 'FRAME',
    children: [
      {
        id: 't:2',
        name: 'CTA',
        type: 'TEXT',
        characters: 'Send money',
        style: { fontFamily: 'Inter', fontSize: 18 },
        textStyleId: 'S:body',
      },
    ],
  };
  assert.deepEqual(collectDetachedStyles(node), []);
});

// --- Codex P1 fixes: per-property bound check + stroke detection ---

run('collectDetachedStyles: mixed typography — fontSize bound at node, fontFamily raw → only fontFamily flagged', () => {
  const node: FigmaNodeDetail = {
    id: 'm:1',
    name: 'Send',
    type: 'FRAME',
    children: [
      {
        id: 'm:2',
        name: 'CTA',
        type: 'TEXT',
        characters: 'Send money',
        style: { fontFamily: 'Inter', fontSize: 18 },
        boundVariables: { fontSize: { type: 'VARIABLE_ALIAS', id: 'V:fontSize' } },
      },
    ],
  };
  const detached = collectDetachedStyles(node);
  const props = detached.map(d => d.property);
  assert.deepEqual(props, ['fontFamily'], `expected only fontFamily, got [${props.join(',')}]`);
});

run('collectDetachedStyles: mixed fills — paint[0] bound at paint level, paint[1] raw → only paint[1] flagged', () => {
  const node: FigmaNodeDetail = {
    id: 'mf:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 'mf:2',
        name: 'Layered',
        type: 'RECTANGLE',
        fills: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0, a: 1 },
            boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:1' } },
          },
          { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } },
        ],
      },
    ],
  };
  const detached = collectDetachedStyles(node);
  assert.equal(detached.length, 1);
  assert.deepEqual(detached[0].rawValue, { r: 0, g: 1, b: 0, a: 1 });
});

run('collectDetachedStyles: node.boundVariables.fills[paintIndex] suppresses that paint only', () => {
  const node: FigmaNodeDetail = {
    id: 'nf:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 'nf:2',
        name: 'Two paints',
        type: 'RECTANGLE',
        fills: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } },
          { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } },
        ],
        boundVariables: {
          fills: [{ color: { type: 'VARIABLE_ALIAS', id: 'V:1' } }],
        },
      },
    ],
  };
  const detached = collectDetachedStyles(node);
  assert.equal(detached.length, 1);
  assert.deepEqual(detached[0].rawValue, { r: 0, g: 1, b: 0, a: 1 });
});

run('collectDetachedStyles: raw stroke SOLID without boundVariables/styleId → stroke entry', () => {
  const node: FigmaNodeDetail = {
    id: 's2:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 's2:2',
        name: 'Outline',
        type: 'RECTANGLE',
        strokes: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } }],
      },
    ],
  };
  const detached = collectDetachedStyles(node);
  assert.equal(detached.length, 1);
  assert.equal(detached[0].kind, 'color');
  assert.equal(detached[0].property, 'stroke');
  assert.equal(detached[0].nodeId, 's2:2');
});

run('collectDetachedStyles: stroke paint-bound or strokeStyleId → no entry', () => {
  const bound: FigmaNodeDetail = {
    id: 's3:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 's3:2',
        name: 'Bound Outline',
        type: 'RECTANGLE',
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V:s' } },
          },
        ],
      },
    ],
  };
  assert.deepEqual(collectDetachedStyles(bound), []);

  const styled: FigmaNodeDetail = {
    id: 's4:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      {
        id: 's4:2',
        name: 'Styled Outline',
        type: 'RECTANGLE',
        strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
        strokeStyleId: 'S:outline',
      },
    ],
  };
  assert.deepEqual(collectDetachedStyles(styled), []);
});

run('buildSnapshotNodeEntry: populates compliance fields from deep tree', () => {
  const node: FigmaNodeDetail = {
    id: 'p:1',
    name: 'Home',
    type: 'FRAME',
    children: [
      { id: 'p:2', name: 'Promo Banner', type: 'FRAME', children: [] },
      {
        id: 'p:3',
        name: 'Card art',
        type: 'RECTANGLE',
        fills: [{ type: 'IMAGE', imageRef: 'img-xyz' }],
      },
      {
        id: 'p:4',
        name: 'Pill',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } }],
      },
    ],
  };
  const entry = buildSnapshotNodeEntry(node, '2026-05-21T00:00:00.000Z', 'pesse_home');
  assert.equal(entry.descendantFrames.length, 1);
  assert.equal(entry.descendantFrames[0].nodeId, 'p:2');
  assert.equal(entry.descendantFrames[0].parentRegisteredKey, 'pesse_home');
  assert.equal(entry.assetRefs.length, 1);
  assert.equal(entry.assetRefs[0].nodeId, 'p:3');
  assert.equal(entry.detachedStyles.length, 1);
  assert.equal(entry.detachedStyles[0].nodeId, 'p:4');
});

if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll snapshot-node tests passed.`);
