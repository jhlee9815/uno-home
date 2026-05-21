import type { ClassifiedDiffFile } from './classify-diff.ts';
import type { SnapshotFile } from './diff-snapshot.ts';
import type { SnapshotComponentPropLeaf, SnapshotTextLeaf } from './snapshot-node.ts';

export interface TextUpdate {
  key: string;
  nodeId: string;
  value: string;
  code: string;
}

export interface ComponentPropUpdate {
  key: string;
  nodeId: string;
  propName: string;
  value: unknown;
  code: string;
}

export interface ApplyMarkedSourceResult {
  changed: boolean;
  source: string;
  appliedNodeIds: string[];
  missingNodeIds: string[];
}

export type ExtractDecision = 'auto-apply' | 'report-only';

export interface ExtractOptions {
  decisionFilter?: readonly ExtractDecision[];
}

const DEFAULT_DECISION_FILTER: readonly ExtractDecision[] = ['auto-apply'];

interface Marker {
  kind: 'text' | 'prop';
  start: number;
  end: number;
  attrs: Record<string, string>;
}

export function extractTextUpdates(
  classified: ClassifiedDiffFile,
  base: SnapshotFile,
  head: SnapshotFile,
  options: ExtractOptions = {}
): TextUpdate[] {
  const filter = options.decisionFilter ?? DEFAULT_DECISION_FILTER;
  const updates: TextUpdate[] = [];

  for (const change of classified.changes) {
    if (!filter.includes(change.decision) || !change.classes.includes('text') || !change.target.code) {
      continue;
    }

    const beforeTexts = mapTextsByNodeId(base.nodes[change.key]?.texts ?? []);
    const afterTexts = mapTextsByNodeId(head.nodes[change.key]?.texts ?? []);

    for (const [nodeId, after] of afterTexts) {
      const before = beforeTexts.get(nodeId);
      if (!before || before.value === after.value) {
        continue;
      }

      updates.push({
        key: change.key,
        nodeId,
        value: after.value,
        code: change.target.code,
      });
    }
  }

  return updates;
}

export function extractComponentPropUpdates(
  classified: ClassifiedDiffFile,
  base: SnapshotFile,
  head: SnapshotFile,
  options: ExtractOptions = {}
): ComponentPropUpdate[] {
  const filter = options.decisionFilter ?? DEFAULT_DECISION_FILTER;
  const updates: ComponentPropUpdate[] = [];

  for (const change of classified.changes) {
    if (
      !filter.includes(change.decision) ||
      !change.classes.includes('component-props') ||
      !change.target.code
    ) {
      continue;
    }

    const beforeProps = mapPropsByIdentity(base.nodes[change.key]?.componentProps ?? []);
    const afterProps = mapPropsByIdentity(head.nodes[change.key]?.componentProps ?? []);

    for (const [identity, after] of afterProps) {
      const before = beforeProps.get(identity);
      if (!before || JSON.stringify(before.value) === JSON.stringify(after.value)) {
        continue;
      }

      updates.push({
        key: change.key,
        nodeId: after.nodeId,
        propName: after.propName,
        value: after.value,
        code: change.target.code,
      });
    }
  }

  return updates;
}

export function applyMarkedTextUpdates(source: string, updates: TextUpdate[]): ApplyMarkedSourceResult {
  const relevantUpdates = new Map(updates.map(update => [update.nodeId, update]));
  const appliedNodeIds: string[] = [];
  let nextSource = source;
  let offset = 0;

  for (const marker of findMarkers(source, 'text')) {
    const update = findUpdateForMarker(marker, relevantUpdates);
    if (!update) {
      continue;
    }

    const start = marker.end + offset;
    const literal = findNextStringLiteral(nextSource, start);
    if (!literal) {
      continue;
    }

    nextSource =
      nextSource.slice(0, literal.start) +
      quoteString(update.value, literal.quote) +
      nextSource.slice(literal.end);
    offset += quoteString(update.value, literal.quote).length - (literal.end - literal.start);
    appliedNodeIds.push(update.nodeId);
  }

  return {
    changed: appliedNodeIds.length > 0,
    source: nextSource,
    appliedNodeIds,
    missingNodeIds: updates
      .map(update => update.nodeId)
      .filter(nodeId => !appliedNodeIds.includes(nodeId)),
  };
}

export function applyMarkedPropUpdates(
  source: string,
  updates: ComponentPropUpdate[]
): ApplyMarkedSourceResult {
  const appliedNodeIds: string[] = [];
  const appliedUpdateIndexes = new Set<number>();
  let nextSource = source;
  let offset = 0;

  for (const marker of findMarkers(source, 'prop')) {
    const match = findPropUpdateForMarker(marker, updates, appliedUpdateIndexes);
    if (!match) {
      continue;
    }

    const { update, index } = match;
    const propName = marker.attrs.prop ?? toJsxPropName(update.propName);
    const start = marker.end + offset;
    const attr = findNextJsxAttribute(nextSource, start, propName);
    const value = transformPropValue(String(update.value), marker.attrs.transform);

    if (attr) {
      nextSource = nextSource.slice(0, attr.valueStart) + value + nextSource.slice(attr.valueEnd);
      offset += value.length - (attr.valueEnd - attr.valueStart);
      appliedNodeIds.push(update.nodeId);
      appliedUpdateIndexes.add(index);
      continue;
    }

    const literal = findNextStringLiteral(nextSource, start);
    if (!literal) {
      continue;
    }

    nextSource =
      nextSource.slice(0, literal.start) +
      quoteString(value, literal.quote) +
      nextSource.slice(literal.end);
    offset += quoteString(value, literal.quote).length - (literal.end - literal.start);
    appliedNodeIds.push(update.nodeId);
    appliedUpdateIndexes.add(index);
  }

  return {
    changed: appliedNodeIds.length > 0,
    source: nextSource,
    appliedNodeIds,
    missingNodeIds: updates
      .filter((_update, index) => !appliedUpdateIndexes.has(index))
      .map(update => update.nodeId),
  };
}

function mapTextsByNodeId(texts: readonly SnapshotTextLeaf[]): Map<string, SnapshotTextLeaf> {
  return new Map(texts.map(text => [text.nodeId, text]));
}

function mapPropsByIdentity(
  props: readonly SnapshotComponentPropLeaf[]
): Map<string, SnapshotComponentPropLeaf> {
  return new Map(props.map(prop => [componentPropIdentity(prop), prop]));
}

function componentPropIdentity(prop: SnapshotComponentPropLeaf): string {
  return [prop.nodeId, prop.source, prop.propName].join('\u0000');
}

function findMarkers(source: string, kind: Marker['kind']): Marker[] {
  const markers: Marker[] = [];
  const pattern = /\/\*\s*figma:(text|prop)\s+([^*]*?)\s*\*\//g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match[1] !== kind) {
      continue;
    }

    markers.push({
      kind,
      start: match.index,
      end: match.index + match[0].length,
      attrs: parseMarkerAttrs(match[2]),
    });
  }

  return markers;
}

function parseMarkerAttrs(value: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z][\w-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

function findUpdateForMarker<T extends { nodeId: string }>(
  marker: Marker,
  updates: Map<string, T>
): T | null {
  const nodes = (marker.attrs.node ?? '')
    .split(/[\s,]+/)
    .map(node => node.trim())
    .filter(Boolean);

  for (const nodeId of nodes) {
    const update = updates.get(nodeId);
    if (update) {
      return update;
    }
  }

  return null;
}

function findPropUpdateForMarker(
  marker: Marker,
  updates: ComponentPropUpdate[],
  usedIndexes: Set<number>
): { update: ComponentPropUpdate; index: number } | null {
  const nodes = (marker.attrs.node ?? '')
    .split(/[\s,]+/)
    .map(node => node.trim())
    .filter(Boolean);

  const candidates = updates
    .map((update, index) => ({ update, index }))
    .filter(({ update, index }) => nodes.includes(update.nodeId) && !usedIndexes.has(index));

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const markerProp = normalizePropName(marker.attrs.prop ?? '');
  const markerId = normalizePropName(marker.attrs.id ?? '');
  const figmaProp = normalizePropName(marker.attrs.figmaProp ?? '');

  return (
    candidates.find(({ update }) => figmaProp && normalizePropName(update.propName) === figmaProp) ??
    candidates.find(({ update }) => markerProp && normalizePropName(toJsxPropName(update.propName)) === markerProp) ??
    candidates.find(({ update }) => markerId.includes(normalizePropName(update.propName))) ??
    candidates[0]
  );
}

function findNextStringLiteral(
  source: string,
  start: number
): { start: number; end: number; quote: '"' | "'" | '`' } | null {
  let index = start;
  while (index < source.length && /[\s})]/.test(source[index])) {
    index += 1;
  }

  const quote = source[index];
  if (quote !== '"' && quote !== "'" && quote !== '`') {
    return null;
  }

  let cursor = index + 1;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === quote) {
      return { start: index, end: cursor + 1, quote };
    }
    cursor += 1;
  }

  return null;
}

function findNextJsxAttribute(
  source: string,
  start: number,
  propName: string
): { valueStart: number; valueEnd: number } | null {
  const search = source.slice(start);
  const pattern = new RegExp(`\\b${escapeRegExp(propName)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*(["'])(.*?)\\3\\s*\\})`);
  const match = pattern.exec(search);
  if (!match) {
    return null;
  }

  const attrStart = start + match.index;
  const full = match[0];
  const equalIndex = full.indexOf('=');
  const valueStartInFull = full.slice(equalIndex + 1).search(/["']/) + equalIndex + 2;
  const value = match[1] ?? match[2] ?? match[4] ?? '';

  return {
    valueStart: attrStart + valueStartInFull,
    valueEnd: attrStart + valueStartInFull + value.length,
  };
}

function quoteString(value: string, quote: '"' | "'" | '`'): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(escapeRegExp(quote), 'g'), `\\${quote}`)
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `${quote}${escaped}${quote}`;
}

function toJsxPropName(propName: string): string {
  return propName
    .trim()
    .replace(/^[A-Z]/, char => char.toLowerCase())
    .replace(/\s+([a-zA-Z])/g, (_match, char: string) => char.toUpperCase());
}

function transformPropValue(value: string, transform: string | undefined): string {
  if (transform === 'lower') {
    return value.toLowerCase();
  }

  if (transform === 'pascal-compact') {
    return value
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  return value;
}

function normalizePropName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
