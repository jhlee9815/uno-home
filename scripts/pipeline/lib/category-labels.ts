// Single source of truth for Korean labels of the compliance / change classes.
// Both the markdown report (designer-review.ts) and the HTML viewer
// (viewer-generator.ts) translate raw classes (e.g. `detached-style`) through
// this map so the designer sees one consistent vocabulary across Slack, Issue,
// and viewer.

import type { ComplianceSubcategory, DetachedStyleKind } from './compliance-types.ts';

export const CATEGORY_LABEL_KO: Record<ComplianceSubcategory, string> = {
  'text-change': '텍스트 변경',
  'props-change': '속성 변경',
  'image-change': '이미지 변경',
  'detached-style': '디자인 시스템 미사용',
  'new-frame': '새 화면 추가',
};

export const CATEGORY_EMOJI: Record<ComplianceSubcategory, string> = {
  'text-change': '✏️',
  'props-change': '🧩',
  'image-change': '🖼️',
  'detached-style': '🎨',
  'new-frame': '🆕',
};

// Korean labels for the lower-level raw diff classes the classifier emits.
// These don't roll up to a ComplianceSubcategory (so the high-level "변경
// 분류" summary doesn't count them), but the viewer still surfaces them as
// per-change tags so designers see structural risk that doesn't fit the five
// compliance buckets.
export const RAW_CLASS_LABEL_KO: Record<string, string> = {
  text: '텍스트 변경',
  'component-props': '속성 변경',
  token: '디자인 토큰 변경',
  structure: '구조 변경',
  asset: '에셋 변경',
  layout: '레이아웃 변경',
};
export const RAW_CLASS_EMOJI: Record<string, string> = {
  text: '✏️',
  'component-props': '🧩',
  token: '🎨',
  structure: '🧱',
  asset: '📦',
  layout: '📐',
};

// Raw classes that do NOT roll up to a ComplianceSubcategory bucket — these
// are the only raw classes the Slack/Discord summary should count as separate
// lines (`token`, `structure`, `layout`, `asset`). Compliance-mapped raw
// classes (`text`, `component-props`, `detached-style`, `new-frame`,
// `image-change`) are already covered by the compliance bucket lines.
export const UNBUCKETED_RAW_CLASSES: readonly ('token' | 'structure' | 'layout' | 'asset')[] = [
  'token',
  'structure',
  'layout',
  'asset',
] as const;

export type UnbucketedRawClass = (typeof UNBUCKETED_RAW_CLASSES)[number];

export function isUnbucketedRawClass(c: string): c is UnbucketedRawClass {
  return (UNBUCKETED_RAW_CLASSES as readonly string[]).includes(c);
}

// Mirror of classify-diff.ts `CLASS_TO_SUBCATEGORY`. Kept here so designer-
// facing surfaces (Slack summary, viewer) can normalize raw class names
// from legacy classified files that lack a `subcategories[]` field without
// importing from the classifier (which would create a circular dependency
// because the classifier itself depends on label maps for some logging).
//
// Keep in sync with `CLASS_TO_SUBCATEGORY` in scripts/pipeline/lib/classify-diff.ts.
export const RAW_CLASS_TO_SUBCATEGORY: Readonly<Record<string, ComplianceSubcategory>> = {
  text: 'text-change',
  'component-props': 'props-change',
  'image-change': 'image-change',
  'detached-style': 'detached-style',
  'new-frame': 'new-frame',
};

// Set of raw classes the classifier maps to a ComplianceSubcategory. The
// viewer uses this to avoid showing the same change twice when both the
// raw class and its derived subcategory appear (e.g. ['text'] →
// subcategories ['text-change']).
export const RAW_CLASSES_WITH_SUBCATEGORY: ReadonlySet<string> = new Set(
  Object.keys(RAW_CLASS_TO_SUBCATEGORY),
);

// Normalize a raw class name to its ComplianceSubcategory, or undefined if
// the class doesn't produce a compliance bucket (token / structure / asset
// / layout / etc.).
export function rawClassToSubcategory(raw: string): ComplianceSubcategory | undefined {
  return RAW_CLASS_TO_SUBCATEGORY[raw];
}

export const DETACHED_STYLE_KIND_LABEL_KO: Record<DetachedStyleKind, string> = {
  color: '색상',
  typography: '타이포',
  effect: '효과',
};

// Fallback chain: compliance subcategory → low-level raw class → raw passthrough.
// If a tag doesn't match any known label (older snapshots may emit ad-hoc
// class names), pass the raw value through so we don't silently lose
// information in the viewer.
export function labelForClass(raw: string): string {
  return (CATEGORY_LABEL_KO as Record<string, string>)[raw]
    ?? RAW_CLASS_LABEL_KO[raw]
    ?? raw;
}

export function emojiForClass(raw: string): string {
  return (CATEGORY_EMOJI as Record<string, string>)[raw]
    ?? RAW_CLASS_EMOJI[raw]
    ?? '•';
}
