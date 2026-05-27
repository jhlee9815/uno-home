import assert from 'node:assert/strict';
import {
  buildLocalizedSummary,
  categoryCounts,
  affectedScreensTop,
  type SummaryInput,
  type SummaryChange,
} from './slack-summary.ts';

function mkChange(over: Partial<SummaryChange> = {}): SummaryChange {
  return {
    key: over.key,
    nodeId: over.nodeId,
    nodeName: over.nodeName,
    classes: over.classes,
    subcategories: over.subcategories,
    reasons: over.reasons,
    before: over.before,
    after: over.after,
    textChanges: over.textChanges,
    compliance: over.compliance,
  };
}

function mkInput(changes: SummaryChange[], totalsOverride?: Partial<SummaryInput['summary']>): SummaryInput {
  const total = totalsOverride?.total ?? changes.length;
  return {
    summary: {
      total,
      autoApply: totalsOverride?.autoApply ?? 0,
      reportOnly: totalsOverride?.reportOnly ?? total,
    },
    changes,
  };
}

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

// ----- T1: existing 5-bucket regression -----
run('T1 existing 5-bucket compliance regression', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:2', nodeName: 'Pesse Apple-inspired',
      classes: ['detached-style', 'new-frame', 'image-change'],
      subcategories: ['detached-style', 'new-frame', 'image-change'],
      compliance: {
        newDetachedStyles: new Array(1083).fill({}),
        newFrames: new Array(2).fill({}),
        changedImageRefs: new Array(5).fill({}),
      },
    }),
  ], { total: 1090, reportOnly: 1090 });
  const c = categoryCounts(input);
  assert.equal(c.compliance['detached-style'], 1083);
  assert.equal(c.compliance['new-frame'], 2);
  assert.equal(c.compliance['image-change'], 5);
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /🎨 디자인 시스템 미사용: 1083건 \(상세는 viewer 참조\)/);
  assert.match(lines[1], /🆕 새 화면 추가: 2건/);
  assert.match(lines[2], /🖼️ 이미지 변경: 5건/);
  assert.match(lines[3], /전체: 1090건/);
});

// ----- T2: raw class only (cs-2026-05-25T11-44-34 reproduction) -----
run('T2 raw class only — structure + token + layout', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:3', nodeName: 'Phone · Home',
      classes: ['structure', 'structure', 'structure', 'token', 'token', 'layout'],
      reasons: [
        "Node 'A' missing from base snapshot",
        "Node 'B' missing from head snapshot",
        "Node 'C' missing from base snapshot",
      ],
    }),
    mkChange({
      nodeId: '7:4', nodeName: 'Phone · Cards',
      classes: ['structure', 'structure', 'token'],
      reasons: [
        "Node 'D' missing from base snapshot",
        "Node 'E' missing from base snapshot",
      ],
    }),
  ], { total: 9, reportOnly: 9 });
  const c = categoryCounts(input);
  assert.equal(c.raw.structure, 5);
  assert.equal(c.raw.token, 3);
  assert.equal(c.raw.layout, 1);
  assert.equal(c.structureSubKinds.added, 4);
  assert.equal(c.structureSubKinds.removed, 1);
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /🧱 구조 변경: 5건 \(추가 4·삭제 1\)/);
  assert.match(lines[1], /🎨 디자인 토큰 변경: 3건/);
  assert.match(lines[2], /📐 레이아웃 변경: 1건/);
});

// ----- T3: mixed compliance + raw -----
run('T3 mixed compliance + raw classes', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:2', nodeName: 'Pesse',
      classes: ['detached-style', 'structure'],
      compliance: { newDetachedStyles: new Array(5).fill({}) },
      reasons: ["Node 'X' missing from base snapshot"],
    }),
    mkChange({ nodeId: '7:3', nodeName: 'Home', classes: ['structure'], reasons: ["Node 'Y' missing from base snapshot"] }),
    mkChange({ nodeId: '7:4', nodeName: 'Cards', classes: ['token'] }),
  ], { total: 8, reportOnly: 8 });
  const c = categoryCounts(input);
  assert.equal(c.compliance['detached-style'], 5);
  assert.equal(c.raw.structure, 2);
  assert.equal(c.raw.token, 1);
  // detached-style and other compliance buckets must NOT leak into raw
  assert.equal((c.raw as Record<string, number>)['detached-style'], undefined);
});

// ----- T4: cap "(상세는 viewer 참조)" -----
run('T4 detail hint above threshold', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:2', nodeName: 'Pesse',
      classes: ['detached-style'], subcategories: ['detached-style'],
      compliance: { newDetachedStyles: new Array(1083).fill({}) },
    }),
  ], { total: 1083, reportOnly: 1083 });
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /1083건 \(상세는 viewer 참조\)/);
});

// ----- T5: top-N tie-break by displayName asc -----
run('T5 top-3 ties resolved by displayName asc', () => {
  const input = mkInput([
    mkChange({ nodeId: 'a', nodeName: 'Zeta', classes: ['structure'] }),
    mkChange({ nodeId: 'b', nodeName: 'Alpha', classes: ['structure'] }),
    mkChange({ nodeId: 'c', nodeName: 'Mango', classes: ['structure'] }),
  ], { total: 3, reportOnly: 3 });
  const top = affectedScreensTop(input, 3);
  assert.deepEqual(top.map(t => t.displayName), ['Alpha', 'Mango', 'Zeta']);
});

// ----- T6: same nodeName different nodeId stays separate -----
run('T6 same nodeName different nodeId stays separate', () => {
  const input = mkInput([
    mkChange({ nodeId: '1:1', nodeName: 'Home', classes: ['structure'] }),
    mkChange({ nodeId: '2:2', nodeName: 'Home', classes: ['structure', 'token'] }),
  ], { total: 2, reportOnly: 2 });
  const top = affectedScreensTop(input, 5);
  assert.equal(top.length, 2);
  // 2:2 has weight 2, 1:1 has weight 1
  assert.equal(top[0].key, '2:2');
  assert.equal(top[0].weight, 2);
  assert.equal(top[1].key, '1:1');
  assert.equal(top[1].weight, 1);
});

// ----- T7: structure added/removed sub-kind -----
run('T7 structure sub-kind from reasons', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:2', nodeName: 'Pesse', classes: ['structure'],
      reasons: [
        "Node 'A' missing from base snapshot",
        "Node 'B' missing from base snapshot",
        "Node 'C' missing from base snapshot",
        "Node 'D' missing from head snapshot",
        "Node 'E' missing from head snapshot",
      ],
    }),
  ], { total: 5, reportOnly: 5 });
  const c = categoryCounts(input);
  assert.equal(c.structureSubKinds.added, 3);
  assert.equal(c.structureSubKinds.removed, 2);
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /구조 변경: 1건 \(추가 3·삭제 2\)/);
});

// ----- T8: structure boundingBox toggle — direction unknown -----
run('T8 structure toggle without before/after → 표시토글', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:2', nodeName: 'Pesse', classes: ['structure'],
      reasons: ["Node X boundingBox changed to or from null"],
    }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.structureSubKinds.toggle, 1);
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /구조 변경: 1건 \(표시토글 1\)/);
});

// ----- T8a: bbox toggle reason + before-present after-null → 삭제 -----
run('T8a structure toggle with before bbox + after null → 삭제', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:3', nodeName: 'Phone · Home', classes: ['structure'],
      reasons: ["Node 7:3 boundingBox changed to or from null"],
      before: { boundingBox: { x: 0, y: 0, width: 390, height: 780 } },
      after: { boundingBox: null },
    }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.structureSubKinds.removed, 1);
  assert.equal(c.structureSubKinds.toggle, 0);
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /구조 변경: 1건 \(삭제 1\)/);
});

// ----- T8b: bbox toggle reason + before-null after-present → 추가 -----
run('T8b structure toggle with before null + after bbox → 추가', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:9', nodeName: 'New Screen', classes: ['structure'],
      reasons: ["Node 7:9 boundingBox changed to or from null"],
      before: { boundingBox: null },
      after: { boundingBox: { x: 0, y: 0, width: 390, height: 780 } },
    }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.structureSubKinds.added, 1);
  assert.equal(c.structureSubKinds.toggle, 0);
  const lines = buildLocalizedSummary(input);
  assert.match(lines[0], /구조 변경: 1건 \(추가 1\)/);
});

// ----- T8c: cs-2026-05-26T05-59-50 regression — 10 deletions in one cs -----
run('T8c real-world: 10 screens vanish via bbox null → 삭제 10', () => {
  const changes: SummaryChange[] = [];
  for (let i = 0; i < 10; i++) {
    changes.push(mkChange({
      nodeId: `n:${i}`, nodeName: `Screen ${i}`,
      classes: ['text', 'component-props', 'asset', 'structure'],
      subcategories: ['text-change', 'props-change'],
      reasons: [
        'textHash changed',
        'componentPropsHash changed',
        'propsHash changed',
        'boundingBox changed to or from null',
      ],
      before: { boundingBox: { x: 0, y: 0, width: 390, height: 780 } },
      after: { boundingBox: null },
    }));
  }
  const input = mkInput(changes, { total: 10, reportOnly: 10 });
  const c = categoryCounts(input);
  assert.equal(c.structureSubKinds.removed, 10);
  assert.equal(c.structureSubKinds.added, 0);
  assert.equal(c.structureSubKinds.toggle, 0);
});

// ----- T9: legacy classes only — token -----
run('T9 legacy classes=[token] only', () => {
  const input = mkInput([
    mkChange({ nodeId: 'a', nodeName: 'A', classes: ['token'] }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.raw.token, 1);
  assert.equal(Object.keys(c.compliance).length, 0);
});

// ----- T10: legacy mixed text + layout -----
run('T10 legacy classes=[text,layout]', () => {
  const input = mkInput([
    mkChange({ nodeId: 'a', nodeName: 'A', classes: ['text', 'layout'] }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.compliance['text-change'], 1);
  assert.equal(c.raw.layout, 1);
});

// ----- T11: legacy detached+structure with no compliance -----
run('T11 legacy classes=[detached-style,structure] no compliance', () => {
  const input = mkInput([
    mkChange({ nodeId: 'a', nodeName: 'A', classes: ['detached-style', 'structure'] }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.compliance['detached-style'], 1);
  assert.equal(c.raw.structure, 1);
});

// ----- T12: subcategories+raw mixed (compliance bucket count from array) -----
run('T12 subcategories ∋ detached-style + raw structure', () => {
  const input = mkInput([
    mkChange({
      nodeId: 'a', nodeName: 'A',
      classes: ['detached-style', 'structure'],
      subcategories: ['detached-style'],
      compliance: { newDetachedStyles: new Array(2).fill({}) },
    }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(c.compliance['detached-style'], 2);
  assert.equal(c.raw.structure, 1);
  // raw must not double-count detached-style
  assert.equal(c.raw['structure'], 1);
});

// ----- T13: empty changes — no top-3 line -----
run('T13 empty changes — no top-N line, total only', () => {
  const input = mkInput([], { total: 0, reportOnly: 0 });
  const lines = buildLocalizedSummary(input);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /전체: 0건/);
});

// ----- T14: unknown class — skipped from raw -----
run('T14 unknown class not counted', () => {
  const input = mkInput([
    mkChange({ nodeId: 'a', nodeName: 'A', classes: ['mystery-class'] }),
  ], { total: 1, reportOnly: 1 });
  const c = categoryCounts(input);
  assert.equal(Object.keys(c.raw).length, 0);
  assert.equal(Object.keys(c.compliance).length, 0);
});

// ----- T15: Slack cap (3500자) — truncation marker appended -----
run('T15 Slack maxChars=3500 truncates and appends marker', () => {
  // Build many changes to overflow
  const changes: SummaryChange[] = [];
  for (let i = 0; i < 100; i++) {
    changes.push(mkChange({
      nodeId: `n:${i}`, nodeName: `Screen ${i}`,
      classes: ['structure'], reasons: [`Node '${i}' missing from base snapshot`],
    }));
  }
  const input = mkInput(changes, { total: 100, reportOnly: 100 });
  const lines = buildLocalizedSummary(input, { maxChars: 200 });
  const joined = lines.join('\n');
  assert.ok(joined.length <= 200, `joined length ${joined.length} > 200`);
  assert.ok(lines.some(l => l.includes('(상세는 viewer 참조)')), 'truncation marker missing');
  // total line must survive
  assert.ok(lines.some(l => l.startsWith('• 전체:')), '전체 line dropped');
});

// ----- T16: Discord cap (1800자) -----
run('T16 Discord maxChars=1800 truncates', () => {
  const changes: SummaryChange[] = [];
  for (let i = 0; i < 100; i++) {
    changes.push(mkChange({
      nodeId: `n:${i}`, nodeName: `Screen ${i}`,
      classes: ['layout'],
    }));
  }
  const input = mkInput(changes, { total: 100, reportOnly: 100 });
  const lines = buildLocalizedSummary(input, { maxChars: 150 });
  const joined = lines.join('\n');
  assert.ok(joined.length <= 150);
  assert.ok(lines.some(l => l.startsWith('• 전체:')));
});

// ----- T17: viewer/repo line not in cap scope (cap is summary-only) -----
run('T17 cap applies only to summary lines (caller appends viewer/repo)', () => {
  // The summary function never produces viewer/repo lines — caller responsibility.
  const input = mkInput([
    mkChange({ nodeId: 'a', nodeName: 'A', classes: ['structure'] }),
  ], { total: 1, reportOnly: 1 });
  const lines = buildLocalizedSummary(input, { maxChars: 1000 });
  assert.equal(lines.some(l => l.includes('viewer:')), false);
  assert.equal(lines.some(l => l.includes('repo:')), false);
});

// ----- T18: deterministic ordering — compliance → raw → total → top-N -----
run('T18 deterministic line ordering', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:2', nodeName: 'Pesse',
      classes: ['detached-style', 'new-frame', 'image-change', 'structure', 'token', 'layout', 'asset'],
      compliance: {
        newDetachedStyles: [{}],
        newFrames: [{}],
        changedImageRefs: [{}],
      },
    }),
  ], { total: 7, reportOnly: 7 });
  const lines = buildLocalizedSummary(input);
  // Expected order: detached-style, new-frame, image-change, (text-change, props-change skipped — 0),
  // then raw: structure, token, layout, asset, then 전체, then top-3
  const labels = lines.map(l => l.replace(/^• /, '').split(':')[0]);
  assert.deepEqual(labels, [
    '🎨 디자인 시스템 미사용',
    '🆕 새 화면 추가',
    '🖼️ 이미지 변경',
    '🧱 구조 변경',
    '🎨 디자인 토큰 변경',
    '📐 레이아웃 변경',
    '📦 에셋 변경',
    '전체',
    '영향 화면 top-3',
  ]);
});

// ----- T19: truncation drop order — affected-screen line drops first -----
run('T19 truncation drops affected-screen line first, preserves total', () => {
  // Build input where the affected-screen line is much longer than the
  // raw/compliance lines, so dropping it alone is enough to fit the cap.
  const longName = 'X'.repeat(200);
  const input = mkInput([
    mkChange({
      nodeId: 'a', nodeName: longName,
      classes: ['detached-style', 'structure'],
      subcategories: ['detached-style'],
      compliance: { newDetachedStyles: [{}] },
    }),
  ], { total: 1, reportOnly: 1 });
  const full = buildLocalizedSummary(input);
  const fullLen = full.join('\n').length;
  // Cap = fullLen - 1 forces *some* truncation. The 영향 화면 line is the
  // longest by far, so dropping it (and appending the marker) should yield
  // a result that still fits cap.
  const cap = fullLen - 1;
  const capped = buildLocalizedSummary(input, { maxChars: cap });
  assert.equal(capped.some(l => l.startsWith('• 영향 화면 top-')), false, 'top-N dropped first');
  assert.ok(capped.some(l => l.startsWith('• 전체:')), 'total line preserved');
  assert.equal(capped[capped.length - 1], '• … (상세는 viewer 참조)', 'truncation marker is last');
});

// ----- T-sample: text-change line surfaces first leaf sample -----
run('T-sample text-change shows first leaf inline + remaining count', () => {
  const input = mkInput([
    mkChange({
      nodeId: '81:302', nodeName: 'Phone · Home — Balance',
      classes: ['text'], subcategories: ['text-change'],
      textChanges: [
        { nodeId: '81:303', nodeName: 'Balance', before: '$25,521,098.31', after: '$23,521,098.31' },
        { nodeId: '81:304', nodeName: 'Greeting', before: 'Pessse', after: 'Pesse' },
        { nodeId: '81:305', nodeName: 'Subtitle', before: 'Hello', after: 'Hi' },
      ],
    }),
  ], { total: 1, reportOnly: 1 });
  const lines = buildLocalizedSummary(input);
  const textLine = lines.find(l => l.includes('텍스트 변경'));
  assert.ok(textLine, 'expected a text-change line');
  // Count must reflect total leaf changes, not change-count
  assert.match(textLine, /3건/);
  // Sample must include first leaf nodeName + before → after
  assert.match(textLine, /Balance/);
  assert.match(textLine, /\$25,521,098\.31/);
  assert.match(textLine, /\$23,521,098\.31/);
  // Remaining-count tail when more than one leaf
  assert.match(textLine, /\+2건/);
});

run('T-sample text-change with only one leaf hides +N suffix', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:1', nodeName: 'Home',
      classes: ['text'], subcategories: ['text-change'],
      textChanges: [{ nodeId: '7:2', nodeName: 'Title', before: 'Hello', after: 'Hi' }],
    }),
  ], { total: 1, reportOnly: 1 });
  const lines = buildLocalizedSummary(input);
  const textLine = lines.find(l => l.includes('텍스트 변경'));
  assert.ok(textLine);
  assert.match(textLine, /1건/);
  assert.match(textLine, /Title/);
  assert.doesNotMatch(textLine, /\+\d+건/);
});

run('T-sample text-change long value truncates so the line stays Slack-readable', () => {
  const longBefore = 'A'.repeat(200);
  const longAfter = 'B'.repeat(200);
  const input = mkInput([
    mkChange({
      nodeId: '7:1', nodeName: 'Home',
      classes: ['text'], subcategories: ['text-change'],
      textChanges: [{ nodeId: '7:2', nodeName: 'Long', before: longBefore, after: longAfter }],
    }),
  ], { total: 1, reportOnly: 1 });
  const lines = buildLocalizedSummary(input);
  const textLine = lines.find(l => l.includes('텍스트 변경'));
  assert.ok(textLine);
  assert.ok(textLine.length < 200, `expected truncation, got len=${textLine.length}`);
  assert.match(textLine, /…/);
});

run('T-sample text-change suppresses sample when count >= detailHintThreshold', () => {
  // Hitting the threshold means "(상세는 viewer 참조)" — sample becomes redundant
  // and would just inflate the line, so we drop it.
  const many: SummaryChange[] = [];
  for (let i = 0; i < 60; i++) {
    many.push(mkChange({
      nodeId: `7:${i}`, nodeName: `Node${i}`,
      classes: ['text'], subcategories: ['text-change'],
      textChanges: [{ nodeId: `7:${i}:1`, nodeName: `Leaf${i}`, before: 'old', after: 'new' }],
    }));
  }
  const input = mkInput(many, { total: 60, reportOnly: 60 });
  const lines = buildLocalizedSummary(input);
  const textLine = lines.find(l => l.includes('텍스트 변경'));
  assert.ok(textLine);
  assert.match(textLine, /상세는 viewer 참조/);
  assert.doesNotMatch(textLine, /Leaf0\b/);
});

run('T-sample detached-style shows nodeName + property + value sample', () => {
  const input = mkInput([
    mkChange({
      nodeId: '7:1', nodeName: 'Home',
      classes: ['detached-style'], subcategories: ['detached-style'],
      compliance: {
        newDetachedStyles: [
          {
            nodeId: '7:101', nodeName: 'Balance text', nodePath: ['Home', 'Balance text'],
            kind: 'color', property: 'fill',
            rawValue: { r: 1, g: 0.2, b: 0.4, a: 1 },
            suggestedToken: null, evidence: { hasNodeBoundVariables: false, styleId: null },
          },
          {
            nodeId: '7:102', nodeName: 'Subtitle', nodePath: ['Home', 'Subtitle'],
            kind: 'typography', property: 'fontSize',
            rawValue: 15,
            suggestedToken: null, evidence: { hasNodeBoundVariables: false, styleId: null },
          },
        ],
      },
    }),
  ], { total: 1, reportOnly: 1 });
  const lines = buildLocalizedSummary(input);
  const line = lines.find(l => l.includes('디자인 시스템 미사용'));
  assert.ok(line);
  assert.match(line, /2건/);
  assert.match(line, /Balance text/);
  assert.match(line, /#FF3366/);
  assert.match(line, /\+1건/);
});

// ----- result -----
if (failed > 0) {
  console.error(`\n${failed} test case(s) failed`);
  process.exit(1);
}
console.log('\nall slack-summary tests passed');
