// Pure formatter for the figma-pipeline Slack/Discord change-set summary.
//
// Splits compliance bucket counts (text-change / props-change / image-change
// / detached-style / new-frame) from raw unbucketed class counts (structure
// / token / layout / asset) so designers see WHAT changed even when the
// classified diff produced only low-level raw signals.
//
// Also computes affected-screen top-N by finding-weight (compliance findings
// + raw unbucketed classes + legacy text/props), aggregated by nodeId so two
// changes that happen to share a name don't merge.
//
// Channel-specific cap (Slack 4000, Discord 2000) is applied by the caller
// via `maxChars`; this module enforces the cap by dropping lines from the
// END of the joined output first (affected-screen line, then raw / compliance
// lines in reverse order), always preserving the `• 전체:` total line, then
// appending a single `• … (상세는 viewer 참조)` marker so the cap is
// deterministic across channels.

import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL_KO,
  RAW_CLASS_EMOJI,
  RAW_CLASS_LABEL_KO,
  isUnbucketedRawClass,
} from './category-labels.ts';
import type { ComplianceSubcategory } from './compliance-types.ts';

// ----- input shape -----

export interface SummaryChange {
  key?: string;
  nodeId?: string;
  nodeName?: string;
  classes?: string[];
  subcategories?: string[];
  reasons?: string[];
  // boundingBox states from diff-snapshot. Used to disambiguate the
  // "boundingBox changed to or from null" structure reason — when before
  // had a bbox and after is null, the node has effectively been removed
  // (Figma API returned the registered node with an empty render), so we
  // label it 삭제 rather than the vague 표시토글.
  before?: { boundingBox?: unknown };
  after?: { boundingBox?: unknown };
  // Leaf-level text changes produced by diff-snapshot when both base and
  // head carry the new `texts[]` field. Slack uses the first leaf as a
  // human-readable sample so designers can glance at the alert and decide
  // whether to open the viewer.
  textChanges?: Array<{ nodeId?: string; nodeName?: string; before: string | null; after: string | null }>;
  // Kept as `unknown[]` so callers (e.g. post-run-actions.ts) can pass the
  // raw JSON.parse output without a shape-compatible cast. Narrowing happens
  // inside the sample-extraction helpers below.
  compliance?: {
    newDetachedStyles?: unknown[];
    newFrames?: unknown[];
    changedImageRefs?: unknown[];
  };
}

export interface SummaryInput {
  summary: { total: number; autoApply: number; reportOnly: number };
  changes: SummaryChange[];
}

// ----- counts -----

export interface CategoryBreakdown {
  compliance: Partial<Record<ComplianceSubcategory, number>>;
  raw: Partial<Record<'token' | 'structure' | 'layout' | 'asset', number>>;
  structureSubKinds: { added: number; removed: number; toggle: number };
}

// Deterministic display order — designers should see the same line order
// regardless of insertion order in the underlying maps.
const COMPLIANCE_ORDER: ComplianceSubcategory[] = [
  'detached-style',
  'new-frame',
  'image-change',
  'text-change',
  'props-change',
];

const RAW_ORDER: readonly ('structure' | 'token' | 'layout' | 'asset')[] = [
  'structure',
  'token',
  'layout',
  'asset',
];

// Anchored patterns matching the actual `reasons` strings emitted by
// diff-snapshot.ts. Substring matching on "added"/"removed" would collide
// with compliance reasons like "X new detached style(s)" or future copy.
const STRUCTURE_ADDED_RE = /missing from base snapshot/;
const STRUCTURE_REMOVED_RE = /missing from head snapshot/;
const STRUCTURE_TOGGLE_RE = /boundingBox changed to or from null/;

export function categoryCounts(input: SummaryInput): CategoryBreakdown {
  const out: CategoryBreakdown = {
    compliance: {},
    raw: {},
    structureSubKinds: { added: 0, removed: 0, toggle: 0 },
  };

  for (const change of input.changes) {
    // 1. Compliance arrays — accurate per-finding counts.
    if (change.compliance) {
      const det = change.compliance.newDetachedStyles?.length ?? 0;
      const nf = change.compliance.newFrames?.length ?? 0;
      const im = change.compliance.changedImageRefs?.length ?? 0;
      if (det) out.compliance['detached-style'] = (out.compliance['detached-style'] ?? 0) + det;
      if (nf) out.compliance['new-frame'] = (out.compliance['new-frame'] ?? 0) + nf;
      if (im) out.compliance['image-change'] = (out.compliance['image-change'] ?? 0) + im;
    }

    // 2. Tag-level count for text-change / props-change which have no
    //    compliance.* array, and for legacy classified diffs missing the
    //    compliance block entirely.
    const tags = change.subcategories && change.subcategories.length > 0
      ? change.subcategories
      : (change.classes ?? []);
    for (const raw of tags) {
      let sub: ComplianceSubcategory | undefined;
      if (raw === 'text-change' || raw === 'props-change' || raw === 'detached-style' || raw === 'new-frame' || raw === 'image-change') {
        sub = raw;
      } else if (raw === 'text') {
        sub = 'text-change';
      } else if (raw === 'component-props') {
        sub = 'props-change';
      }
      if (!sub) continue;
      // compliance bucket counts already covered above when arrays are present
      if (change.compliance && (sub === 'detached-style' || sub === 'new-frame' || sub === 'image-change')) {
        continue;
      }
      out.compliance[sub] = (out.compliance[sub] ?? 0) + 1;
    }

    // 3. Raw unbucketed classes — always counted independently of
    //    subcategories. classes=['detached-style','structure'] yields
    //    raw.structure += 1 but raw.detached-style is NOT counted (compliance
    //    bucket absorbs it).
    for (const c of change.classes ?? []) {
      if (isUnbucketedRawClass(c)) {
        out.raw[c] = (out.raw[c] ?? 0) + 1;
      }
    }

    // 4. structure sub-kinds via anchored reason patterns.
    //
    // "boundingBox changed to or from null" is ambiguous on its own — it
    // fires whether the node appeared or disappeared. Look at the actual
    // before/after.boundingBox to pick the user-facing label:
    //
    //   before bbox present + after null → 삭제 (effectively removed)
    //   before null + after bbox present → 추가 (effectively added)
    //   neither / both null                → 표시토글 (true ambiguous toggle)
    //
    // When before/after metadata is unavailable (legacy fixtures), fall
    // back to the toggle bucket so we don't silently miscount.
    if ((change.classes ?? []).includes('structure')) {
      for (const r of change.reasons ?? []) {
        if (STRUCTURE_ADDED_RE.test(r)) {
          out.structureSubKinds.added++;
        } else if (STRUCTURE_REMOVED_RE.test(r)) {
          out.structureSubKinds.removed++;
        } else if (STRUCTURE_TOGGLE_RE.test(r)) {
          const beforeBbox = change.before?.boundingBox;
          const afterBbox = change.after?.boundingBox;
          if (beforeBbox != null && afterBbox == null) {
            out.structureSubKinds.removed++;
          } else if (beforeBbox == null && afterBbox != null) {
            out.structureSubKinds.added++;
          } else {
            out.structureSubKinds.toggle++;
          }
        }
      }
    }
  }

  return out;
}

// ----- affected screens -----

export interface AffectedScreen {
  key: string;
  displayName: string;
  weight: number;
}

export function affectedScreensTop(input: SummaryInput, n: number): AffectedScreen[] {
  const byKey = new Map<string, AffectedScreen>();

  for (const change of input.changes) {
    const aggKey = change.nodeId ?? change.key ?? change.nodeName ?? '';
    if (!aggKey) continue;
    const displayName = change.nodeName ?? aggKey;
    const weight = computeWeight(change);
    if (weight === 0) continue;

    const cur = byKey.get(aggKey);
    if (cur) {
      cur.weight += weight;
    } else {
      byKey.set(aggKey, { key: aggKey, displayName, weight });
    }
  }

  const sorted = [...byKey.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.displayName !== b.displayName) return a.displayName < b.displayName ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return sorted.slice(0, n);
}

function computeWeight(change: SummaryChange): number {
  let w = 0;
  if (change.compliance) {
    w += change.compliance.newDetachedStyles?.length ?? 0;
    w += change.compliance.newFrames?.length ?? 0;
    w += change.compliance.changedImageRefs?.length ?? 0;
  }
  for (const c of change.classes ?? []) {
    if (isUnbucketedRawClass(c)) w += 1;
  }
  // legacy text/props without compliance arrays
  if (!change.compliance) {
    for (const c of change.classes ?? []) {
      if (c === 'text' || c === 'component-props' || c === 'text-change' || c === 'props-change') w += 1;
    }
  }
  return w;
}

// ----- localized summary -----

export interface SummaryOptions {
  maxChars?: number;
  topN?: number;
  // Threshold above which a category line gets the "(상세는 viewer 참조)"
  // marker — set per channel if the cap differs.
  detailHintThreshold?: number;
}

const DEFAULT_TOP_N = 3;
const DEFAULT_DETAIL_HINT_THRESHOLD = 50;
// One value side of an inline text-change sample. Two of these plus
// labels and arrow comfortably fit in a Slack line under 200 chars.
const SAMPLE_VALUE_MAX = 40;

// Locate the first inlinable sample for each compliance subcategory that
// has rich upstream data. Returns undefined when no usable sample exists
// (e.g. legacy snapshot with no textChanges, props-change with no detail
// arrays in the diff). Always picks the first entry in document order so
// the sample is stable across cycles.
interface CategorySamples {
  textChangeSample?: string;
  textChangeLeafCount?: number;
  detachedSample?: string;
  detachedTotal?: number;
}

function categorySamples(input: SummaryInput): CategorySamples {
  const out: CategorySamples = {};
  let textLeafTotal = 0;
  let firstTextSample: string | undefined;
  let detachedTotal = 0;
  let firstDetachedSample: string | undefined;

  for (const change of input.changes) {
    if (change.textChanges && change.textChanges.length > 0) {
      textLeafTotal += change.textChanges.length;
      if (!firstTextSample) {
        const leaf = change.textChanges[0];
        const label = leaf.nodeName || leaf.nodeId || '(이름 없음)';
        const before = leaf.before === null ? '(없음)' : `"${truncate(leaf.before, SAMPLE_VALUE_MAX)}"`;
        const after = leaf.after === null ? '(삭제됨)' : `"${truncate(leaf.after, SAMPLE_VALUE_MAX)}"`;
        firstTextSample = `${label}: ${before} → ${after}`;
      }
    }
    const detached = change.compliance?.newDetachedStyles ?? [];
    detachedTotal += detached.length;
    if (!firstDetachedSample && detached.length > 0) {
      firstDetachedSample = formatDetachedSample(detached[0]);
    }
  }

  if (textLeafTotal > 0) {
    out.textChangeLeafCount = textLeafTotal;
    out.textChangeSample = firstTextSample;
  }
  if (detachedTotal > 0) {
    out.detachedTotal = detachedTotal;
    out.detachedSample = firstDetachedSample;
  }
  return out;
}

// Sample helper input shape — narrowed from the upstream `unknown` payload.
// Kept inline so the public SummaryChange.compliance can stay generic at the
// formatter boundary (see comment on that field).
interface DetachedSampleEntry {
  nodeId?: string;
  nodeName?: string;
  kind?: string;
  property?: string;
  rawValue?: unknown;
}

function formatDetachedSample(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const entry = raw as DetachedSampleEntry;
  const label = entry.nodeName || entry.nodeId || '(이름 없음)';
  const property = entry.property ?? '';
  const value = formatDetachedValue(entry.kind, entry.rawValue);
  const propertyHint = property ? ` · ${property}` : '';
  return `${label}${propertyHint} · ${value}`;
}

function formatDetachedValue(kind: string | undefined, raw: unknown): string {
  if (kind === 'color' && raw && typeof raw === 'object') {
    const c = raw as { r?: number; g?: number; b?: number; a?: number };
    if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
      const a = typeof c.a === 'number' ? c.a : 1;
      const hex = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${a < 1 ? hex2(a) : ''}`;
      return hex.toUpperCase();
    }
  }
  if (typeof raw === 'number') {
    return kind === 'typography' && !Number.isNaN(raw) ? `${raw}` : String(raw);
  }
  return raw === undefined || raw === null ? '(미설정)' : String(raw);
}

function hex2(n: number): string {
  const clamped = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  return Math.round(clamped * 255).toString(16).padStart(2, '0');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function buildLocalizedSummary(input: SummaryInput, opts: SummaryOptions = {}): string[] {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const threshold = opts.detailHintThreshold ?? DEFAULT_DETAIL_HINT_THRESHOLD;
  const counts = categoryCounts(input);
  const samples = categorySamples(input);
  const lines: string[] = [];

  // text-change count from tag-level can undercount when each change carries
  // multiple leaf changes (e.g. one DiffChange with 5 textChanges). Prefer
  // the leaf total when we have it so the Slack alert headline matches what
  // the viewer card shows ("텍스트 변경 5건" not "1건").
  if (samples.textChangeLeafCount !== undefined && samples.textChangeLeafCount > (counts.compliance['text-change'] ?? 0)) {
    counts.compliance['text-change'] = samples.textChangeLeafCount;
  }

  // 1. compliance lines (fixed order)
  for (const k of COMPLIANCE_ORDER) {
    const n = counts.compliance[k];
    if (!n) continue;
    lines.push(formatComplianceLine(k, n, threshold, samples));
  }

  // 2. raw class lines (fixed order)
  for (const k of RAW_ORDER) {
    const n = counts.raw[k];
    if (!n) continue;
    lines.push(formatRawLine(k, n, counts.structureSubKinds, threshold));
  }

  // 3. total
  lines.push(
    `• 전체: ${input.summary.total}건 (자동 반영 후보 ${input.summary.autoApply}건, 디자이너 검토 ${input.summary.reportOnly}건)`,
  );

  // 4. affected-screen top-N (skip when empty)
  const top = affectedScreensTop(input, topN);
  if (top.length > 0) {
    const parts = top.map(s => `${s.displayName} (${s.weight})`);
    lines.push(`• 영향 화면 top-${topN}: ${parts.join(' · ')}`);
  }

  if (opts.maxChars !== undefined) {
    return applyMaxChars(lines, opts.maxChars);
  }
  return lines;
}

function formatComplianceLine(
  k: ComplianceSubcategory,
  n: number,
  threshold: number,
  samples: CategorySamples,
): string {
  const emoji = CATEGORY_EMOJI[k];
  const label = CATEGORY_LABEL_KO[k];
  // Above the viewer-redirect threshold the sample only inflates the line —
  // designers will open the viewer anyway, so we suppress the inline sample
  // and keep the existing "(상세는 viewer 참조)" hint.
  if (n >= threshold) {
    return `• ${emoji} ${label}: ${n}건 (상세는 viewer 참조)`;
  }
  const sample = sampleFor(k, samples);
  if (!sample) return `• ${emoji} ${label}: ${n}건`;
  const remaining = sample.coveredCount > 1 ? `, +${sample.coveredCount - 1}건` : '';
  return `• ${emoji} ${label}: ${n}건 (${sample.text}${remaining})`;
}

function sampleFor(
  k: ComplianceSubcategory,
  samples: CategorySamples,
): { text: string; coveredCount: number } | undefined {
  if (k === 'text-change' && samples.textChangeSample && samples.textChangeLeafCount) {
    return { text: samples.textChangeSample, coveredCount: samples.textChangeLeafCount };
  }
  if (k === 'detached-style' && samples.detachedSample && samples.detachedTotal) {
    return { text: samples.detachedSample, coveredCount: samples.detachedTotal };
  }
  return undefined;
}

function formatRawLine(
  k: 'token' | 'structure' | 'layout' | 'asset',
  n: number,
  sub: { added: number; removed: number; toggle: number },
  threshold: number,
): string {
  const emoji = RAW_CLASS_EMOJI[k];
  const label = RAW_CLASS_LABEL_KO[k];
  const hint = n >= threshold ? ' (상세는 viewer 참조)' : '';
  if (k === 'structure') {
    const subParts: string[] = [];
    if (sub.added) subParts.push(`추가 ${sub.added}`);
    if (sub.removed) subParts.push(`삭제 ${sub.removed}`);
    if (sub.toggle) subParts.push(`표시토글 ${sub.toggle}`);
    const subPart = subParts.length ? ` (${subParts.join('·')})` : '';
    return `• ${emoji} ${label}: ${n}건${subPart}${hint}`;
  }
  return `• ${emoji} ${label}: ${n}건${hint}`;
}

// ----- cap -----

const TRUNCATION_MARKER = '• … (상세는 viewer 참조)';

// Truncate lines until joining them with '\n' fits within maxChars. Drops
// from the end (affected-screen line first because it appears after the
// totals, then raw / compliance lines in reverse order). The total line is
// always preserved so the designer still sees the "전체: N건" headline.
function applyMaxChars(lines: string[], maxChars: number): string[] {
  if (joinedLength(lines) <= maxChars) return lines;

  // Identify the index of the "전체" line — must be kept.
  const totalIdx = lines.findIndex(l => l.startsWith('• 전체:'));

  // Drop from the end first; if still too long, drop from the start (but
  // never drop the total line).
  const droppable: number[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (i === totalIdx) continue;
    droppable.push(i);
  }

  const keep = new Set<number>(lines.map((_, i) => i));
  for (const idx of droppable) {
    if (joinedLength([...keep].sort((a, b) => a - b).map(i => lines[i]).concat(TRUNCATION_MARKER)) <= maxChars) {
      break;
    }
    keep.delete(idx);
  }

  const result = [...keep].sort((a, b) => a - b).map(i => lines[i]);
  result.push(TRUNCATION_MARKER);
  return result;
}

function joinedLength(lines: string[]): number {
  if (lines.length === 0) return 0;
  return lines.reduce((sum, l) => sum + l.length, 0) + (lines.length - 1);
}
