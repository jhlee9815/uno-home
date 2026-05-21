export interface ViewerChange {
  key: string;
  nodeId: string | null;
  nodeName: string;
  classes: string[];
  reasons: string[];
  decision: string;
  decisionReasons: string[];
  target?: { code?: string | null };
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
    const codePath = normalizeCodePath(change.target?.code ?? null);
    return `<section class="card">
  <header>
    <p class="eyebrow">#${index + 1} · ${escapeHtml(change.decision)}</p>
    <h2>${escapeHtml(change.nodeName)} <code>${escapeHtml(nodeId)}</code></h2>
    <p>${change.classes.map(c => `<span class="tag">${escapeHtml(c)}</span>`).join(' ')}</p>
  </header>
  <div class="compare">
    <figure>
      <figcaption>Before</figcaption>
      ${images.before ? `<img src="${escapeHtml(images.before)}" alt="Before ${escapeHtml(change.nodeName)}">` : '<div class="empty">No baseline image</div>'}
    </figure>
    <figure>
      <figcaption>After</figcaption>
      ${images.after ? `<img src="${escapeHtml(images.after)}" alt="After ${escapeHtml(change.nodeName)}">` : '<div class="empty">No snapshot image</div>'}
    </figure>
  </div>
  <dl>
    <dt>Key</dt><dd><code>${escapeHtml(change.key)}</code></dd>
    <dt>Code</dt><dd>${codePath ? `<code>${escapeHtml(codePath)}</code>` : '<span class="muted">No mapped code path</span>'}</dd>
    <dt>Reasons</dt><dd><ul>${change.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></dd>
    <dt>Decision</dt><dd><ul>${change.decisionReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></dd>
  </dl>
  <p><a href="${figmaUrl}" target="_blank" rel="noreferrer">Open in Figma</a></p>
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
.empty { min-height: 180px; display: grid; place-items: center; border: 1px dashed #d1d5db; border-radius: 10px; color: #6b7280; background: #f9fafb; }
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
  <h1>Designer Review · ${escapeHtml(input.csId)}</h1>
  <p>Total ${input.classified.summary.total} · auto-apply ${input.classified.summary.autoApply} · report-only ${input.classified.summary.reportOnly}</p>
  ${input.issueUrl ? `<p>Issue: <a href="${escapeHtml(input.issueUrl)}">${escapeHtml(input.issueUrl)}</a></p>` : ''}
</header>
<main>
  <section class="instructions">
    <h2>Designer decision</h2>
    <p>변경을 수락하면 GitHub Issue에 <code>designer-approved</code> 라벨을, 거부하면 <code>designer-rejected</code> 라벨을 붙입니다.</p>
    <p>Phase A에서는 결정 기록과 viewer/manifest까지 처리합니다. 코드 자동 수정은 다음 Phase B에서 marker 기반으로 제한해 진행합니다.</p>
  </section>
  ${cards || '<section class="card">No changes</section>'}
</main>
</body>
</html>`;
}

function normalizeCodePath(code: string | null): string | null {
  if (!code) return null;
  return code.replace(/^\.\.\//, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
