import type { FigmaMapping, MappingEntry } from './config-loader.ts';
import type { ChangeClass, DiffChange, DiffFile } from './diff-snapshot.ts';
import type { ComplianceSubcategory } from './compliance-types.ts';

export type Decision = 'auto-apply' | 'report-only';

interface TargetMetadata {
  section: 'tokens' | 'components' | 'compositions' | 'screens' | 'unknown';
  apply: string;
  allowedClasses: ChangeClass[];
  code: string | null;
  targetType: string;
}

export interface ClassifiedChange extends DiffChange {
  decision: Decision;
  decisionReasons: string[];
  target: TargetMetadata;
  subcategories: ComplianceSubcategory[];
}

export interface ClassifiedDiffFile extends Omit<DiffFile, 'stage' | 'changes'> {
  stage: 'classified';
  sourceStage: 'diff';
  summary: {
    total: number;
    autoApply: number;
    reportOnly: number;
    unknown: number;
  };
  changes: ClassifiedChange[];
}

const MANUAL_ONLY_CLASSES = new Set<ChangeClass>([
  'asset',
  'layout',
  'structure',
  'unknown',
  'detached-style',
  'new-frame',
  'image-change',
]);
const AUTO_SUPPORTED_CLASSES = new Set<ChangeClass>(['token', 'text', 'component-props']);

const CLASS_TO_SUBCATEGORY: Partial<Record<ChangeClass, ComplianceSubcategory>> = {
  text: 'text-change',
  'component-props': 'props-change',
  'image-change': 'image-change',
  'detached-style': 'detached-style',
  'new-frame': 'new-frame',
};

function deriveSubcategories(classes: ChangeClass[]): ComplianceSubcategory[] {
  const seen = new Set<ComplianceSubcategory>();
  const out: ComplianceSubcategory[] = [];
  for (const cls of classes) {
    const sub = CLASS_TO_SUBCATEGORY[cls];
    if (sub !== undefined && !seen.has(sub)) {
      seen.add(sub);
      out.push(sub);
    }
  }
  return out;
}

export function classifyDiff(diff: DiffFile, mapping: FigmaMapping): ClassifiedDiffFile {
  const targetMap = buildTargetMap(mapping);
  const changes = diff.changes.map(change => classifyChange(change, targetMap));

  return {
    ...diff,
    stage: 'classified',
    sourceStage: 'diff',
    summary: {
      total: changes.length,
      autoApply: changes.filter(change => change.decision === 'auto-apply').length,
      reportOnly: changes.filter(change => change.decision === 'report-only').length,
      unknown: changes.filter(change => change.target.section === 'unknown').length,
    },
    changes,
  };
}

function classifyChange(
  change: DiffChange,
  targetMap: Map<string, TargetMetadata>
): ClassifiedChange {
  const target = targetMap.get(change.key);
  if (!target) {
    const classes: ChangeClass[] = ['unknown', ...change.classes.filter(cls => cls !== 'unknown')];
    return {
      ...change,
      classes,
      decision: 'report-only',
      decisionReasons: [`키 '${change.key}'에 매핑된 대상이 없습니다`],
      target: {
        section: 'unknown',
        apply: 'report-only',
        allowedClasses: [],
        code: null,
        targetType: 'unknown',
      },
      subcategories: deriveSubcategories(classes),
    };
  }

  const decisionReasons: string[] = [];

  if (target.apply === 'report-only') {
    decisionReasons.push(`매핑의 apply 모드가 report-only로 설정되어 있어 자동 코드 반영 대상이 아닙니다`);
  }

  const manualOnly = change.classes.filter(cls => MANUAL_ONLY_CLASSES.has(cls));
  if (manualOnly.length > 0) {
    decisionReasons.push(`Phase 5 자동 반영 엔진(M1-M3)으로는 처리할 수 없는 분류라 수동 처리가 필요합니다: ${manualOnly.join(', ')}`);
  }

  const disallowed = change.classes.filter(cls => !target.allowedClasses.includes(cls));
  if (disallowed.length > 0) {
    decisionReasons.push(`이 매핑의 allowedClasses에 포함되지 않은 분류라 자동 반영이 차단됩니다: ${disallowed.join(', ')}`);
  }

  const unsupported = change.classes.filter(cls => !AUTO_SUPPORTED_CLASSES.has(cls));
  if (unsupported.length > 0 && manualOnly.length === 0) {
    decisionReasons.push(`자동 반영을 아직 지원하지 않는 분류입니다: ${unsupported.join(', ')}`);
  }

  const canAutoApply =
    decisionReasons.length === 0 &&
    (target.apply === 'auto' || target.apply === 'partial') &&
    change.classes.every(cls => target.allowedClasses.includes(cls));

  return {
    ...change,
    decision: canAutoApply ? 'auto-apply' : 'report-only',
    decisionReasons: canAutoApply ? ['매핑이 변경된 모든 분류를 허용해 자동 반영 대상입니다'] : decisionReasons,
    target,
    subcategories: deriveSubcategories(change.classes),
  };
}

function buildTargetMap(mapping: FigmaMapping): Map<string, TargetMetadata> {
  const targets = new Map<string, TargetMetadata>();

  targets.set('tokens', {
    section: 'tokens',
    apply: mapping.tokens.automation.apply,
    allowedClasses: mapping.tokens.automation.classes as ChangeClass[],
    code: mapping.tokens.output.css,
    targetType: 'tokens',
  });

  addEntries(targets, 'components', mapping.components);
  addEntries(targets, 'compositions', mapping.compositions);
  addEntries(targets, 'screens', mapping.screens);

  return targets;
}

function addEntries(
  targets: Map<string, TargetMetadata>,
  section: 'components' | 'compositions' | 'screens',
  entries: Record<string, MappingEntry>
): void {
  for (const [key, entry] of Object.entries(entries)) {
    targets.set(key, {
      section,
      apply: entry.automation.apply,
      allowedClasses: (entry.automation.allowedClasses ?? []) as ChangeClass[],
      code: entry.code,
      targetType: entry.targetType,
    });
  }
}
