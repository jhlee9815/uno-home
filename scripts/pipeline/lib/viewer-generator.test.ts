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

console.log('viewer-generator PASS');
