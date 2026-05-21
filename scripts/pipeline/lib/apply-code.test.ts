import assert from 'node:assert/strict';
import type { ClassifiedDiffFile } from './classify-diff.ts';
import type { SnapshotFile } from './diff-snapshot.ts';
import {
  applyMarkedPropUpdates,
  applyMarkedTextUpdates,
  extractComponentPropUpdates,
  extractTextUpdates,
} from './apply-code.ts';

const classifiedBase = {
  stage: 'classified',
  sourceStage: 'diff',
  generatedAt: '2026-05-06T12:00:00.000Z',
  fileKey: 'file-1',
  comparisonMode: 'baseline',
  baseTs: '2026-05-06T10:00:00.000Z',
  headTs: '2026-05-06T11:00:00.000Z',
  basePath: 'base.json',
  headPath: 'head.json',
  summary: {
    total: 0,
    autoApply: 0,
    reportOnly: 0,
    unknown: 0,
  },
  changes: [],
} satisfies ClassifiedDiffFile;

const snapshotBase = {
  fileKey: 'file-1',
  timestamp: '2026-05-06T10:00:00.000Z',
  source: 'figma-rest',
  tokensHash: 'same',
  nodes: {},
} satisfies SnapshotFile;

const nodeBase = {
  id: 'node-1',
  name: 'Badge',
  boundingBox: null,
  textHash: 'before-text',
  propsHash: 'same-props',
  componentPropsHash: 'before-props',
};

const classifiedWithText = {
  ...classifiedBase,
  changes: [
    {
      key: 'badge',
      nodeId: 'node-1',
      nodeName: 'Badge',
      classes: ['text'],
      subcategories: ['text-change'],
      reasons: ['textHash changed'],
      before: {},
      after: {},
      decision: 'auto-apply',
      decisionReasons: ['Mapped target allows all changed classes'],
      target: {
        section: 'components',
        apply: 'auto',
        allowedClasses: ['text'],
        code: '../src/components/Badge.tsx',
        targetType: 'atomic-component',
      },
    },
  ],
} satisfies ClassifiedDiffFile;

const classifiedWithProps = {
  ...classifiedBase,
  changes: [
    {
      key: 'notificationCard',
      nodeId: 'node-1',
      nodeName: 'Notification Card',
      classes: ['component-props'],
      subcategories: ['props-change'],
      reasons: ['componentPropsHash changed'],
      before: {},
      after: {},
      decision: 'auto-apply',
      decisionReasons: ['Mapped target allows all changed classes'],
      target: {
        section: 'compositions',
        apply: 'partial',
        allowedClasses: ['component-props'],
        code: '../src/compositions/NotificationCard.tsx',
        targetType: 'composite-component',
      },
    },
  ],
} satisfies ClassifiedDiffFile;

const baseSnapshot = {
  ...snapshotBase,
  nodes: {
    badge: {
      ...nodeBase,
      texts: [{ nodeId: '15:11400', nodeName: 'ADMIN', path: ['Badge', 'ADMIN'], value: 'ADMIN' }],
      componentProps: [],
    },
  },
} satisfies SnapshotFile;

const headSnapshot = {
  ...snapshotBase,
  timestamp: '2026-05-06T11:00:00.000Z',
  nodes: {
    badge: {
      ...nodeBase,
      textHash: 'after-text',
      texts: [{ nodeId: '15:11400', nodeName: 'ADMIN', path: ['Badge', 'ADMIN'], value: 'SUPER ADMIN' }],
      componentProps: [],
    },
  },
} satisfies SnapshotFile;

assert.deepEqual(extractTextUpdates(classifiedWithText, baseSnapshot, headSnapshot), [
  {
    key: 'badge',
    nodeId: '15:11400',
    value: 'SUPER ADMIN',
    code: '../src/components/Badge.tsx',
  },
]);

assert.deepEqual(
  applyMarkedTextUpdates(
    "const LABELS = { admin: /* figma:text id=\"badge.admin\" node=\"15:11400\" */ 'ADMIN' }\n",
    [{ key: 'badge', nodeId: '15:11400', value: 'SUPER ADMIN', code: '../src/components/Badge.tsx' }]
  ),
  {
    changed: true,
    source:
      "const LABELS = { admin: /* figma:text id=\"badge.admin\" node=\"15:11400\" */ 'SUPER ADMIN' }\n",
    appliedNodeIds: ['15:11400'],
    missingNodeIds: [],
  }
);

assert.equal(
  applyMarkedTextUpdates(
    "const LABELS = { admin: /* figma:text id=\"badge.admin\" node=\"15:11400\" */ 'ADMIN' }\n",
    [{ key: 'badge', nodeId: '15:99999', value: 'OWNER', code: '../src/components/Badge.tsx' }]
  ).changed,
  false
);

const basePropsSnapshot = {
  ...snapshotBase,
  nodes: {
    notificationCard: {
      ...nodeBase,
      texts: [],
      componentProps: [
        {
          nodeId: '20:11424',
          nodeName: 'Notification Card',
          path: ['Notification Card'],
          source: 'componentPropertyDefinitions',
          propName: 'State',
          propType: 'VARIANT',
          value: 'Pending',
        },
      ],
    },
  },
} satisfies SnapshotFile;

const headPropsSnapshot = {
  ...basePropsSnapshot,
  nodes: {
    notificationCard: {
      ...basePropsSnapshot.nodes.notificationCard,
      componentPropsHash: 'after-props',
      componentProps: [
        {
          nodeId: '20:11424',
          nodeName: 'Notification Card',
          path: ['Notification Card'],
          source: 'componentPropertyDefinitions',
          propName: 'State',
          propType: 'VARIANT',
          value: 'Accepted',
        },
      ],
    },
  },
} satisfies SnapshotFile;

assert.deepEqual(extractComponentPropUpdates(classifiedWithProps, basePropsSnapshot, headPropsSnapshot), [
  {
    key: 'notificationCard',
    nodeId: '20:11424',
    propName: 'State',
    value: 'Accepted',
    code: '../src/compositions/NotificationCard.tsx',
  },
]);

assert.deepEqual(
  applyMarkedPropUpdates(
    '<>{/* figma:prop id="notificationCard.state" node="20:11424" prop="state" */}<NotificationCard state="Pending" /></>',
    [
      {
        key: 'notificationCard',
        nodeId: '20:11424',
        propName: 'State',
        value: 'Accepted',
        code: '../src/compositions/NotificationCard.tsx',
      },
    ]
  ),
  {
    changed: true,
    source:
      '<>{/* figma:prop id="notificationCard.state" node="20:11424" prop="state" */}<NotificationCard state="Accepted" /></>',
    appliedNodeIds: ['20:11424'],
    missingNodeIds: [],
  }
);

assert.deepEqual(
  applyMarkedPropUpdates(
    "function Button({ size = /* figma:prop id=\"button.size\" node=\"14:11402\" prop=\"size\" transform=\"lower\" */ 'lg' }) { return size }\n",
    [
      {
        key: 'button',
        nodeId: '14:11402',
        propName: 'Size',
        value: 'MD',
        code: '../src/components/Button.tsx',
      },
    ]
  ),
  {
    changed: true,
    source:
      "function Button({ size = /* figma:prop id=\"button.size\" node=\"14:11402\" prop=\"size\" transform=\"lower\" */ 'md' }) { return size }\n",
    appliedNodeIds: ['14:11402'],
    missingNodeIds: [],
  }
);

assert.deepEqual(
  applyMarkedPropUpdates(
    "function Header({ variant = /* figma:prop id=\"header.variant\" node=\"18:11416\" prop=\"variant\" transform=\"pascal-compact\" */ 'BackTitle' }) { return variant }\n",
    [
      {
        key: 'header',
        nodeId: '18:11416',
        propName: 'Variant',
        value: 'Back-Title-NoAction',
        code: '../src/compositions/Header.tsx',
      },
    ]
  ),
  {
    changed: true,
    source:
      "function Header({ variant = /* figma:prop id=\"header.variant\" node=\"18:11416\" prop=\"variant\" transform=\"pascal-compact\" */ 'BackTitleNoAction' }) { return variant }\n",
    appliedNodeIds: ['18:11416'],
    missingNodeIds: [],
  }
);

assert.deepEqual(
  applyMarkedPropUpdates(
    [
      'function Avatar({',
      '  size = /* figma:prop id="avatar.size" node="15:11398" prop="size" transform="lower" */ \'md\',',
      '  state = /* figma:prop id="avatar.state" node="15:11398" prop="state" transform="lower" */ \'default\',',
      '}) { return `${size}:${state}` }',
      '',
    ].join('\n'),
    [
      {
        key: 'avatar',
        nodeId: '15:11398',
        propName: 'Size',
        value: 'LG',
        code: '../src/components/Avatar.tsx',
      },
      {
        key: 'avatar',
        nodeId: '15:11398',
        propName: 'State',
        value: 'Active',
        code: '../src/components/Avatar.tsx',
      },
    ]
  ),
  {
    changed: true,
    source: [
      'function Avatar({',
      '  size = /* figma:prop id="avatar.size" node="15:11398" prop="size" transform="lower" */ \'lg\',',
      '  state = /* figma:prop id="avatar.state" node="15:11398" prop="state" transform="lower" */ \'active\',',
      '}) { return `${size}:${state}` }',
      '',
    ].join('\n'),
    appliedNodeIds: ['15:11398', '15:11398'],
    missingNodeIds: [],
  }
);

// ---------- decisionFilter regression + report-only path ----------

const classifiedReportOnlyText = {
  ...classifiedWithText,
  changes: [
    {
      ...classifiedWithText.changes[0],
      decision: 'report-only',
      decisionReasons: ['Pending designer approval'],
      target: {
        ...classifiedWithText.changes[0].target,
        apply: 'report-only',
      },
    },
  ],
} satisfies ClassifiedDiffFile;

// Default filter (no option) still extracts only auto-apply — cron path stays unchanged.
assert.deepEqual(
  extractTextUpdates(classifiedReportOnlyText, baseSnapshot, headSnapshot),
  [],
  'default filter must skip report-only (cron regression guard)'
);

// Explicit report-only filter (designer-approval path) picks up the change.
assert.deepEqual(
  extractTextUpdates(classifiedReportOnlyText, baseSnapshot, headSnapshot, {
    decisionFilter: ['report-only'],
  }),
  [
    {
      key: 'badge',
      nodeId: '15:11400',
      value: 'SUPER ADMIN',
      code: '../src/components/Badge.tsx',
    },
  ]
);

// Same for prop updates.
const classifiedReportOnlyProps = {
  ...classifiedWithProps,
  changes: [
    {
      ...classifiedWithProps.changes[0],
      decision: 'report-only',
      decisionReasons: ['Pending designer approval'],
      target: {
        ...classifiedWithProps.changes[0].target,
        apply: 'report-only',
      },
    },
  ],
} satisfies ClassifiedDiffFile;

assert.deepEqual(
  extractComponentPropUpdates(classifiedReportOnlyProps, basePropsSnapshot, headPropsSnapshot),
  [],
  'default filter must skip report-only props (cron regression guard)'
);

assert.deepEqual(
  extractComponentPropUpdates(classifiedReportOnlyProps, basePropsSnapshot, headPropsSnapshot, {
    decisionFilter: ['report-only'],
  }),
  [
    {
      key: 'notificationCard',
      nodeId: '20:11424',
      propName: 'State',
      value: 'Accepted',
      code: '../src/compositions/NotificationCard.tsx',
    },
  ]
);

console.log('apply-code PASS');
