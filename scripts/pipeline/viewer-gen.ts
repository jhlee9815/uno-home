import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.ts';
import { baselineImagePath, fetchAndSaveFigmaImages, imageFileNameForNodeId, snapshotImagePath } from './lib/figma-images.ts';
import { buildViewerHtml, extractChangedNodeIds, viewerUrlFor, type ViewerImageRefs } from './lib/viewer-generator.ts';
import { loadManifest, sha256File, updateManifest } from './lib/cs-manifest.ts';
import type { ClassifiedDiffFile } from './lib/classify-diff.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const DIFFS_DIR = resolve(REPO_ROOT, '.automation/diffs');
const DIST_VIEWER_DIR = resolve(REPO_ROOT, 'dist-viewer');
const logger = createLogger('viewer-gen');

async function main(): Promise<void> {
  const csId = process.argv[2] ?? latestCsIdFromManifest();
  if (!csId) {
    logger.error('Usage: npm run figma:viewer:generate -- <cs-id>');
    process.exit(1);
  }

  const timestamp = csId.replace(/^cs-/, '');
  const classifiedPath = resolve(DIFFS_DIR, `${timestamp}-classified.json`);
  if (!existsSync(classifiedPath)) {
    logger.error(`Classified diff not found: ${classifiedPath}`);
    process.exit(1);
  }

  const classified = JSON.parse(readFileSync(classifiedPath, 'utf-8')) as ClassifiedDiffFile;
  const manifest = existsManifest(csId) ? loadManifest(REPO_ROOT, csId) : null;
  const nodeIds = extractChangedNodeIds(classified);
  const afterHashes = await fetchAndSaveFigmaImages({
    fileKey: classified.fileKey,
    nodeIds,
    pathForNode: nodeId => snapshotImagePath(REPO_ROOT, csId, nodeId),
  });

  const csDir = resolve(DIST_VIEWER_DIR, 'cs', csId);
  const imagesDir = resolve(csDir, 'images');
  mkdirSync(imagesDir, { recursive: true });

  const imageRefs: Record<string, ViewerImageRefs> = {};
  const manifestImageRefs: Record<string, { before: string | null; after: string | null }> = {};
  for (const nodeId of nodeIds) {
    const basePath = baselineImagePath(REPO_ROOT, nodeId);
    const headPath = snapshotImagePath(REPO_ROOT, csId, nodeId);
    const beforeName = imageFileNameForNodeId(nodeId).replace(/\.png$/, '-before.png');
    const afterName = imageFileNameForNodeId(nodeId).replace(/\.png$/, '-after.png');
    const beforeOut = resolve(imagesDir, beforeName);
    const afterOut = resolve(imagesDir, afterName);

    const beforeExists = existsSync(basePath);
    const afterExists = existsSync(headPath);
    if (beforeExists) copyFileSync(basePath, beforeOut);
    if (afterExists) copyFileSync(headPath, afterOut);

    imageRefs[nodeId] = {
      before: beforeExists ? `images/${beforeName}` : null,
      after: afterExists ? `images/${afterName}` : null,
    };
    manifestImageRefs[nodeId] = {
      before: beforeExists ? sha256File(basePath) : null,
      after: afterHashes[nodeId] ?? null,
    };
  }

  const viewerUrl = viewerUrlFor(process.env.FIGMA_VIEWER_BASE_URL, csId);
  const html = buildViewerHtml({
    csId,
    fileKey: classified.fileKey,
    issueUrl: manifest?.githubIssueUrl,
    classified,
    imageRefs,
  });
  writeFileSync(resolve(csDir, 'index.html'), html, 'utf-8');
  writeFileSync(resolve(DIST_VIEWER_DIR, 'index.html'), renderIndex(csId, viewerUrl), 'utf-8');

  if (manifest) {
    updateManifest(REPO_ROOT, csId, current => ({
      ...current,
      viewerUrl,
      imageRefs: { ...current.imageRefs, ...manifestImageRefs },
    }));
  }

  logger.success(`Viewer written: ${resolve(csDir, 'index.html')}`);
  if (viewerUrl) logger.info(`Viewer URL: ${viewerUrl}`);
}

function existsManifest(csId: string): boolean {
  return existsSync(resolve(REPO_ROOT, '.automation/cs', `${csId}.json`));
}

function latestCsIdFromManifest(): string | null {
  const dir = resolve(REPO_ROOT, '.automation/cs');
  if (!existsSync(dir)) return null;
  const latest = readdirSync(dir).filter(f => f.startsWith('cs-') && f.endsWith('.json')).sort().at(-1);
  return latest ? basename(latest, '.json') : null;
}

function renderIndex(csId: string, viewerUrl: string | undefined): string {
  const href = viewerUrl ?? `./cs/${csId}/`;
  return `<!doctype html><meta charset="utf-8"><title>Figma Review Viewer</title><h1>Figma Review Viewer</h1><p><a href="${href}">${csId}</a></p>\n`;
}

main().catch(err => {
  logger.error(String(err));
  process.exit(1);
});
