// Pure formatter for the daily figma-audit Slack notification. Reads an
// AuditReport (the same JSON the audit-aggregator emits) and emits the
// Slack payload body. No network or filesystem access — keeps it trivially
// testable.
//
// Companion entrypoint: scripts/pipeline/audit-notify.ts.

import type { AuditReport } from './audit-aggregator.ts';
import { DETACHED_STYLE_KIND_LABEL_KO } from './category-labels.ts';

export interface BuildAuditSlackMessageOptions {
  issueUrl?: string;
  runUrl?: string;
  topN?: number;
}

export interface AuditSlackMessage {
  text: string;
}

const DEFAULT_TOP_N = 5;

export function buildAuditSlackMessage(
  report: AuditReport,
  opts: BuildAuditSlackMessageOptions = {}
): AuditSlackMessage {
  const date = report.generatedAt.slice(0, 10);
  const topN = opts.topN ?? DEFAULT_TOP_N;

  // Caller (audit-notify.ts) should also branch on report.hasViolations and
  // suppress the call entirely, but emit a safe message body even when called
  // with no violations so tests can assert the all-clear shape if we ever
  // flip the policy.
  if (!report.hasViolations) {
    return {
      text: `🎨 일일 DS 컴플라이언스 audit — ${date}\n• 위반 없음 (detached 0건 · 미등록 frame 0건)`,
    };
  }

  const lines: string[] = [];
  lines.push(`🎨 일일 DS 컴플라이언스 audit — ${date}`);
  lines.push(`• 기준: 일일 전체 audit (delta 아님)`);

  const k = report.byRegisteredRoot.reduce(
    (acc, root) => {
      acc.color += root.detachedStyles.byKind.color;
      acc.typography += root.detachedStyles.byKind.typography;
      acc.effect += root.detachedStyles.byKind.effect;
      return acc;
    },
    { color: 0, typography: 0, effect: 0 }
  );
  const kindParts: string[] = [];
  if (k.color > 0) kindParts.push(`${DETACHED_STYLE_KIND_LABEL_KO.color} ${k.color}`);
  if (k.typography > 0) kindParts.push(`${DETACHED_STYLE_KIND_LABEL_KO.typography} ${k.typography}`);
  if (k.effect > 0) kindParts.push(`${DETACHED_STYLE_KIND_LABEL_KO.effect} ${k.effect}`);
  const kindSuffix = kindParts.length > 0 ? ` (${kindParts.join('·')})` : '';
  lines.push(`• 전체 detached style: ${report.totalDetachedStyles}건${kindSuffix}`);
  lines.push(`• 미등록 top-level frame: ${report.totalUnregisteredTopLevelFrames}건`);

  const violators = report.byRegisteredRoot
    .filter(root => root.detachedStyles.total > 0)
    .slice(0, topN);
  if (violators.length > 0) {
    lines.push(`• 상위 위반 화면 top-${violators.length}:`);
    violators.forEach((root, i) => {
      lines.push(`  ${i + 1}. ${root.nodeName} (${root.key}): ${root.detachedStyles.total}건`);
    });
    const remaining = report.byRegisteredRoot.filter(r => r.detachedStyles.total > 0).length - violators.length;
    if (remaining > 0) {
      lines.push(`  · 외 ${remaining}개 화면`);
    }
  }

  if (opts.issueUrl) lines.push(`• 자세히: ${opts.issueUrl}`);
  if (opts.runUrl) lines.push(`• workflow: ${opts.runUrl}`);

  return { text: lines.join('\n') };
}
