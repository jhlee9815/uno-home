#!/usr/bin/env tsx
/**
 * Pending designer-review viewer.
 *
 * Reads the latest classified diff + cs report, calls Figma images API to
 * render the current state of changed nodes, writes a self-contained HTML
 * page to .automation/viewer/pending-{ts}.html, and opens it in the browser.
 *
 * Read-only operation. No git/network state mutations beyond Figma image
 * URL fetches (Figma server-side caches; URLs expire after ~30 min).
 *
 * Usage:
 *   npm run figma:viewer
 *   (or: tsx --env-file=.env scripts/ops/pending-review-viewer.ts)
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const DIFFS_DIR = join(REPO_ROOT, '.automation', 'diffs');
const REPORTS_DIR = join(REPO_ROOT, '.automation', 'reports');
const VIEWER_DIR = join(REPO_ROOT, '.automation', 'viewer');
const MAPPING_PATH = join(REPO_ROOT, 'config', 'figma-mapping.yaml');
// Used in the rendered ops viewer header to link to live designer-review
// issues. Falls back to the current repo slug; downstream forks should set
// GITHUB_REPOSITORY (or run from a CI context that does).
const REPO_SLUG = process.env.GITHUB_REPOSITORY ?? 'jhlee9815/design-review-bot';

interface ClassifiedChange {
  key: string;
  nodeId: string;
  nodeName: string;
  classes: string[];
  reasons: string[];
  decision: string;
  decisionReasons: string[];
  target?: { section?: string; apply?: string; code?: string; targetType?: string };
}

interface ClassifiedDiff {
  generatedAt: string;
  fileKey: string;
  baseTs: string;
  headTs: string;
  basePath: string;
  headPath: string;
  changes: ClassifiedChange[];
}

interface SnapshotNodeEntry {
  id: string;
  name: string;
  texts: Array<{ nodeId: string; nodeName: string; path: string[]; value: string }>;
}

interface SnapshotFile {
  fileKey: string;
  timestamp: string;
  nodes: Record<string, SnapshotNodeEntry>;
}

interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

function latestFile(dir: string, pattern: RegExp): string {
  const files = readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error(`No files matching ${pattern} in ${dir}`);
  return join(dir, files[0]);
}

function findLatestCs(): { csId: string; reportPath: string } {
  const reportFiles = readdirSync(REPORTS_DIR)
    .filter(f => /^cs-\d{4}-\d{2}-\d{2}T.*\.md$/.test(f))
    .sort()
    .reverse();
  if (reportFiles.length === 0) throw new Error('No cs-*.md reports found');
  const file = reportFiles[0];
  const csId = file.replace(/\.md$/, '');
  return { csId, reportPath: join(REPORTS_DIR, file) };
}

async function fetchFigmaImages(fileKey: string, nodeIds: string[]): Promise<Record<string, string | null>> {
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new Error('FIGMA_TOKEN not set in environment');
  const ids = nodeIds.join(',');
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma /v1/images ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as FigmaImagesResponse;
  if (data.err) throw new Error(`Figma API error: ${data.err}`);
  return data.images;
}

function loadBaselineTexts(basePath: string, nodeKeys: string[]): Record<string, string[]> {
  if (!existsSync(basePath)) return {};
  const snap = JSON.parse(readFileSync(basePath, 'utf-8')) as SnapshotFile;
  const out: Record<string, string[]> = {};
  for (const key of nodeKeys) {
    const entry = snap.nodes[key];
    if (entry) out[key] = entry.texts.map(t => `${t.path.join(' › ')}: ${t.value}`);
  }
  return out;
}

function loadHeadTexts(headPath: string, nodeKeys: string[]): Record<string, string[]> {
  if (!existsSync(headPath)) return {};
  const snap = JSON.parse(readFileSync(headPath, 'utf-8')) as SnapshotFile;
  const out: Record<string, string[]> = {};
  for (const key of nodeKeys) {
    const entry = snap.nodes[key];
    if (entry) out[key] = entry.texts.map(t => `${t.path.join(' › ')}: ${t.value}`);
  }
  return out;
}

function textDiff(before: string[], after: string[]): { added: string[]; removed: string[]; same: number } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const removed = before.filter(t => !afterSet.has(t));
  const added = after.filter(t => !beforeSet.has(t));
  const same = before.filter(t => afterSet.has(t)).length;
  return { added, removed, same };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(input: {
  csId: string;
  fileKey: string;
  baseTs: string;
  headTs: string;
  changes: Array<{
    change: ClassifiedChange;
    imageUrl: string | null;
    figmaDeepLink: string;
    codePath: string | null;
    beforeTexts: string[];
    afterTexts: string[];
    textDiff: { added: string[]; removed: string[]; same: number };
  }>;
}): string {
  const rows = input.changes
    .map((c, i) => {
      const td = c.textDiff;
      const beforeList = c.beforeTexts.length
        ? c.beforeTexts.map(t => `<li>${escapeHtml(t)}</li>`).join('')
        : '<li class="empty">(no text leaves)</li>';
      const afterList = c.afterTexts.length
        ? c.afterTexts.map(t => `<li>${escapeHtml(t)}</li>`).join('')
        : '<li class="empty">(no text leaves)</li>';
      const addedList = td.added.length
        ? td.added.map(t => `<li class="added">+ ${escapeHtml(t)}</li>`).join('')
        : '<li class="empty">(none)</li>';
      const removedList = td.removed.length
        ? td.removed.map(t => `<li class="removed">- ${escapeHtml(t)}</li>`).join('')
        : '<li class="empty">(none)</li>';
      const reasons = c.change.reasons.map(r => `<span class="tag">${escapeHtml(r)}</span>`).join(' ');
      const decisionReasons = c.change.decisionReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('');
      const codeBadge = c.codePath
        ? `<code>${escapeHtml(c.codePath)}</code>`
        : '<span class="muted">(no code path mapped)</span>';
      return `
<section class="card">
  <header>
    <h2><span class="idx">#${i + 1}</span> ${escapeHtml(c.change.nodeName)} <small>${escapeHtml(c.change.nodeId)}</small></h2>
    <div class="meta">
      <span class="key"><code>${escapeHtml(c.change.key)}</code></span>
      ${reasons}
      <span class="decision decision-${escapeHtml(c.change.decision)}">${escapeHtml(c.change.decision)}</span>
    </div>
  </header>
  <div class="body">
    <div class="image">
      ${c.imageUrl
        ? `<a href="${c.figmaDeepLink}" target="_blank"><img src="${c.imageUrl}" alt="${escapeHtml(c.change.nodeName)}" loading="lazy" /></a>`
        : `<div class="image-placeholder">(no image — Figma render failed)</div>`}
      <div class="image-actions">
        <a class="btn" href="${c.figmaDeepLink}" target="_blank">Open in Figma</a>
      </div>
    </div>
    <div class="info">
      <div class="row">
        <strong>코드 경로:</strong> ${codeBadge}
      </div>
      <div class="row">
        <strong>분류 사유:</strong>
        <ul class="decisionReasons">${decisionReasons}</ul>
      </div>
      <div class="diff-grid">
        <div>
          <h4>Baseline texts (${c.beforeTexts.length})</h4>
          <ul class="texts">${beforeList}</ul>
        </div>
        <div>
          <h4>Head texts (${c.afterTexts.length})</h4>
          <ul class="texts">${afterList}</ul>
        </div>
        <div>
          <h4>제거됨 (${td.removed.length})</h4>
          <ul class="texts">${removedList}</ul>
        </div>
        <div>
          <h4>추가됨 (${td.added.length})</h4>
          <ul class="texts">${addedList}</ul>
        </div>
      </div>
    </div>
  </div>
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Pending Designer Review — ${escapeHtml(input.csId)}</title>
<style>
  :root { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; }
  body { margin: 0; padding: 0; background: #f6f7f9; color: #0b1320; }
  header.top { background: #0b1320; color: #fff; padding: 20px 32px; }
  header.top h1 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
  header.top .meta { font-size: 12px; opacity: 0.75; }
  header.top a { color: #9ec4ff; }
  main { max-width: 1200px; margin: 0 auto; padding: 24px 32px 64px; }
  .summary { background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .summary p { margin: 0 0 8px; }
  .summary p:last-child { margin: 0; }
  .summary code { background: #eef0f3; padding: 1px 6px; border-radius: 3px; font-size: 12px; }
  .card { background: #fff; border-radius: 8px; padding: 18px 22px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .card header h2 { margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .card header h2 .idx { background: #eef0f3; color: #506174; font-size: 12px; padding: 2px 8px; border-radius: 999px; }
  .card header h2 small { font-family: 'SF Mono', Menlo, monospace; color: #6b7785; font-size: 12px; font-weight: 400; }
  .card .meta { margin: 10px 0 14px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { background: #ffefc7; color: #804b00; font-size: 11px; padding: 2px 8px; border-radius: 3px; }
  .decision { font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: 600; }
  .decision-report-only { background: #fde2e2; color: #8a1c1c; }
  .decision-auto-apply { background: #d6f5d6; color: #1b6b1b; }
  .decision-unknown { background: #e0e6f0; color: #44516b; }
  .body { display: grid; grid-template-columns: 360px 1fr; gap: 24px; }
  .image img { max-width: 100%; border: 1px solid #e3e6eb; border-radius: 6px; display: block; cursor: zoom-in; }
  .image-placeholder { padding: 60px 20px; background: #f1f2f5; border-radius: 6px; color: #6b7785; text-align: center; font-size: 13px; }
  .image-actions { margin-top: 10px; }
  .btn { display: inline-block; background: #0b1320; color: #fff; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; }
  .btn:hover { background: #1c2740; }
  .info .row { margin-bottom: 12px; font-size: 13px; }
  .info code { background: #eef0f3; padding: 1px 6px; border-radius: 3px; font-family: 'SF Mono', Menlo, monospace; font-size: 12px; }
  .info ul.decisionReasons { margin: 4px 0 0 0; padding-left: 18px; color: #44516b; font-size: 13px; }
  .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
  .diff-grid h4 { margin: 0 0 6px; font-size: 12px; color: #44516b; text-transform: uppercase; letter-spacing: 0.05em; }
  ul.texts { list-style: none; padding: 0; margin: 0; max-height: 160px; overflow-y: auto; font-family: 'SF Mono', Menlo, monospace; font-size: 11px; line-height: 1.45; background: #fafbfc; border: 1px solid #eef0f3; border-radius: 4px; padding: 6px 8px; }
  ul.texts li { padding: 1px 0; word-break: break-word; }
  ul.texts li.added { color: #1b6b1b; }
  ul.texts li.removed { color: #8a1c1c; }
  ul.texts li.empty { color: #9aa3b1; font-style: italic; }
  .muted { color: #6b7785; }
  .key code { font-size: 11px; }
</style>
</head>
<body>
<header class="top">
  <h1>Pending Designer Review</h1>
  <div class="meta">
    Change set: <code>${escapeHtml(input.csId)}</code> ·
    fileKey: <code>${escapeHtml(input.fileKey)}</code> ·
    baseline: <code>${escapeHtml(input.baseTs)}</code> → head: <code>${escapeHtml(input.headTs)}</code> ·
    GitHub: <a href="https://github.com/${REPO_SLUG}/issues?q=is%3Aissue+is%3Aopen+label%3Adesigner-review" target="_blank">designer-review issues →</a>
  </div>
</header>
<main>
  <div class="summary">
    <p><strong>${input.changes.length}</strong>건의 변경이 designer review 대기 중. 모두 report-only (자동 코드 변경 안 됨).</p>
    <p class="muted">현재 이미지는 Figma의 <strong>head 상태</strong>(즉 디자이너가 마지막으로 편집한 모습)만 보여줍니다. 진정한 before/after 비교는 baseline 이미지 저장 인프라(워크플로 설계 #1) 후 가능.</p>
  </div>
  ${rows}
</main>
</body>
</html>`;
}

async function main(): Promise<void> {
  const classifiedPath = latestFile(DIFFS_DIR, /-classified\.json$/);
  const classified = JSON.parse(readFileSync(classifiedPath, 'utf-8')) as ClassifiedDiff;
  const { csId, reportPath } = findLatestCs();
  console.log(`[viewer] cs:              ${csId}`);
  console.log(`[viewer] report:          ${reportPath}`);
  console.log(`[viewer] classified diff: ${classifiedPath}`);
  console.log(`[viewer] fileKey:         ${classified.fileKey}`);
  console.log(`[viewer] changes:         ${classified.changes.length}`);

  if (classified.changes.length === 0) {
    console.log('[viewer] no pending changes — nothing to render.');
    return;
  }

  const nodeIds = classified.changes.map(c => c.nodeId);
  console.log(`[viewer] fetching Figma renders for: ${nodeIds.join(', ')}`);
  const images = await fetchFigmaImages(classified.fileKey, nodeIds);

  const nodeKeys = classified.changes.map(c => c.key);
  const baselineTexts = loadBaselineTexts(classified.basePath, nodeKeys);
  const headTexts = loadHeadTexts(classified.headPath, nodeKeys);

  const mappingYaml = existsSync(MAPPING_PATH) ? readFileSync(MAPPING_PATH, 'utf-8') : '';

  const enrichedChanges = classified.changes.map(change => {
    const before = baselineTexts[change.key] ?? [];
    const after = headTexts[change.key] ?? [];
    const nodeRef = change.nodeId.replace(':', '-');
    const figmaDeepLink = `https://www.figma.com/design/${classified.fileKey}?node-id=${nodeRef}`;
    // Try to extract `code:` line from mapping yaml for this key
    const keyRegex = new RegExp(`\\n  ${change.key}:[\\s\\S]*?code:\\s*([^\\n]+)`);
    const codeMatch = mappingYaml.match(keyRegex);
    const codePath = codeMatch ? codeMatch[1].trim() : change.target?.code ?? null;
    return {
      change,
      imageUrl: images[change.nodeId] ?? null,
      figmaDeepLink,
      codePath,
      beforeTexts: before,
      afterTexts: after,
      textDiff: textDiff(before, after),
    };
  });

  const html = renderHtml({
    csId,
    fileKey: classified.fileKey,
    baseTs: classified.baseTs,
    headTs: classified.headTs,
    changes: enrichedChanges,
  });

  mkdirSync(VIEWER_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(VIEWER_DIR, `pending-${ts}.html`);
  writeFileSync(outPath, html, 'utf-8');
  console.log(`[viewer] wrote ${outPath}`);
  console.log(`[viewer] opening in browser…`);
  spawn('open', [outPath], { detached: true, stdio: 'ignore' }).unref();
}

main().catch(err => {
  console.error('[viewer] FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
