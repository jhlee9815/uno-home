import type { SnapshotNodeEntry } from './snapshot-node.ts';
import type {
  AssetRefChange,
  ComplianceDiffSummary,
  DescendantFrameEntry,
  DetachedStyleEntry,
} from './compliance-types.ts';
import {
  assetRefStableKey,
  detachedStyleStableKey,
  frameStableKey,
} from './compliance-types.ts';

export type ChangeClass =
  | 'token'
  | 'text'
  | 'component-props'
  | 'asset'
  | 'layout'
  | 'structure'
  | 'unknown'
  | 'detached-style'
  | 'new-frame'
  | 'image-change';

export type ComparisonMode = 'baseline' | 'bootstrap-latest-two';

export interface SnapshotFile {
  fileKey: string;
  fileKeys?: string[];
  timestamp: string;
  source: 'figma-rest';
  tokensHash: string;
  nodes: Record<string, Partial<SnapshotNodeEntry> & Pick<SnapshotNodeEntry, 'id' | 'name'>>;
}

export interface SnapshotPair {
  comparisonMode: ComparisonMode;
  baseFile: string;
  headFile: string;
}

export interface DiffChange {
  key: string;
  nodeId: string | null;
  nodeName: string;
  classes: ChangeClass[];
  reasons: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  compliance?: ComplianceDiffSummary;
}

export interface DiffFile {
  stage: 'diff';
  generatedAt: string;
  fileKey: string;
  fileKeys?: string[];
  comparisonMode: ComparisonMode;
  baseTs: string;
  headTs: string;
  basePath: string;
  headPath: string;
  changes: DiffChange[];
}

interface DiffOptions {
  comparisonMode: ComparisonMode;
  basePath: string;
  headPath: string;
  generatedAt?: string;
}

export function selectSnapshotPair(
  snapshotFiles: string[],
  baselineFiles: string[]
): SnapshotPair | null {
  const snapshots = snapshotFiles.filter(isJsonFile).sort();
  const baselines = baselineFiles.filter(isJsonFile).sort();

  if (snapshots.length === 0) {
    return null;
  }

  const headFile = snapshots.at(-1) as string;
  const baselineFile = baselines.at(-1);
  if (baselineFile) {
    return {
      comparisonMode: 'baseline',
      baseFile: baselineFile,
      headFile,
    };
  }

  if (snapshots.length < 2) {
    return null;
  }

  return {
    comparisonMode: 'bootstrap-latest-two',
    baseFile: snapshots[snapshots.length - 2],
    headFile,
  };
}

export function diffSnapshots(
  base: SnapshotFile,
  head: SnapshotFile,
  options: DiffOptions
): DiffFile {
  const changes: DiffChange[] = [];

  if (base.tokensHash !== head.tokensHash) {
    changes.push({
      key: 'tokens',
      nodeId: null,
      nodeName: 'tokens.json',
      classes: ['token'],
      reasons: ['tokensHash changed'],
      before: { tokensHash: base.tokensHash },
      after: { tokensHash: head.tokensHash },
    });
  }

  for (const key of sortedUniqueKeys(base.nodes, head.nodes)) {
    const beforeNode = base.nodes[key];
    const afterNode = head.nodes[key];

    if (!beforeNode) {
      const compliance = diffCompliance(undefined, afterNode);
      const classes: ChangeClass[] = ['structure'];
      const reasons: string[] = [`Node '${key}' missing from base snapshot`];
      if (compliance.newDetachedStyles.length > 0) {
        classes.push('detached-style');
        reasons.push(`${compliance.newDetachedStyles.length} new detached style(s) on newly added node`);
      }
      if (compliance.newFrames.length > 0) {
        classes.push('new-frame');
        reasons.push(`${compliance.newFrames.length} new descendant frame(s) on newly added node`);
      }
      if (compliance.changedImageRefs.length > 0) {
        classes.push('image-change');
        reasons.push(`${compliance.changedImageRefs.length} image asset(s) on newly added node`);
      }
      const hasCompliance =
        compliance.newDetachedStyles.length > 0 ||
        compliance.newFrames.length > 0 ||
        compliance.changedImageRefs.length > 0;
      const change: DiffChange = {
        key,
        nodeId: afterNode.id,
        nodeName: afterNode.name,
        classes,
        reasons,
        before: {},
        after: summarizeNode(afterNode),
      };
      if (hasCompliance) change.compliance = compliance;
      changes.push(change);
      continue;
    }

    if (!afterNode) {
      changes.push({
        key,
        nodeId: beforeNode.id,
        nodeName: beforeNode.name,
        classes: ['structure'],
        reasons: [`Node '${key}' missing from head snapshot`],
        before: summarizeNode(beforeNode),
        after: {},
      });
      continue;
    }

    const classes: ChangeClass[] = [];
    const reasons: string[] = [];

    if (hashChanged(beforeNode.textHash, afterNode.textHash)) {
      classes.push('text');
      reasons.push('textHash changed');
    }

    if (hashChanged(beforeNode.componentPropsHash, afterNode.componentPropsHash)) {
      classes.push('component-props');
      reasons.push('componentPropsHash changed');
    }

    if (hashChanged(beforeNode.propsHash, afterNode.propsHash)) {
      classes.push('asset');
      reasons.push('propsHash changed');
    }

    if (beforeNode.boundingBox === null || afterNode.boundingBox === null) {
      if (beforeNode.boundingBox !== afterNode.boundingBox) {
        classes.push('structure');
        reasons.push('boundingBox changed to or from null');
      }
    } else if (!sameBoundingBox(beforeNode.boundingBox, afterNode.boundingBox)) {
      classes.push('layout');
      reasons.push('boundingBox changed');
    }

    const compliance = diffCompliance(beforeNode, afterNode);
    if (compliance.newDetachedStyles.length > 0) {
      classes.push('detached-style');
      reasons.push(`${compliance.newDetachedStyles.length} new detached style(s)`);
    }
    if (compliance.newFrames.length > 0) {
      classes.push('new-frame');
      reasons.push(`${compliance.newFrames.length} new descendant frame(s)`);
    }
    if (compliance.changedImageRefs.length > 0) {
      classes.push('image-change');
      reasons.push(`${compliance.changedImageRefs.length} image asset change(s)`);
    }
    const hasCompliance =
      compliance.newDetachedStyles.length > 0 ||
      compliance.newFrames.length > 0 ||
      compliance.changedImageRefs.length > 0;

    if (classes.length > 0) {
      const change: DiffChange = {
        key,
        nodeId: afterNode.id,
        nodeName: afterNode.name,
        classes: dedupeClasses(classes),
        reasons,
        before: summarizeNode(beforeNode),
        after: summarizeNode(afterNode),
      };
      if (hasCompliance) change.compliance = compliance;
      changes.push(change);
    }
  }

  return {
    stage: 'diff',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    fileKey: head.fileKey,
    fileKeys: head.fileKeys,
    comparisonMode: options.comparisonMode,
    baseTs: base.timestamp,
    headTs: head.timestamp,
    basePath: options.basePath,
    headPath: options.headPath,
    changes,
  };
}

function summarizeNode(node: Partial<SnapshotNodeEntry> & Pick<SnapshotNodeEntry, 'id' | 'name'>): Record<string, unknown> {
  return {
    id: node.id,
    name: node.name,
    boundingBox: node.boundingBox ?? null,
    textHash: node.textHash ?? null,
    propsHash: node.propsHash ?? null,
    componentPropsHash: node.componentPropsHash ?? null,
  };
}

function sameBoundingBox(
  a: SnapshotNodeEntry['boundingBox'] | undefined,
  b: SnapshotNodeEntry['boundingBox'] | undefined
): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function hashChanged(before: string | undefined, after: string | undefined): boolean {
  return typeof before === 'string' && typeof after === 'string' && before !== after;
}

function sortedUniqueKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
}

function dedupeClasses(classes: ChangeClass[]): ChangeClass[] {
  return [...new Set(classes)];
}

function isJsonFile(file: string): boolean {
  return file.endsWith('.json') && !file.endsWith('-classified.json');
}

type ComplianceSnapshot = Pick<
  SnapshotNodeEntry,
  'detachedStyles' | 'descendantFrames' | 'assetRefs'
>;

function emptyComplianceFields(): ComplianceSnapshot {
  return { detachedStyles: [], descendantFrames: [], assetRefs: [] };
}

function hasComplianceFields(node: Partial<SnapshotNodeEntry> | undefined): boolean {
  return (
    node !== undefined &&
    Array.isArray(node.detachedStyles) &&
    Array.isArray(node.descendantFrames) &&
    Array.isArray(node.assetRefs)
  );
}

function getCompliance(node: Partial<SnapshotNodeEntry> | undefined): ComplianceSnapshot {
  if (!node) return emptyComplianceFields();
  return {
    detachedStyles: node.detachedStyles ?? [],
    descendantFrames: node.descendantFrames ?? [],
    assetRefs: node.assetRefs ?? [],
  };
}

export function diffCompliance(
  base: Partial<SnapshotNodeEntry> | undefined,
  head: Partial<SnapshotNodeEntry> | undefined
): ComplianceDiffSummary {
  // Task 8 adds compliance arrays to SnapshotNodeEntry. Older approved baselines
  // do not have those arrays, so treating them as empty would flood the first
  // upgraded run with every existing raw style/frame/image as "new". Skip
  // compliance diff until the registered node has a schema-compatible baseline.
  if (base !== undefined && !hasComplianceFields(base)) {
    return emptyComplianceFieldsForDiff();
  }

  const b = getCompliance(base);
  const h = getCompliance(head);

  const baseDetachedKeys = new Set(b.detachedStyles.map(detachedStyleStableKey));
  const newDetachedStyles: DetachedStyleEntry[] = h.detachedStyles.filter(
    entry => !baseDetachedKeys.has(detachedStyleStableKey(entry))
  );

  const baseFrameKeys = new Set(b.descendantFrames.map(frameStableKey));
  const newFrames: DescendantFrameEntry[] = h.descendantFrames.filter(
    entry => !baseFrameKeys.has(frameStableKey(entry))
  );

  const baseAssetByKey = new Map(b.assetRefs.map(entry => [assetRefStableKey(entry), entry]));
  const changedImageRefs: AssetRefChange[] = [];
  for (const headEntry of h.assetRefs) {
    const key = assetRefStableKey(headEntry);
    const baseEntry = baseAssetByKey.get(key);
    if (!baseEntry) {
      changedImageRefs.push({ before: null, after: headEntry });
    } else if (baseEntry.ref !== headEntry.ref) {
      changedImageRefs.push({ before: baseEntry, after: headEntry });
    }
  }

  return { newDetachedStyles, newFrames, changedImageRefs };
}

function emptyComplianceFieldsForDiff(): ComplianceDiffSummary {
  return { newDetachedStyles: [], newFrames: [], changedImageRefs: [] };
}
