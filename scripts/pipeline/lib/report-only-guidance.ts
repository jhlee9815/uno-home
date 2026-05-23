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
    '이 변경 사항들은 자동 코드 반영에서 의도적으로 제외되었습니다. 차단 사유를 확인하고 안내된 수동 액션을 수행하세요.',
    '',
    '| Key | Node | Classes | Target | 차단 사유 | 수동 액션 | 원본 사유 |',
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
      label: '매핑 누락',
      detail: `키 '${change.key}'에 대한 매핑이 존재하지 않습니다.`,
      action: '이 노드를 `config/figma-mapping.yaml`에 추가하거나, 추적 대상 외부의 수동 변경으로 둡니다.',
    };
  }

  const deferred = change.classes.filter(cls => DEFERRED_CLASSES.has(cls));
  if (deferred.length > 0) {
    return {
      label: '미지원 분류 (deferred)',
      detail: `${deferred.join(', ')} 변경은 현재 M1-M3 자동 반영 엔진의 범위 밖입니다.`,
      action: '지금은 수동으로 처리하세요. M4 layout 자동화는 아직 deferred 상태입니다.',
    };
  }

  const compliance = change.classes.filter(cls => COMPLIANCE_CLASSES.has(cls));
  if (compliance.length > 0) {
    return {
      label: '디자인 시스템 준수 신호',
      // Section names in cs reports are Korean now ("## 🎨 디자인 시스템 미사용",
      // "## 🆕 새 화면 추가 (등록된 화면 안)", "## 🖼️ 이미지 변경"); guide reviewers
      // to look up by category label so the pointer doesn't rot if those
      // headings get further reformatted.
      detail: `${compliance.join(', ')} 감지됨. cs 리포트의 "## 변경 분류" 블록과 카테고리별 섹션(디자인 시스템 미사용 / 새 화면 추가 / 이미지 변경)을 확인하세요.`,
      action: change.target.code
        ? `Figma 노드와 \`${change.target.code}\`를 직접 검토하세요. 준수 신호는 v1 정책상 자동 패치되지 않습니다.`
        : 'Figma 노드를 직접 검토하고, 새 화면을 매핑할지 또는 변경을 수용할지 결정하세요.',
    };
  }

  if (change.target.section === 'screens' && change.target.apply === 'report-only') {
    return {
      label: '화면 정책',
      detail: '이 화면(section: screens)은 의도적으로 report-only로 설정되어 있어 자동 코드 반영 대상이 아닙니다.',
      action: change.target.code
        ? `\`${change.target.code}\`를 직접 수정하세요. 화면 텍스트/레이아웃은 마커 기반 자동 패치가 작동하지 않습니다.`
        : '매핑된 화면을 직접 수정하세요. 화면 텍스트/레이아웃은 마커 기반 자동 패치가 작동하지 않습니다.',
    };
  }

  if (change.target.apply === 'report-only') {
    return {
      label: '매핑 정책',
      detail: `매핑의 apply 모드가 report-only로 설정되어 있습니다 (${change.target.section}/${change.target.targetType}).`,
      action: change.target.code
        ? `\`${change.target.code}\`를 직접 검토하거나, 안전한 ComponentSet이 준비된 뒤 매핑을 partial/auto로 승격하세요.`
        : '직접 검토하거나, 대상이 partial/auto로 안전해진 뒤 매핑을 승격하세요.',
    };
  }

  const disallowed = change.classes.filter(cls => !change.target.allowedClasses.includes(cls));
  if (disallowed.length > 0) {
    return {
      label: '매핑이 허용하지 않는 분류',
      detail: `이 매핑의 allowedClasses에 포함되지 않은 분류입니다: ${disallowed.join(', ')}.`,
      action: '매핑된 소스를 직접 수정하거나, 위험을 검토한 뒤 allowedClasses를 확장하세요.',
    };
  }

  return {
    label: '자동화 미지원',
    detail: '현재 apply 마일스톤(M1-M3) 어느 것도 이 변경을 안전하게 패치할 수 없습니다.',
    action: 'Figma 차이를 검토하고 코드를 직접 수정하세요.',
  };
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
