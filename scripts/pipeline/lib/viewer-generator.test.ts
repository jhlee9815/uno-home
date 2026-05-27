import assert from 'node:assert/strict';
import { buildViewerHtml, extractChangedNodeIds, viewerUrlFor } from './viewer-generator.ts';

const classified = {
  summary: { total: 2, autoApply: 0, reportOnly: 2, unknown: 0 },
  changes: [
    {
      key: 'pesse_home',
      nodeId: '7:3',
      nodeName: 'Pesse Home',
      classes: ['detached-style', 'new-frame'],
      reasons: ['1 new detached style(s)'],
      decision: 'report-only',
      decisionReasons: ['manual only'],
      target: { code: '../src/screens/PesseHomeScreen.tsx', section: 'screens' },
      subcategories: ['detached-style', 'new-frame'],
    },
    {
      key: 'pesse_cards',
      nodeId: '7:4',
      nodeName: 'Pesse Cards',
      classes: ['image-change'],
      reasons: ['1 image asset change(s)'],
      decision: 'report-only',
      decisionReasons: ['manual only'],
      target: { code: '../src/screens/PesseCardsScreen.tsx', section: 'screens' },
      subcategories: ['image-change'],
    },
  ],
};

assert.deepEqual(extractChangedNodeIds(classified), ['7:3', '7:4']);
assert.equal(
  viewerUrlFor('https://jhlee9815.github.io/design-review-bot', 'cs-test'),
  'https://jhlee9815.github.io/design-review-bot/cs/cs-test/'
);

const html = buildViewerHtml({
  csId: 'cs-test',
  fileKey: 'figma-file',
  issueUrl: 'https://github.com/jhlee9815/design-review-bot/issues/9',
  classified,
  imageRefs: {
    '7:3': { before: 'images/7-3-before.png', after: 'images/7-3-after.png' },
    '7:4': { before: null, after: 'images/7-4-after.png' },
  },
});

assert.match(html, /이전 \(Before\)/);
assert.match(html, /현재 \(After\)/);
assert.match(html, /designer-approved/);
assert.match(html, /designer-rejected/);
assert.match(html, /Pesse Home/);
// Category tags now render the Korean label instead of the raw class.
assert.match(html, /디자인 시스템 미사용/);
assert.match(html, /새 화면 추가/);
assert.match(html, /이미지 변경/);
assert.match(html, /Figma에서 열기/);
assert.match(html, /src\/screens\/PesseHomeScreen\.tsx/);

// Regression: in real classifier output, `classes[]` carries raw low-level
// names like 'text' / 'component-props' that don't have their own Korean
// labels. The viewer must prefer `subcategories[]` (already normalized by
// the classifier) so a text-change renders as "텍스트 변경", not "text".
const realClassified = {
  summary: { total: 1, autoApply: 0, reportOnly: 1, unknown: 0 },
  changes: [
    {
      key: 'header_title',
      nodeId: '8:1',
      nodeName: 'Header Title',
      classes: ['text'],
      reasons: ['characters changed'],
      decision: 'report-only',
      decisionReasons: ['manual only'],
      target: { code: '../src/components/Header.tsx', section: 'components' },
      subcategories: ['text-change'],
    },
  ],
};
const realHtml = buildViewerHtml({
  csId: 'cs-real',
  fileKey: 'figma-file',
  classified: realClassified,
  imageRefs: {},
});
assert.match(realHtml, /텍스트 변경/, 'real classifier output should localize via subcategories');
assert.doesNotMatch(realHtml, /class="tag">[^<]*\btext\b[^<]*<\/span>/, 'should not leak raw "text" class as a tag');

// Mixed: a change with mapped + unmapped raw classes
//   classes:      ['text', 'layout']
//   subcategories: ['text-change']
// Expected: both "텍스트 변경" AND "레이아웃 변경" appear as tags. The
// previous subcategories-only path dropped 'layout' silently.
const mixedClassified = {
  summary: { total: 1, autoApply: 0, reportOnly: 1, unknown: 0 },
  changes: [
    {
      key: 'mixed',
      nodeId: '10:1',
      nodeName: 'Mixed change',
      classes: ['text', 'layout'],
      reasons: [],
      decision: 'report-only',
      decisionReasons: [],
      target: { code: null },
      subcategories: ['text-change'],
    },
  ],
};
const mixedHtml = buildViewerHtml({
  csId: 'cs-mixed',
  fileKey: 'figma-file',
  classified: mixedClassified,
  imageRefs: {},
});
assert.match(mixedHtml, /텍스트 변경/);
assert.match(mixedHtml, /레이아웃 변경/, 'unmapped raw classes must still surface as tags');

// Fallback: when subcategories[] is missing (older snapshots), labelForClass
// passes the raw class through unchanged so nothing is silently dropped.
const legacyClassified = {
  summary: { total: 1, autoApply: 0, reportOnly: 1, unknown: 0 },
  changes: [
    {
      key: 'legacy',
      nodeId: '9:1',
      nodeName: 'Legacy node',
      classes: ['new-frame'],
      reasons: [],
      decision: 'report-only',
      decisionReasons: [],
      target: { code: null },
    },
  ],
};
const legacyHtml = buildViewerHtml({
  csId: 'cs-legacy',
  fileKey: 'figma-file',
  classified: legacyClassified,
  imageRefs: {},
});
assert.match(legacyHtml, /새 화면 추가/);

// textChanges block: when a change carries leaf-level text diffs, the viewer
// must render a dedicated section with before/after values so designers can
// see "what specifically changed" without opening the diff JSON. Previously
// the card only said "textHash changed" and the designer had to guess.
const textChangedClassified = {
  summary: { total: 1, autoApply: 0, reportOnly: 1, unknown: 0 },
  changes: [
    {
      key: 'pesse_home',
      nodeId: '81:302',
      nodeName: 'Phone · Home — Balance',
      classes: ['text'],
      reasons: [
        '텍스트 변경 — Balance: "$25,521,098.31" → "$23,521,098.31"',
        '텍스트 변경 — Greeting: "Pessse" → "Pesse"',
      ],
      decision: 'report-only',
      decisionReasons: ['report-only mapping'],
      target: { code: '../src/screens/PesseHomeScreen.tsx', section: 'screens' },
      subcategories: ['text-change'],
      textChanges: [
        {
          nodeId: '81:303',
          nodeName: 'Balance',
          path: ['Phone', 'Balance'],
          before: '$25,521,098.31',
          after: '$23,521,098.31',
        },
        {
          nodeId: '81:304',
          nodeName: 'Greeting',
          path: ['Phone', 'Greeting'],
          before: 'Pessse',
          after: 'Pesse',
        },
      ],
    },
  ],
};
const textHtml = buildViewerHtml({
  csId: 'cs-textchanges',
  fileKey: 'figma-file',
  classified: textChangedClassified,
  imageRefs: { '81:302': { before: null, after: 'images/81-302-after.png' } },
});
assert.match(textHtml, /텍스트 변경 2건/, 'header should show count');
assert.match(textHtml, /\$25,521,098\.31/, 'before value must render');
assert.match(textHtml, /\$23,521,098\.31/, 'after value must render');
assert.match(textHtml, /Pessse/);
assert.match(textHtml, /Pesse/);
// When baseline image is missing but a current snapshot exists, replace the
// terse "이전 baseline 이미지 없음" with explanatory copy so designers don't
// think the diff is broken.
assert.match(textHtml, /baseline 이미지 미등록/, 'should explain missing baseline');
assert.match(textHtml, /다음 baseline-promote 후 cycle부터/, 'should hint at remediation');

// Null before/after slot rendering — additions render "(없음)" and removals
// render "(삭제됨)" instead of an empty cell.
const partialClassified = {
  summary: { total: 1, autoApply: 0, reportOnly: 1, unknown: 0 },
  changes: [
    {
      key: 'home',
      nodeId: '7:1',
      nodeName: 'Home',
      classes: ['text'],
      reasons: [],
      decision: 'report-only',
      decisionReasons: [],
      target: { code: null },
      subcategories: ['text-change'],
      textChanges: [
        { nodeId: '7:9', nodeName: 'Added leaf', path: ['Home', 'Added leaf'], before: null, after: 'New' },
        { nodeId: '7:8', nodeName: 'Removed leaf', path: ['Home', 'Removed leaf'], before: 'Old', after: null },
      ],
    },
  ],
};
const partialHtml = buildViewerHtml({
  csId: 'cs-partial',
  fileKey: 'figma-file',
  classified: partialClassified,
  imageRefs: { '7:1': { before: 'images/7-1-before.png', after: 'images/7-1-after.png' } },
});
assert.match(partialHtml, /\(없음\)/, 'addition slot should show 없음');
assert.match(partialHtml, /\(삭제됨\)/, 'removal slot should show 삭제됨');

// Regression: when both baseline and snapshot are missing, fall back to the
// short legacy message (not the longer remediation hint) since there is no
// "after" to compare against either.
const noImagesHtml = buildViewerHtml({
  csId: 'cs-no-images',
  fileKey: 'figma-file',
  classified: textChangedClassified,
  imageRefs: { '81:302': { before: null, after: null } },
});
assert.match(noImagesHtml, /이전 baseline 이미지 없음/);
assert.doesNotMatch(noImagesHtml, /baseline 이미지 미등록/);

console.log('viewer-generator PASS');
