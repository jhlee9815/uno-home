import { labelForClass, emojiForClass, RAW_CLASSES_WITH_SUBCATEGORY } from './category-labels.ts';

export interface ViewerTextChange {
  nodeId: string;
  nodeName: string;
  path: string[];
  before: string | null;
  after: string | null;
}

export interface ViewerChange {
  key: string;
  nodeId: string | null;
  nodeName: string;
  classes: string[];
  // High-level compliance subcategories derived by the classifier. Prefer
  // this over `classes` for designer-facing labels — `classes` carries raw
  // diff classes (text, component-props, token, structure, ...) that don't
  // have Korean labels of their own.
  subcategories?: string[];
  reasons: string[];
  decision: string;
  decisionReasons: string[];
  target?: { code?: string | null };
  textChanges?: ViewerTextChange[];
}

export interface ViewerClassifiedDiff {
  summary: { total: number; autoApply: number; reportOnly: number; unknown: number };
  changes: ViewerChange[];
}

export interface ViewerImageRefs {
  before: string | null;
  after: string | null;
}

export function extractChangedNodeIds(classified: Pick<ViewerClassifiedDiff, 'changes'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const change of classified.changes) {
    if (!change.nodeId || seen.has(change.nodeId)) continue;
    seen.add(change.nodeId);
    out.push(change.nodeId);
  }
  return out;
}

export function viewerUrlFor(baseUrl: string | undefined, csId: string): string | undefined {
  if (!baseUrl) return undefined;
  return `${baseUrl.replace(/\/+$/, '')}/cs/${encodeURIComponent(csId)}/`;
}

export function buildViewerHtml(input: {
  csId: string;
  fileKey: string;
  issueUrl?: string;
  classified: ViewerClassifiedDiff;
  imageRefs: Record<string, ViewerImageRefs>;
}): string {
  const cards = input.classified.changes.map((change, index) => {
    const nodeId = change.nodeId ?? '';
    const images = input.imageRefs[nodeId] ?? { before: null, after: null };
    const figmaUrl = nodeId
      ? `https://www.figma.com/design/${encodeURIComponent(input.fileKey)}/?node-id=${encodeURIComponent(nodeId.replace(':', '-'))}`
      : '#';
    const textChangeBlock = renderTextChanges(change.textChanges);
    const beforeEmptyMessage = images.after && !images.before
      ? 'baseline 이미지 미등록 — 추적 시작 직후라 비교할 이전 시점이 없습니다.<br><span class="muted">다음 baseline-promote 후 cycle부터 비교됩니다.</span>'
      : '이전 baseline 이미지 없음';
    const codePath = normalizeCodePath(change.target?.code ?? null);
    // Render tags so designers see every signal the classifier surfaced.
    //   - When subcategories[] is present: union of subcategories and any
    //     raw classes that do NOT already roll up to one of those
    //     subcategories. Token / structure / asset / layout don't have a
    //     compliance bucket but still matter for risk, so they ride along.
    //   - When subcategories[] is absent (legacy snapshots / hand-built
    //     fixtures): fall back to raw classes directly; labelForClass
    //     covers both compliance names and raw class names.
    // Dedup by localized label so 'text' + subcategory 'text-change' don't
    // render the same chip twice.
    const tagKeys: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
      const label = labelForClass(raw);
      if (seen.has(label)) return;
      seen.add(label);
      tagKeys.push(raw);
    };
    const hasSubcategories = (change.subcategories?.length ?? 0) > 0;
    if (hasSubcategories) {
      for (const sub of change.subcategories!) push(sub);
      for (const raw of change.classes) {
        if (RAW_CLASSES_WITH_SUBCATEGORY.has(raw)) continue; // covered by a subcategory above
        push(raw);
      }
    } else {
      for (const raw of change.classes) push(raw);
    }
    const tags = tagKeys
      .map(c => `<span class="tag">${escapeHtml(emojiForClass(c))} ${escapeHtml(labelForClass(c))}</span>`)
      .join(' ');
    return `<section class="card">
  <header>
    <p class="eyebrow">#${index + 1} · ${escapeHtml(decisionLabelKo(change.decision))}</p>
    <h2>${escapeHtml(change.nodeName)} <code>${escapeHtml(nodeId)}</code></h2>
    <p>${tags}</p>
  </header>
  <div class="compare">
    <figure>
      <figcaption>이전 (Before)</figcaption>
      ${images.before ? `<img src="${escapeHtml(images.before)}" alt="이전 ${escapeHtml(change.nodeName)}">` : `<div class="empty">${beforeEmptyMessage}</div>`}
    </figure>
    <figure>
      <figcaption>현재 (After)</figcaption>
      ${images.after ? `<img src="${escapeHtml(images.after)}" alt="현재 ${escapeHtml(change.nodeName)}">` : '<div class="empty">현재 스냅샷 이미지 없음</div>'}
    </figure>
  </div>
  ${textChangeBlock}
  <dl>
    <dt>Key</dt><dd><code>${escapeHtml(change.key)}</code></dd>
    <dt>코드 경로</dt><dd>${codePath ? `<code>${escapeHtml(codePath)}</code>` : '<span class="muted">매핑된 코드 경로 없음</span>'}</dd>
    <dt>감지 이유</dt><dd><ul>${change.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></dd>
    <dt>처리 결정</dt><dd><ul>${change.decisionReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></dd>
  </dl>
  <p><a href="${figmaUrl}" target="_blank" rel="noreferrer">Figma에서 열기</a></p>
</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.csId)} designer review</title>
<style>
:root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; }
body { margin: 0; background: #f5f6f8; color: #111827; }
.top { padding: 28px 36px; background: #111827; color: white; }
.top h1 { margin: 0 0 8px; font-size: 22px; }
.top p { margin: 4px 0; color: #d1d5db; }
main { max-width: 1180px; margin: 0 auto; padding: 24px; }
.instructions, .card { background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.instructions code, .card code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; }
.card h2 { margin: 0 0 8px; font-size: 18px; }
.eyebrow { margin: 0 0 6px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.tag { display: inline-block; background: #fef3c7; color: #92400e; border-radius: 999px; padding: 3px 9px; font-size: 12px; margin-right: 4px; }
.compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 16px 0; }
figure { margin: 0; }
figcaption { font-weight: 700; margin-bottom: 8px; }
img { width: 100%; max-height: 720px; object-fit: contain; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; }
.empty { min-height: 180px; display: grid; place-items: center; padding: 16px; text-align: center; border: 1px dashed #d1d5db; border-radius: 10px; color: #6b7280; background: #f9fafb; line-height: 1.5; }
.text-changes { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin: 0 0 16px; }
.text-changes h3 { margin: 0 0 10px; font-size: 14px; color: #374151; }
.text-changes ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.text-changes li { padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; }
.text-label { font-weight: 700; font-size: 13px; color: #111827; }
.text-path { display: block; font-size: 11px; color: #6b7280; margin-top: 2px; }
.text-diff { display: flex; gap: 8px; align-items: center; margin-top: 6px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; flex-wrap: wrap; }
.text-before { background: #fef2f2; color: #991b1b; padding: 2px 8px; border-radius: 4px; text-decoration: line-through; }
.text-after { background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 4px; }
.text-arrow { color: #6b7280; }
.text-empty { color: #9ca3af; font-style: italic; padding: 2px 8px; }
dl { display: grid; grid-template-columns: 90px 1fr; gap: 8px 12px; }
dt { font-weight: 700; color: #374151; }
dd { margin: 0; }
.muted { color: #6b7280; }
a { color: #2563eb; }
@media (max-width: 800px) { .compare { grid-template-columns: 1fr; } .top { padding: 20px; } main { padding: 16px; } }
</style>
</head>
<body>
<header class="top">
  <h1>디자이너 리뷰 · ${escapeHtml(input.csId)}</h1>
  <p>총 변경 ${input.classified.summary.total}건 · 자동 반영 후보 ${input.classified.summary.autoApply}건 · 디자이너 검토 ${input.classified.summary.reportOnly}건</p>
  ${input.issueUrl ? `<p>관련 Issue: <a href="${escapeHtml(input.issueUrl)}">${escapeHtml(input.issueUrl)}</a></p>` : ''}
</header>
<main>
  <section class="instructions">
    <h2>디자이너 결정</h2>
    <p>변경을 수락하면 GitHub Issue에 <code>designer-approved</code> 라벨을, 거부하면 <code>designer-rejected</code> 라벨을 붙입니다.</p>
    <p>Phase A에서는 결정 기록과 viewer/manifest까지 처리합니다. 코드 자동 수정은 다음 Phase B에서 marker 기반으로 제한해 진행합니다.</p>
  </section>
  ${cards || '<section class="card">변경 사항이 없습니다.</section>'}
</main>
</body>
</html>`;
}

function normalizeCodePath(code: string | null): string | null {
  if (!code) return null;
  return code.replace(/^\.\.\//, '');
}

function renderTextChanges(textChanges: ViewerTextChange[] | undefined): string {
  if (!textChanges || textChanges.length === 0) return '';
  const rows = textChanges.map(tc => {
    const label = tc.nodeName || tc.path.at(-1) || tc.nodeId;
    const beforeCell = tc.before === null
      ? '<span class="text-empty">(없음)</span>'
      : `<span class="text-before">${escapeHtml(tc.before)}</span>`;
    const afterCell = tc.after === null
      ? '<span class="text-empty">(삭제됨)</span>'
      : `<span class="text-after">${escapeHtml(tc.after)}</span>`;
    const pathHint = tc.path.length > 1
      ? `<span class="text-path">${escapeHtml(tc.path.slice(0, -1).join(' › '))}</span>`
      : '';
    return `<li><span class="text-label">${escapeHtml(label)}</span>${pathHint}<div class="text-diff">${beforeCell}<span class="text-arrow">→</span>${afterCell}</div></li>`;
  }).join('');
  return `<section class="text-changes">
    <h3>텍스트 변경 ${textChanges.length}건</h3>
    <ul>${rows}</ul>
  </section>`;
}

const DECISION_LABEL_KO: Record<string, string> = {
  'auto-apply': '자동 반영 후보',
  'report-only': '디자이너 검토',
  'unknown': '미분류',
};

function decisionLabelKo(raw: string): string {
  return DECISION_LABEL_KO[raw] ?? raw;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
