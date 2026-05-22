import type { ClassifiedChange, ClassifiedDiffFile } from './classify-diff.ts';

interface Guidance {
  label: string;
  detail: string;
  action: string;
}

const DEFERRED_CLASSES = new Set(['asset', 'layout', 'structure', 'unknown']);
const COMPLIANCE_CLASSES = new Set(['detached-style', 'new-frame', 'image-change']);

export function renderReportOnlyMarkdown(
  classified: ClassifiedDiffFile,
  reportOnly: ClassifiedChange[],
  generatedAt = new Date().toISOString()
): string {
  const lines = [
    '# Figma Diff Report-Only Items',
    '',
    `Generated: \`${generatedAt}\``,
    `Diff generated: \`${classified.generatedAt}\``,
    `Comparison: \`${classified.comparisonMode}\``,
    `Base: \`${classified.baseTs}\``,
    `Head: \`${classified.headTs}\``,
    '',
    'These changes are intentionally blocked from automatic code edits. Review the reason and take the listed manual action.',
    '',
    '| Key | Node | Classes | Target | Why blocked | Manual action | Raw reasons |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const change of reportOnly) {
    const guidance = describeReportOnlyChange(change);
    lines.push(
      [
        change.key,
        `${change.nodeName}${change.nodeId ? ` (${change.nodeId})` : ''}`,
        change.classes.join(', '),
        `${change.target.section}/${change.target.apply}`,
        `${guidance.label}: ${guidance.detail}`,
        guidance.action,
        [...change.decisionReasons, ...change.reasons].join('<br>'),
      ]
        .map(escapeTableCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function describeReportOnlyChange(change: ClassifiedChange): Guidance {
  if (change.target.section === 'unknown') {
    return {
      label: 'Unmapped target',
      detail: `No mapping exists for key '${change.key}'.`,
      action: 'Add this node to `config/figma-mapping.yaml` or leave it as an out-of-scope manual change.',
    };
  }

  const deferred = change.classes.filter(cls => DEFERRED_CLASSES.has(cls));
  if (deferred.length > 0) {
    return {
      label: 'Deferred class',
      detail: `${deferred.join(', ')} changes are outside the current M1-M3 apply engine.`,
      action: 'Handle manually for now. M4 layout automation is deferred.',
    };
  }

  const compliance = change.classes.filter(cls => COMPLIANCE_CLASSES.has(cls));
  if (compliance.length > 0) {
    return {
      label: 'Compliance signal',
      // Section names in cs reports are Korean now ("## 🎨 디자인 시스템 미사용",
      // "## 🆕 새 화면 추가 (등록된 화면 안)", "## 🖼️ 이미지 변경"); guide reviewers
      // to look up by category label so the pointer doesn't rot if those
      // headings get further reformatted.
      detail: `${compliance.join(', ')} detected. cs 리포트의 "## 변경 분류" 블록과 카테고리별 섹션(디자인 시스템 미사용 / 새 화면 추가 / 이미지 변경)을 확인하세요.`,
      action: change.target.code
        ? `Review Figma node + \`${change.target.code}\` manually. Compliance signals never auto-patch (v1 policy).`
        : 'Review Figma node manually and decide whether to map/add a new screen or accept the change.',
    };
  }

  if (change.target.section === 'screens' && change.target.apply === 'report-only') {
    return {
      label: 'Screen policy',
      detail: 'screens are intentionally report-only.',
      action: change.target.code
        ? `Edit \`${change.target.code}\` manually; screen text and layout are not patched by markers.`
        : 'Edit the mapped screen manually; screen text and layout are not patched by markers.',
    };
  }

  if (change.target.apply === 'report-only') {
    return {
      label: 'Mapping policy',
      detail: `Mapping apply mode is report-only for ${change.target.section}/${change.target.targetType}.`,
      action: change.target.code
        ? `Review \`${change.target.code}\` manually or promote this mapping after a safe ComponentSet exists.`
        : 'Review manually or promote this mapping after the target is safe for partial apply.',
    };
  }

  const disallowed = change.classes.filter(cls => !change.target.allowedClasses.includes(cls));
  if (disallowed.length > 0) {
    return {
      label: 'Mapping class not allowed',
      detail: `${disallowed.join(', ')} is not allowed by this mapping.`,
      action: 'Update the mapped source manually or expand allowedClasses after reviewing the risk.',
    };
  }

  return {
    label: 'Unsupported automation',
    detail: 'No current apply milestone can safely patch this change.',
    action: 'Review the Figma diff and update code manually.',
  };
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
