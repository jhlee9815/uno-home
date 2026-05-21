import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './lib/logger.ts';
import {
  loadFigmaConfig,
  loadFigmaMapping,
  ConfigError,
} from './lib/config-loader.ts';
import { fetchFigmaJson, FigmaApiError } from './lib/figma-api.ts';
import {
  buildSnapshotNodeEntry,
  type FigmaNodeDetail,
  type SnapshotNodeEntry,
} from './lib/snapshot-node.ts';
import {
  buildAuditReport,
  renderAuditMarkdown,
  type TopLevelFrameRef,
} from './lib/audit-aggregator.ts';
import {
  loadAuditState,
  saveAuditState,
  updateAuditState,
  pickAutoRegisterCandidates,
} from './lib/audit-state.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const AUDITS_DIR = resolve(REPO_ROOT, '.automation/audits');
const AUDIT_STATE_PATH = resolve(REPO_ROOT, '.automation/audit-state.json');
const AUTO_REGISTER_CANDIDATES_PATH = resolve(REPO_ROOT, '.automation/audit-candidates.json');
const AUTO_REGISTER_THRESHOLD = Number(process.env.FIGMA_AUDIT_REGISTER_THRESHOLD ?? '2');

const logger = createLogger('audit');

interface FigmaNodesApiResponse {
  nodes: Record<string, { document: FigmaNodeDetail; lastModified?: string } | null>;
  lastModified?: string;
}

interface FigmaShallowDocumentResponse {
  name?: string;
  lastModified?: string;
  document: {
    id: string;
    name: string;
    type: string;
    children?: Array<{
      id: string;
      name: string;
      type: string;
      children?: Array<{ id: string; name: string; type: string }>;
    }>;
  };
}

const TOP_LEVEL_FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET']);

async function fetchNodesById(
  fileKey: string,
  nodeIds: string[]
): Promise<FigmaNodesApiResponse> {
  const idsParam = nodeIds.join(',');
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`;
  return fetchFigmaJson<FigmaNodesApiResponse>(url);
}

async function fetchTopLevelFrames(fileKey: string): Promise<TopLevelFrameRef[]> {
  // depth=2 returns pages + their direct top-level children — enough for our audit.
  const url = `https://api.figma.com/v1/files/${fileKey}?depth=2`;
  const data = await fetchFigmaJson<FigmaShallowDocumentResponse>(url);
  const frames: TopLevelFrameRef[] = [];
  for (const page of data.document.children ?? []) {
    for (const child of page.children ?? []) {
      if (TOP_LEVEL_FRAME_TYPES.has(child.type)) {
        frames.push({ id: child.id, name: child.name });
      }
    }
  }
  return frames;
}

async function main(): Promise<void> {
  logger.info('Starting audit.ts — Figma DS compliance audit (baseline-independent)');

  let figmaConfig;
  let mapping;
  try {
    figmaConfig = loadFigmaConfig();
    mapping = loadFigmaMapping();
  } catch (err) {
    if (err instanceof ConfigError) logger.error(err.message);
    else logger.error(`Unexpected config error: ${String(err)}`);
    process.exit(1);
  }

  const { fileKey } = figmaConfig.figma;
  logger.info(`fileKey: ${fileKey}`);

  // Aggregate all registered entries
  const allEntries = [
    ...Object.entries(mapping.components),
    ...Object.entries(mapping.compositions),
    ...Object.entries(mapping.screens),
  ];
  const targets = allEntries
    .map(([key, entry]) => ({ key, nodeId: entry.figmaNodeId as string }))
    .filter(t => Boolean(t.nodeId));
  logger.info(`Registered roots to audit: ${targets.length}`);

  // 1. Fetch snapshot of registered roots
  let nodeResponse: FigmaNodesApiResponse;
  let topLevelFrames: TopLevelFrameRef[];
  try {
    [nodeResponse, topLevelFrames] = await Promise.all([
      fetchNodesById(fileKey, targets.map(t => t.nodeId)),
      fetchTopLevelFrames(fileKey),
    ]);
  } catch (err) {
    if (err instanceof FigmaApiError) logger.error(err.message);
    else logger.error(`Unexpected Figma API error: ${String(err)}`);
    process.exit(1);
  }

  logger.info(`Top-level frames discovered on the file: ${topLevelFrames.length}`);

  const fileLastModified = nodeResponse.lastModified ?? new Date().toISOString();

  // 2. Build snapshot entries (just like snapshot.ts does)
  const snapshotNodes: Record<string, SnapshotNodeEntry> = {};
  for (const { key, nodeId } of targets) {
    const node = nodeResponse.nodes[nodeId];
    if (!node) {
      logger.warn(`[${key}] node id ${nodeId} not returned by Figma API — skipping`);
      continue;
    }
    snapshotNodes[key] = buildSnapshotNodeEntry(node.document, fileLastModified, key);
  }

  // 3. Aggregate
  const generatedAt = new Date().toISOString();
  const report = buildAuditReport({
    fileKey,
    snapshotNodes,
    mapping,
    topLevelFrames,
    generatedAt,
  });

  // 4. Update audit-state.json (sighting counter for unregistered frames)
  const prevState = loadAuditState(AUDIT_STATE_PATH);
  const nextState = updateAuditState(prevState, report.unregisteredTopLevelFrames, generatedAt);
  saveAuditState(AUDIT_STATE_PATH, nextState);

  const candidates = pickAutoRegisterCandidates(nextState, {
    thresholdSightings: AUTO_REGISTER_THRESHOLD,
  });
  // Always write candidates file (empty array if none) so downstream steps can
  // depend on its existence without conditional branches.
  writeFileSync(
    AUTO_REGISTER_CANDIDATES_PATH,
    JSON.stringify({ generatedAt, threshold: AUTO_REGISTER_THRESHOLD, candidates }, null, 2) + '\n',
    'utf-8'
  );
  logger.info(
    `State: tracked unregistered=${Object.keys(nextState.unregisteredFrames).length}, auto-register candidates=${candidates.length} (threshold=${AUTO_REGISTER_THRESHOLD})`
  );

  // 5. Write report outputs
  mkdirSync(AUDITS_DIR, { recursive: true });
  const safeTs = generatedAt.replace(/:/g, '-').replace(/\..+$/, '');
  const mdPath = resolve(AUDITS_DIR, `audit-${safeTs}.md`);
  const jsonPath = resolve(AUDITS_DIR, `audit-${safeTs}.json`);
  writeFileSync(mdPath, renderAuditMarkdown(report), 'utf-8');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  logger.success(`Audit written: ${mdPath}`);
  logger.info(
    `Summary: detached=${report.totalDetachedStyles}, unregistered top-level=${report.totalUnregisteredTopLevelFrames}, violations=${report.hasViolations}`
  );

  // 6. Surface output paths so callers (CI / Slack) can consume
  if (process.env.GITHUB_OUTPUT) {
    const out = [
      `audit_md=${mdPath}`,
      `audit_json=${jsonPath}`,
      `audit_state=${AUDIT_STATE_PATH}`,
      `auto_register_candidates=${AUTO_REGISTER_CANDIDATES_PATH}`,
      `has_violations=${report.hasViolations}`,
      `detached_total=${report.totalDetachedStyles}`,
      `unregistered_total=${report.totalUnregisteredTopLevelFrames}`,
      `auto_register_count=${candidates.length}`,
    ].join('\n');
    try {
      const cur = existsSync(process.env.GITHUB_OUTPUT) ? readFileSync(process.env.GITHUB_OUTPUT, 'utf-8') : '';
      writeFileSync(process.env.GITHUB_OUTPUT, `${cur}${out}\n`, 'utf-8');
    } catch (err) {
      logger.warn(`Could not write GITHUB_OUTPUT: ${String(err)}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  const fallback = createLogger('audit');
  fallback.error(`Unhandled error: ${String(err)}`);
  process.exit(1);
});
