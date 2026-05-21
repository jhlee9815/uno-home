export type ComplianceIssueKind = 'detached-style' | 'new-frame' | 'image-change';

export type DetachedStyleKind = 'color' | 'typography' | 'effect';

export type DetachedStyleProperty =
  | 'fill'
  | 'stroke'
  | 'effect'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing';

export interface ComplianceNodeRef {
  nodeId: string;
  nodeName: string;
  nodePath: string[];
}

export interface DetachedStyleEntry extends ComplianceNodeRef {
  kind: DetachedStyleKind;
  property: DetachedStyleProperty;
  rawValue: unknown;
  suggestedToken: null;
  evidence: {
    hasNodeBoundVariables: boolean;
    hasPaintBoundVariables?: boolean;
    styleId: string | null;
  };
}

export interface DescendantFrameEntry extends ComplianceNodeRef {
  name: string;
  parentRegisteredKey: string;
}

export interface AssetRefEntry extends ComplianceNodeRef {
  kind: 'image';
  paintIndex: number;
  ref: string;
}

export interface ComplianceSnapshotFields {
  detachedStyles: DetachedStyleEntry[];
  descendantFrames: DescendantFrameEntry[];
  assetRefs: AssetRefEntry[];
}

export type ComplianceSubcategory =
  | 'text-change'
  | 'props-change'
  | 'image-change'
  | 'detached-style'
  | 'new-frame';

export interface ComplianceDiffSummary {
  newDetachedStyles: DetachedStyleEntry[];
  newFrames: DescendantFrameEntry[];
  changedImageRefs: AssetRefChange[];
}

export interface AssetRefChange {
  before: AssetRefEntry | null;
  after: AssetRefEntry;
}

export interface ComplianceClassifiedMetadata {
  subcategory: ComplianceSubcategory;
  compliance?: ComplianceDiffSummary;
}

export function detachedStyleStableKey(entry: DetachedStyleEntry): string {
  return [entry.nodeId, entry.kind, entry.property].join('::');
}

export function frameStableKey(entry: DescendantFrameEntry): string {
  return entry.nodeId;
}

export function assetRefStableKey(entry: AssetRefEntry): string {
  return [entry.nodeId, entry.paintIndex].join('::');
}
