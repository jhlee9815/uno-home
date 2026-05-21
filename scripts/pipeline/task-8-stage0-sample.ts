import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLogger } from './lib/logger.ts';
import { loadFigmaConfig } from './lib/config-loader.ts';
import { fetchFigmaJson } from './lib/figma-api.ts';

const logger = createLogger('task-8-stage0-sample');
const OUT_DIR = resolve(process.cwd(), '.automation/task-8-stage0');
const DEFAULT_NODE_IDS = ['7:3', '7:4', '7:5', '10:62'];
const NODE_IDS = (process.env.TASK8_SAMPLE_NODE_IDS?.trim() || DEFAULT_NODE_IDS.join(','))
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

interface FigmaNodesApiResponse {
  nodes: Record<string, { document: FigmaNodeDetail } | null>;
}

interface FigmaNodeDetail {
  id: string;
  name: string;
  type: string;
  children?: FigmaNodeDetail[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: unknown[];
  boundVariables?: Record<string, unknown>;
  fillStyleId?: string;
  strokeStyleId?: string;
  textStyleId?: string;
  effectStyleId?: string;
  style?: Record<string, unknown>;
  componentProperties?: Record<string, FigmaComponentProperty>;
}

interface FigmaPaint {
  type?: string;
  imageRef?: string;
  boundVariables?: Record<string, unknown>;
  color?: unknown;
  visible?: boolean;
}

interface FigmaComponentProperty {
  type?: string;
  value?: unknown;
  boundVariables?: Record<string, unknown>;
}

interface FieldHit {
  rootId: string;
  nodeId: string;
  path: string[];
  type: string;
  fields: Record<string, unknown>;
}

interface RootSummary {
  nodeId: string;
  returned: boolean;
  name: string | null;
  type: string | null;
  totalDescendants: number;
  counts: Record<string, number>;
}

interface Stage0Summary {
  collectedAt: string;
  fileKey: string;
  requestedNodeIds: string[];
  roots: RootSummary[];
  hits: FieldHit[];
  conclusions: string[];
}

function walk(
  rootId: string,
  node: FigmaNodeDetail,
  path: string[] = [node.name]
): { total: number; hits: FieldHit[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {
    boundVariables: 0,
    fillStyleId: 0,
    strokeStyleId: 0,
    textStyleId: 0,
    effectStyleId: 0,
    imageRef: 0,
    instanceSwap: 0,
    rawColorPaint: 0,
    textStyleObject: 0,
  };
  const hits: FieldHit[] = [];

  function inc(name: keyof typeof counts): void {
    counts[name] += 1;
  }

  function addHit(target: FigmaNodeDetail, targetPath: string[], fields: Record<string, unknown>): void {
    hits.push({
      rootId,
      nodeId: target.id,
      path: targetPath,
      type: target.type,
      fields,
    });
  }

  function visit(current: FigmaNodeDetail, currentPath: string[]): number {
    const fields: Record<string, unknown> = {};

    if (current.boundVariables) {
      inc('boundVariables');
      fields.boundVariablesKeys = Object.keys(current.boundVariables).sort();
    }
    for (const key of ['fillStyleId', 'strokeStyleId', 'textStyleId', 'effectStyleId'] as const) {
      const value = current[key];
      if (typeof value === 'string' && value.length > 0) {
        inc(key);
        fields[key] = value;
      }
    }
    if (current.style && current.type === 'TEXT') {
      inc('textStyleObject');
      fields.textStyleKeys = Object.keys(current.style).sort();
    }

    const paints = [...(current.fills ?? []), ...(current.strokes ?? [])];
    const imageRefs = paints
      .map((paint, paintIndex) => ({ paintIndex, type: paint.type, imageRef: paint.imageRef }))
      .filter(paint => typeof paint.imageRef === 'string' && paint.imageRef.length > 0);
    if (imageRefs.length > 0) {
      counts.imageRef += imageRefs.length;
      fields.imageRefs = imageRefs;
    }

    const rawColorPaints = paints
      .map((paint, paintIndex) => ({
        paintIndex,
        type: paint.type,
        hasColor: paint.color !== undefined,
        hasBoundVariables: paint.boundVariables !== undefined,
      }))
      .filter(paint => paint.hasColor);
    if (rawColorPaints.length > 0) {
      counts.rawColorPaint += rawColorPaints.length;
      fields.rawColorPaints = rawColorPaints;
    }

    const instanceSwaps = Object.entries(current.componentProperties ?? {})
      .filter(([, prop]) => prop.type === 'INSTANCE_SWAP')
      .map(([name, prop]) => ({ name, valueType: typeof prop.value, hasBoundVariables: !!prop.boundVariables }));
    if (instanceSwaps.length > 0) {
      counts.instanceSwap += instanceSwaps.length;
      fields.instanceSwaps = instanceSwaps;
    }

    if (Object.keys(fields).length > 0) {
      addHit(current, currentPath, fields);
    }

    let total = 1;
    for (const child of current.children ?? []) {
      total += visit(child, [...currentPath, child.name]);
    }
    return total;
  }

  const total = visit(node, path);
  return { total, hits, counts };
}

function addCounts(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function buildConclusions(roots: RootSummary[]): string[] {
  const aggregate: Record<string, number> = {};
  for (const root of roots) addCounts(aggregate, root.counts);

  return [
    aggregate.boundVariables > 0
      ? `boundVariables present on ${aggregate.boundVariables} nodes; detached-style can use boundVariables absence as a signal.`
      : 'boundVariables not observed in this sample; detached-style v1 must fall back to styleId/raw-value heuristics.',
    aggregate.fillStyleId + aggregate.strokeStyleId + aggregate.textStyleId + aggregate.effectStyleId > 0
      ? `style IDs present: fill=${aggregate.fillStyleId ?? 0}, stroke=${aggregate.strokeStyleId ?? 0}, text=${aggregate.textStyleId ?? 0}, effect=${aggregate.effectStyleId ?? 0}.`
      : 'style IDs not observed in this sample; token binding may be absent or not exposed for these nodes.',
    aggregate.imageRef > 0
      ? `IMAGE imageRef present ${aggregate.imageRef} time(s); v1 image-change detection is feasible for image fills.`
      : 'No imageRef observed in this sample; image-change fixture is still required before implementation.',
    aggregate.instanceSwap > 0
      ? `INSTANCE_SWAP component properties present ${aggregate.instanceSwap} time(s); keep as v2/non-v1 unless explicitly added.`
      : 'No INSTANCE_SWAP observed in this sample; task-8 v1 image-only scope remains appropriate.',
    roots.every(root => root.returned)
      ? 'All requested nodes returned from Figma Nodes API.'
      : 'At least one requested node was not returned; mapping/sample IDs need review.',
  ];
}

async function main(): Promise<void> {
  const { figma } = loadFigmaConfig();
  const idsParam = NODE_IDS.join(',');
  const url = `https://api.figma.com/v1/files/${figma.fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`;

  logger.info(`Fetching task-8 Stage 0 sample for ${NODE_IDS.length} node(s)`);
  const response = await fetchFigmaJson<FigmaNodesApiResponse>(url);

  const roots: RootSummary[] = [];
  const hits: FieldHit[] = [];

  for (const nodeId of NODE_IDS) {
    const document = response.nodes[nodeId]?.document;
    if (!document) {
      roots.push({
        nodeId,
        returned: false,
        name: null,
        type: null,
        totalDescendants: 0,
        counts: {},
      });
      continue;
    }

    const result = walk(nodeId, document);
    roots.push({
      nodeId,
      returned: true,
      name: document.name,
      type: document.type,
      totalDescendants: result.total,
      counts: result.counts,
    });
    hits.push(...result.hits);
  }

  const collectedAt = new Date().toISOString();
  const summary: Stage0Summary = {
    collectedAt,
    fileKey: figma.fileKey,
    requestedNodeIds: NODE_IDS,
    roots,
    hits,
    conclusions: buildConclusions(roots),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = collectedAt.replace(/[:.]/g, '-');
  const jsonPath = resolve(OUT_DIR, `figma-api-field-summary-${stamp}.json`);
  const latestPath = resolve(OUT_DIR, 'latest-summary.json');
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(latestPath, JSON.stringify(summary, null, 2) + '\n');

  for (const root of roots) {
    logger.info(
      `${root.nodeId} ${root.returned ? 'returned' : 'missing'} ${root.name ?? ''} descendants=${root.totalDescendants}`
    );
  }
  for (const conclusion of summary.conclusions) {
    logger.info(`Conclusion: ${conclusion}`);
  }
  logger.success(`Stage 0 summary written: ${jsonPath}`);
}

main().catch(err => {
  logger.error(String(err));
  process.exit(1);
});
