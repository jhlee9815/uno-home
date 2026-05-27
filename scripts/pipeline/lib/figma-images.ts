import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fetchFigmaJson } from './figma-api.ts';

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export interface FigmaImagesOptions {
  format?: 'png' | 'jpg' | 'svg' | 'pdf';
  scale?: number;
}

export function imageFileNameForNodeId(nodeId: string): string {
  return nodeId.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') + '.png';
}

export function baselineImagePath(repoRoot: string, nodeId: string): string {
  return resolve(repoRoot, '.automation/images/baseline', imageFileNameForNodeId(nodeId));
}

export function snapshotImagePath(repoRoot: string, csId: string, nodeId: string): string {
  return resolve(repoRoot, '.automation/images/snapshots', csId, imageFileNameForNodeId(nodeId));
}

export function buildFigmaImagesUrl(
  fileKey: string,
  nodeIds: string[],
  options: FigmaImagesOptions = {}
): string {
  const format = options.format ?? 'png';
  const scale = options.scale ?? 2;
  const ids = nodeIds.join(',');
  return `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`;
}

export async function fetchFigmaImageUrls(
  fileKey: string,
  nodeIds: string[],
  options: FigmaImagesOptions = {}
): Promise<Record<string, string | null>> {
  if (nodeIds.length === 0) return {};
  const response = await fetchFigmaJson<FigmaImagesResponse>(buildFigmaImagesUrl(fileKey, nodeIds, options));
  if (response.err) {
    throw new Error(`Figma images API error: ${response.err}`);
  }
  return response.images;
}

export async function downloadImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Image download failed ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function saveImageBuffer(path: string, buffer: Buffer): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  return 'sha256:' + createHash('sha256').update(buffer).digest('hex');
}

// Read-only counterpart to `promoteSnapshotImagesToBaseline` — returns the
// nodeIds that WOULD be promoted without touching the filesystem. Used by
// dry-run paths that must report intent without mutating the working tree
// (e.g. CI dry-runs that assert no diff after running the pipeline).
export function listSnapshotImageNodeIdsForCs(repoRoot: string, csId: string): string[] {
  const sourceDir = resolve(repoRoot, '.automation/images/snapshots', csId);
  if (!existsSync(sourceDir)) return [];
  return readdirSync(sourceDir)
    .filter(entry => entry.endsWith('.png'))
    .map(entry => basename(entry, '.png'));
}

// Copy every PNG captured during a cs into the baseline image directory so
// that promoting a cs's snapshot.json as the new design baseline also updates
// the matching reference images. Without this, the baseline JSON drifts ahead
// of the images and `viewer-gen` keeps rendering stale (or missing) "before"
// thumbnails for nodes whose first capture happened mid-cycle.
export function promoteSnapshotImagesToBaseline(repoRoot: string, csId: string): string[] {
  const sourceDir = resolve(repoRoot, '.automation/images/snapshots', csId);
  if (!existsSync(sourceDir)) return [];
  const baselineDir = resolve(repoRoot, '.automation/images/baseline');
  mkdirSync(baselineDir, { recursive: true });
  const copied: string[] = [];
  for (const entry of readdirSync(sourceDir)) {
    if (!entry.endsWith('.png')) continue;
    copyFileSync(resolve(sourceDir, entry), resolve(baselineDir, entry));
    copied.push(basename(entry, '.png'));
  }
  return copied;
}

export async function fetchAndSaveFigmaImages(input: {
  fileKey: string;
  nodeIds: string[];
  pathForNode: (nodeId: string) => string;
  options?: FigmaImagesOptions;
}): Promise<Record<string, string | null>> {
  const urls = await fetchFigmaImageUrls(input.fileKey, input.nodeIds, input.options);
  const hashes: Record<string, string | null> = {};
  for (const nodeId of input.nodeIds) {
    const url = urls[nodeId];
    if (!url) {
      hashes[nodeId] = null;
      continue;
    }
    const buffer = await downloadImageBuffer(url);
    hashes[nodeId] = saveImageBuffer(input.pathForNode(nodeId), buffer);
  }
  return hashes;
}
