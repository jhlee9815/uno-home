import { createHash } from 'node:crypto';
import type {
  AssetRefEntry,
  ComplianceSnapshotFields,
  DescendantFrameEntry,
  DetachedStyleEntry,
  DetachedStyleProperty,
} from './compliance-types.ts';

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaPaint {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
  visible?: boolean;
  imageRef?: string;
  scaleMode?: string;
  boundVariables?: Record<string, unknown>;
}

export interface FigmaEffect {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: { r: number; g: number; b: number; a: number };
}

export interface FigmaComponentProperty {
  type?: string;
  value?: unknown;
  defaultValue?: unknown;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  letterSpacing?: number;
}

export interface FigmaNodeDetail {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  absoluteBoundingBox?: FigmaBoundingBox;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  characters?: string;
  componentProperties?: Record<string, FigmaComponentProperty>;
  componentPropertyDefinitions?: Record<string, FigmaComponentProperty>;
  variantProperties?: Record<string, unknown>;
  children?: ReadonlyArray<FigmaNodeDetail>;
  boundVariables?: Record<string, unknown>;
  fillStyleId?: string;
  strokeStyleId?: string;
  textStyleId?: string;
  effectStyleId?: string;
  style?: FigmaTextStyle;
}

export interface SnapshotTextLeaf {
  nodeId: string;
  nodeName: string;
  path: string[];
  value: string;
}

export interface SnapshotComponentPropLeaf {
  nodeId: string;
  nodeName: string;
  path: string[];
  source: 'componentProperties' | 'componentPropertyDefinitions' | 'variantProperties';
  propName: string;
  propType: string;
  value: unknown;
}

export interface SnapshotNodeEntry extends ComplianceSnapshotFields {
  id: string;
  name: string;
  lastModified: string;
  visible: boolean;
  boundingBox: FigmaBoundingBox | null;
  textHash: string;
  propsHash: string;
  componentPropsHash: string;
  texts: SnapshotTextLeaf[];
  componentProps: SnapshotComponentPropLeaf[];
}

export function sha256(data: string): string {
  return 'sha256:' + createHash('sha256').update(data, 'utf-8').digest('hex');
}

export function collectTextLeaves(
  node: FigmaNodeDetail,
  path: string[] = [node.name]
): SnapshotTextLeaf[] {
  const leaves: SnapshotTextLeaf[] = [];

  if (node.type === 'TEXT' && node.characters !== undefined) {
    leaves.push({
      nodeId: node.id,
      nodeName: node.name,
      path,
      value: node.characters,
    });
  }

  for (const child of node.children ?? []) {
    leaves.push(...collectTextLeaves(child, [...path, child.name]));
  }

  return leaves;
}

export function collectComponentPropLeaves(
  node: FigmaNodeDetail,
  path: string[] = [node.name]
): SnapshotComponentPropLeaf[] {
  const leaves: SnapshotComponentPropLeaf[] = [];

  for (const [propName, prop] of sortedObjectEntries(node.componentPropertyDefinitions)) {
    leaves.push({
      nodeId: node.id,
      nodeName: node.name,
      path,
      source: 'componentPropertyDefinitions',
      propName,
      propType: prop.type ?? 'UNKNOWN',
      value: prop.defaultValue ?? prop.value ?? null,
    });
  }

  for (const [propName, prop] of sortedObjectEntries(node.componentProperties)) {
    leaves.push({
      nodeId: node.id,
      nodeName: node.name,
      path,
      source: 'componentProperties',
      propName,
      propType: prop.type ?? 'UNKNOWN',
      value: prop.value ?? prop.defaultValue ?? null,
    });
  }

  for (const [propName, value] of sortedObjectEntries(node.variantProperties)) {
    leaves.push({
      nodeId: node.id,
      nodeName: node.name,
      path,
      source: 'variantProperties',
      propName,
      propType: 'VARIANT',
      value,
    });
  }

  for (const child of node.children ?? []) {
    leaves.push(...collectComponentPropLeaves(child, [...path, child.name]));
  }

  return leaves;
}

const WRAPPER_EXACT_NAMES = new Set(['wrapper', 'auto layout', 'container']);

function isWrapperFrameName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.startsWith('_')) return true;
  return WRAPPER_EXACT_NAMES.has(trimmed.toLowerCase());
}

export function collectDescendantFrames(
  root: FigmaNodeDetail,
  parentRegisteredKey: string
): DescendantFrameEntry[] {
  const out: DescendantFrameEntry[] = [];
  const walk = (node: FigmaNodeDetail, path: string[], isRoot: boolean): void => {
    if (!isRoot && node.type === 'FRAME' && !isWrapperFrameName(node.name)) {
      out.push({
        nodeId: node.id,
        nodeName: node.name,
        nodePath: path,
        name: node.name,
        parentRegisteredKey,
      });
    }
    for (const child of node.children ?? []) {
      walk(child, [...path, child.name], false);
    }
  };
  walk(root, [root.name], true);
  return out;
}

export function collectAssetRefs(root: FigmaNodeDetail): AssetRefEntry[] {
  const out: AssetRefEntry[] = [];
  const walk = (node: FigmaNodeDetail, path: string[]): void => {
    const fills = node.fills ?? [];
    fills.forEach((paint, paintIndex) => {
      if (paint.type === 'IMAGE' && typeof paint.imageRef === 'string' && paint.imageRef.length > 0) {
        out.push({
          nodeId: node.id,
          nodeName: node.name,
          nodePath: path,
          kind: 'image',
          paintIndex,
          ref: paint.imageRef,
        });
      }
    });
    for (const child of node.children ?? []) {
      walk(child, [...path, child.name]);
    }
  };
  walk(root, [root.name]);
  return out;
}

function paintColorIsBound(paint: FigmaPaint): boolean {
  return paint.boundVariables !== undefined && paint.boundVariables.color !== undefined;
}

function nodeHasBoundVariables(node: FigmaNodeDetail): boolean {
  return node.boundVariables !== undefined && Object.keys(node.boundVariables).length > 0;
}

function nodePaintSlotIsBound(
  node: FigmaNodeDetail,
  slot: 'fills' | 'strokes',
  paintIndex: number
): boolean {
  const slotBindings = node.boundVariables?.[slot];
  if (!Array.isArray(slotBindings)) return false;
  const binding = slotBindings[paintIndex] as Record<string, unknown> | undefined;
  return binding !== undefined && binding.color !== undefined;
}

function typographyPropertyIsBound(node: FigmaNodeDetail, property: DetachedStyleProperty): boolean {
  const bv = node.boundVariables;
  if (bv === undefined) return false;
  const key = TYPOGRAPHY_BOUND_KEYS[property];
  if (key === undefined) return false;
  return bv[key] !== undefined;
}

const TYPOGRAPHY_BOUND_KEYS: Partial<Record<DetachedStyleProperty, string>> = {
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  letterSpacing: 'letterSpacing',
};

function buildDetachedStyleEntry(
  node: FigmaNodeDetail,
  path: string[],
  kind: DetachedStyleEntry['kind'],
  property: DetachedStyleProperty,
  rawValue: unknown,
  styleId: string | null,
  hasPaintBoundVariables?: boolean
): DetachedStyleEntry {
  const evidence: DetachedStyleEntry['evidence'] = {
    hasNodeBoundVariables: nodeHasBoundVariables(node),
    styleId,
  };
  if (hasPaintBoundVariables !== undefined) {
    evidence.hasPaintBoundVariables = hasPaintBoundVariables;
  }
  return {
    nodeId: node.id,
    nodeName: node.name,
    nodePath: path,
    kind,
    property,
    rawValue,
    suggestedToken: null,
    evidence,
  };
}

export function collectDetachedStyles(root: FigmaNodeDetail): DetachedStyleEntry[] {
  const out: DetachedStyleEntry[] = [];
  const walk = (node: FigmaNodeDetail, path: string[]): void => {
    collectDetachedPaintStyles(node, path, 'fills', 'fill', node.fills, node.fillStyleId, out);
    collectDetachedPaintStyles(node, path, 'strokes', 'stroke', node.strokes, node.strokeStyleId, out);

    if (node.type === 'TEXT' && node.textStyleId === undefined && node.style !== undefined) {
      const style = node.style;
      const candidates: Array<{ property: DetachedStyleProperty; value: unknown }> = [];
      if (style.fontFamily !== undefined) candidates.push({ property: 'fontFamily', value: style.fontFamily });
      if (style.fontSize !== undefined) candidates.push({ property: 'fontSize', value: style.fontSize });
      if (style.fontWeight !== undefined) candidates.push({ property: 'fontWeight', value: style.fontWeight });
      if (style.lineHeightPx !== undefined) candidates.push({ property: 'lineHeight', value: style.lineHeightPx });
      if (style.letterSpacing !== undefined) candidates.push({ property: 'letterSpacing', value: style.letterSpacing });
      for (const { property, value } of candidates) {
        if (typographyPropertyIsBound(node, property)) continue;
        out.push(buildDetachedStyleEntry(node, path, 'typography', property, value, null));
      }
    }

    for (const child of node.children ?? []) {
      walk(child, [...path, child.name]);
    }
  };
  walk(root, [root.name]);
  return out;
}

function collectDetachedPaintStyles(
  node: FigmaNodeDetail,
  path: string[],
  slot: 'fills' | 'strokes',
  property: 'fill' | 'stroke',
  paints: FigmaPaint[] | undefined,
  styleId: string | undefined,
  out: DetachedStyleEntry[]
): void {
  if (styleId !== undefined) return;
  if (paints === undefined) return;
  paints.forEach((paint, paintIndex) => {
    if (paint.type !== 'SOLID' || paint.color === undefined) return;
    const paintBound = paintColorIsBound(paint);
    if (paintBound) return;
    if (nodePaintSlotIsBound(node, slot, paintIndex)) return;
    out.push(
      buildDetachedStyleEntry(node, path, 'color', property, paint.color, null, paintBound)
    );
  });
}

export function buildSnapshotNodeEntry(
  node: FigmaNodeDetail,
  lastModified: string,
  parentRegisteredKey: string = node.id
): SnapshotNodeEntry {
  const texts = collectTextLeaves(node);
  const componentProps = collectComponentPropLeaves(node);

  return {
    id: node.id,
    name: node.name,
    lastModified,
    visible: node.visible !== false,
    boundingBox: node.absoluteBoundingBox ?? null,
    textHash: hashTextLeaves(texts),
    propsHash: hashVisualProps(node),
    componentPropsHash: hashComponentPropLeaves(componentProps),
    texts,
    componentProps,
    detachedStyles: collectDetachedStyles(node),
    descendantFrames: collectDescendantFrames(node, parentRegisteredKey),
    assetRefs: collectAssetRefs(node),
  };
}

export function buildMissingSnapshotNodeEntry(
  id: string,
  name: string,
  lastModified: string
): SnapshotNodeEntry {
  return {
    id,
    name,
    lastModified,
    visible: false,
    boundingBox: null,
    textHash: sha256(''),
    propsHash: sha256(''),
    componentPropsHash: sha256(''),
    texts: [],
    componentProps: [],
    detachedStyles: [],
    descendantFrames: [],
    assetRefs: [],
  };
}

function hashTextLeaves(texts: SnapshotTextLeaf[]): string {
  const joined = [...texts]
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId))
    .map(text => text.value)
    .join('\n');
  return sha256(joined);
}

function hashComponentPropLeaves(componentProps: SnapshotComponentPropLeaf[]): string {
  const payload = [...componentProps]
    .sort(compareComponentProps)
    .map(prop => ({
      nodeId: prop.nodeId,
      source: prop.source,
      propName: prop.propName,
      propType: prop.propType,
      value: prop.value,
    }));
  return sha256(JSON.stringify(payload));
}

function hashVisualProps(node: FigmaNodeDetail): string {
  const payload = JSON.stringify({
    type: node.type,
    fills: node.fills ?? [],
    effects: node.effects ?? [],
  });
  return sha256(payload);
}

function sortedObjectEntries<T>(value: Record<string, T> | undefined): [string, T][] {
  return Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

function compareComponentProps(
  a: SnapshotComponentPropLeaf,
  b: SnapshotComponentPropLeaf
): number {
  return (
    a.nodeId.localeCompare(b.nodeId) ||
    a.source.localeCompare(b.source) ||
    a.propName.localeCompare(b.propName)
  );
}
