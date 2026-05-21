import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
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
  buildMissingSnapshotNodeEntry,
  buildSnapshotNodeEntry,
  sha256,
  type FigmaNodeDetail,
  type SnapshotNodeEntry,
} from './lib/snapshot-node.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const SNAPSHOTS_DIR = resolve(REPO_ROOT, '.automation/snapshots');

const logger = createLogger('snapshot');

// ── Type definitions for Figma Nodes API response ────────────────────────────

interface FigmaNodesApiResponse {
  nodes: Record<
    string,
    {
      document: FigmaNodeDetail;
      lastModified?: string;
    } | null
  >;
  // top-level lastModified is also returned by the file metadata endpoint
  lastModified?: string;
}

// ── Snapshot output schema ────────────────────────────────────────────────────

interface SnapshotFile {
  fileKey: string;
  fileKeys: string[];
  timestamp: string;
  source: 'figma-rest';
  tokensHash: string;
  nodes: Record<string, SnapshotNodeEntry>;
}

interface SnapshotTarget {
  key: string;
  fileKey: string;
  nodeId: string;
}

// ── Figma Nodes API call ──────────────────────────────────────────────────────

/**
 * Fetch multiple nodes in a single REST call.
 * Uses GET /v1/files/{key}/nodes?ids=id1,id2,...
 * This is more efficient than a full file fetch when we only need mapped nodes.
 * Trade-off: the full file fetch (`fetchFigmaFile`) gives us `lastModified`
 * at file level, but nodes API gives per-node document without `lastModified`.
 * We use the file-level lastModified from a lightweight /v1/files call instead
 * of fetching the entire document tree (saves bandwidth for large files).
 */
async function fetchNodesById(
  fileKey: string,
  nodeIds: string[]
): Promise<FigmaNodesApiResponse> {
  // Comma-separated ids (Figma API requirement)
  const idsParam = nodeIds.join(',');
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`;
  return fetchFigmaJson<FigmaNodesApiResponse>(url);
}

/**
 * Fetch file metadata (lastModified, name) without the full document tree.
 * Uses ?depth=1 to minimise payload.
 */
async function fetchFileLastModified(fileKey: string): Promise<string> {
  const url = `https://api.figma.com/v1/files/${fileKey}?depth=1`;
  const meta = await fetchFigmaJson<Record<string, unknown>>(url);
  return typeof meta.lastModified === 'string' ? meta.lastModified : new Date().toISOString();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info('Starting snapshot.ts — Figma node state capture');

  // 1. Load configs
  let figmaConfig;
  try {
    figmaConfig = loadFigmaConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error(err.message);
    } else {
      logger.error(`Unexpected error loading figma.yaml: ${String(err)}`);
    }
    process.exit(1);
  }

  let mapping;
  try {
    mapping = loadFigmaMapping();
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error(err.message);
    } else {
      logger.error(`Unexpected error loading figma-mapping.yaml: ${String(err)}`);
    }
    process.exit(1);
  }

  const { fileKey } = figmaConfig.figma;
  logger.info(`default fileKey: ${fileKey}`);

  // 2. Collect all mapping entries (components + compositions + screens)
  const allEntries = [
    ...Object.entries(mapping.components),
    ...Object.entries(mapping.compositions),
    ...Object.entries(mapping.screens),
  ];

  // Verify all node IDs are filled
  const missingIds = allEntries.filter(([, e]) => !e.figmaNodeId);
  if (missingIds.length > 0) {
    logger.error(
      `${missingIds.length} entries missing figmaNodeId: ${missingIds.map(([k]) => k).join(', ')}`
    );
    logger.error('Run `npm run figma:bind` first.');
    process.exit(1);
  }

  const targets: SnapshotTarget[] = allEntries.map(([key, entry]) => ({
    key,
    fileKey: entry.figmaFileKey || fileKey,
    nodeId: entry.figmaNodeId as string,
  }));
  const targetsByFile = groupTargetsByFile(targets);
  logger.info(
    `Fetching ${targets.length} nodes from ${targetsByFile.size} Figma file(s)...`
  );

  // 3. Fetch nodes + file lastModified by fileKey
  let nodesByFile: Map<string, FigmaNodesApiResponse>;
  let lastModifiedByFile: Map<string, string>;
  try {
    const fileResults = await Promise.all(
      [...targetsByFile.entries()].map(async ([targetFileKey, fileTargets]) => {
        const [nodesResponse, fileLastModified] = await Promise.all([
          fetchNodesById(targetFileKey, fileTargets.map(target => target.nodeId)),
          fetchFileLastModified(targetFileKey),
        ]);
        return { fileKey: targetFileKey, nodesResponse, fileLastModified };
      })
    );
    nodesByFile = new Map(fileResults.map(result => [result.fileKey, result.nodesResponse]));
    lastModifiedByFile = new Map(fileResults.map(result => [result.fileKey, result.fileLastModified]));
  } catch (err) {
    if (err instanceof FigmaApiError) {
      logger.error(err.message);
    } else {
      logger.error(`Unexpected error fetching Figma data: ${String(err)}`);
    }
    process.exit(1);
  }

  const fetchedNodeCount = [...nodesByFile.values()].reduce(
    (sum, response) => sum + Object.keys(response.nodes).length,
    0
  );
  logger.success(`Fetched ${fetchedNodeCount} nodes`);

  // 4. Hash the tokens file
  const tokensSourceFile = mapping.tokens.source.file;
  // tokens.source.file is relative to config/ dir; config/ is at REPO_ROOT/config/
  const tokensAbsPath = resolve(REPO_ROOT, 'config', tokensSourceFile);
  let tokensHashValue: string;
  if (existsSync(tokensAbsPath)) {
    const tokensContent = readFileSync(tokensAbsPath, 'utf-8');
    tokensHashValue = sha256(tokensContent);
    logger.info(`Tokens file hashed: ${tokensAbsPath}`);
  } else {
    logger.warn(`tokens.json not found at ${tokensAbsPath} — recording empty hash`);
    tokensHashValue = sha256('');
  }

  // 5. Build snapshot nodes map
  const snapshotNodes: Record<string, SnapshotNodeEntry> = {};
  let fetchedCount = 0;
  let missingCount = 0;

  for (const [key, entry] of allEntries) {
    const nodeId = entry.figmaNodeId as string;
    const entryFileKey = entry.figmaFileKey || fileKey;
    const nodeData = nodesByFile.get(entryFileKey)?.nodes[nodeId];
    const fileLastModified = lastModifiedByFile.get(entryFileKey) ?? new Date().toISOString();

    if (!nodeData) {
      logger.warn(`[${key}] node id ${nodeId} not returned by Figma API — may be deleted`);
      missingCount++;
      // Record placeholder so 5-3 diff can flag this as a deletion
      snapshotNodes[key] = buildMissingSnapshotNodeEntry(
        nodeId,
        entry.figmaNodeName ?? key,
        fileLastModified
      );
      continue;
    }

    const doc = nodeData.document;
    // Nodes API doesn't expose per-node lastModified; use file-level value.
    snapshotNodes[key] = buildSnapshotNodeEntry(doc, fileLastModified, key);
    fetchedCount++;
  }

  logger.info(`Nodes captured: ${fetchedCount}, missing from API: ${missingCount}`);

  // 6. Assemble and write snapshot JSON
  const timestamp = new Date().toISOString();
  const snapshot: SnapshotFile = {
    fileKey,
    fileKeys: [...targetsByFile.keys()].sort(),
    timestamp,
    source: 'figma-rest',
    tokensHash: tokensHashValue,
    nodes: snapshotNodes,
  };

  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  // Filename: timestamp with colons replaced for filesystem compatibility
  const safeTs = timestamp.replace(/:/g, '-').replace(/\..+$/, '');
  const outputPath = resolve(SNAPSHOTS_DIR, `${safeTs}.json`);

  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  logger.success(`Snapshot written: ${outputPath}`);
  logger.info(`Nodes in snapshot: ${Object.keys(snapshotNodes).length}`);

  process.exit(0);
}

function groupTargetsByFile(targets: SnapshotTarget[]): Map<string, SnapshotTarget[]> {
  const grouped = new Map<string, SnapshotTarget[]>();
  for (const target of targets) {
    const existing = grouped.get(target.fileKey) ?? [];
    existing.push(target);
    grouped.set(target.fileKey, existing);
  }
  return grouped;
}

main().catch(err => {
  const logger2 = createLogger('snapshot');
  logger2.error(`Unhandled error: ${String(err)}`);
  process.exit(1);
});
