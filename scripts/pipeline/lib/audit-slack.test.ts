import assert from 'node:assert/strict';
import { buildAuditSlackMessage } from './audit-slack.ts';
import type { AuditReport, RegisteredRootAudit } from './audit-aggregator.ts';

function mkRoot(over: Partial<RegisteredRootAudit> = {}): RegisteredRootAudit {
  return {
    key: over.key ?? 'root',
    nodeId: over.nodeId ?? '1:1',
    nodeName: over.nodeName ?? 'Root',
    descendantFrameCount: over.descendantFrameCount ?? 0,
    assetRefCount: over.assetRefCount ?? 0,
    detachedStyles: over.detachedStyles ?? {
      total: 0,
      byKind: { color: 0, typography: 0, effect: 0 },
      byProperty: {},
      topNodes: [],
    },
  };
}

function mkReport(over: Partial<AuditReport> = {}): AuditReport {
  return {
    generatedAt: over.generatedAt ?? '2026-05-25T00:00:00.000Z',
    fileKey: over.fileKey ?? 'file-1',
    totalDetachedStyles: over.totalDetachedStyles ?? 0,
    totalUnregisteredTopLevelFrames: over.totalUnregisteredTopLevelFrames ?? 0,
    totalRegisteredRoots: over.totalRegisteredRoots ?? 0,
    hasViolations: over.hasViolations ?? false,
    byRegisteredRoot: over.byRegisteredRoot ?? [],
    unregisteredTopLevelFrames: over.unregisteredTopLevelFrames ?? [],
    skippedRoots: over.skippedRoots ?? [],
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

run('renders all-clear shape when hasViolations is false', () => {
  const m = buildAuditSlackMessage(mkReport({ hasViolations: false }));
  assert.match(m.text, /일일 DS 컴플라이언스 audit — 2026-05-25/);
  assert.match(m.text, /위반 없음/);
  // No top-N list rendered
  assert.equal(/상위 위반 화면/.test(m.text), false);
});

run('renders total + byKind breakdown for violations', () => {
  const m = buildAuditSlackMessage(
    mkReport({
      hasViolations: true,
      totalDetachedStyles: 1295,
      totalUnregisteredTopLevelFrames: 0,
      byRegisteredRoot: [
        mkRoot({
          key: 'pesse_cards',
          nodeName: 'Phone · Cards',
          detachedStyles: {
            total: 412,
            byKind: { color: 380, typography: 28, effect: 4 },
            byProperty: {},
            topNodes: [],
          },
        }),
        mkRoot({
          key: 'pesse_home',
          nodeName: 'Phone · Home',
          detachedStyles: {
            total: 883,
            byKind: { color: 720, typography: 122, effect: 41 },
            byProperty: {},
            topNodes: [],
          },
        }),
      ],
    })
  );
  assert.match(m.text, /전체 detached style: 1295건/);
  assert.match(m.text, /색상 1100/);
  assert.match(m.text, /타이포 150/);
  assert.match(m.text, /효과 45/);
  assert.match(m.text, /미등록 top-level frame: 0건/);
});

run('renders top-N violators in descending order with explicit count line', () => {
  const roots: RegisteredRootAudit[] = [];
  for (let i = 0; i < 7; i++) {
    roots.push(
      mkRoot({
        key: `screen_${i}`,
        nodeName: `Screen ${i}`,
        detachedStyles: {
          total: 100 - i * 10,
          byKind: { color: 100 - i * 10, typography: 0, effect: 0 },
          byProperty: {},
          topNodes: [],
        },
      })
    );
  }
  const m = buildAuditSlackMessage(
    mkReport({
      hasViolations: true,
      totalDetachedStyles: roots.reduce((acc, r) => acc + r.detachedStyles.total, 0),
      byRegisteredRoot: roots,
    }),
    { topN: 5 }
  );
  // First 5 rendered
  assert.match(m.text, /1\. Screen 0 \(screen_0\): 100건/);
  assert.match(m.text, /5\. Screen 4 \(screen_4\): 60건/);
  // Item 6 not in numbered list
  assert.equal(/6\. Screen 5/.test(m.text), false);
  // 'remaining' line lists the 2 left over
  assert.match(m.text, /외 2개 화면/);
});

run('includes issueUrl and runUrl when provided', () => {
  const m = buildAuditSlackMessage(
    mkReport({
      hasViolations: true,
      totalDetachedStyles: 1,
      byRegisteredRoot: [
        mkRoot({
          key: 'r',
          nodeName: 'R',
          detachedStyles: {
            total: 1,
            byKind: { color: 1, typography: 0, effect: 0 },
            byProperty: {},
            topNodes: [],
          },
        }),
      ],
    }),
    { issueUrl: 'https://github.com/foo/bar/issues/9', runUrl: 'https://github.com/foo/bar/actions/runs/1' }
  );
  assert.match(m.text, /자세히: https:\/\/github\.com\/foo\/bar\/issues\/9/);
  assert.match(m.text, /workflow: https:\/\/github\.com\/foo\/bar\/actions\/runs\/1/);
});

run('safe with empty byRegisteredRoot but unregistered frames only', () => {
  const m = buildAuditSlackMessage(
    mkReport({
      hasViolations: true,
      totalDetachedStyles: 0,
      totalUnregisteredTopLevelFrames: 3,
      byRegisteredRoot: [],
      unregisteredTopLevelFrames: [
        { nodeId: '5:1', name: 'A' },
        { nodeId: '5:2', name: 'B' },
        { nodeId: '5:3', name: 'C' },
      ],
    })
  );
  // No top-N list (no violators)
  assert.equal(/상위 위반 화면/.test(m.text), false);
  // Kind breakdown is suppressed when total is 0
  assert.match(m.text, /전체 detached style: 0건\n/);
  assert.match(m.text, /미등록 top-level frame: 3건/);
});

run('skips zero-violation roots when ranking top-N', () => {
  const m = buildAuditSlackMessage(
    mkReport({
      hasViolations: true,
      totalDetachedStyles: 10,
      byRegisteredRoot: [
        mkRoot({
          key: 'a',
          nodeName: 'A',
          detachedStyles: {
            total: 10,
            byKind: { color: 10, typography: 0, effect: 0 },
            byProperty: {},
            topNodes: [],
          },
        }),
        mkRoot({ key: 'b', nodeName: 'B' }),
        mkRoot({ key: 'c', nodeName: 'C' }),
      ],
    })
  );
  assert.match(m.text, /1\. A \(a\): 10건/);
  assert.equal(/B \(b\)/.test(m.text), false);
  assert.equal(/외 \d+개 화면/.test(m.text), false);
});

if (failed > 0) {
  console.error(`\n${failed} audit-slack test(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll audit-slack tests passed.`);
