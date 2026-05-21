import { readFileSync, writeFileSync } from 'node:fs';
import { resolveCodePath } from './config-loader.ts';
import {
  applyMarkedPropUpdates,
  applyMarkedTextUpdates,
  type ComponentPropUpdate,
  type TextUpdate,
} from './apply-code.ts';

export interface MissingMarker {
  kind: 'text' | 'prop';
  code: string;
  nodeIds: string[];
}

export interface MarkedApplyResult {
  changedAbsPaths: string[];
  changedRepoPaths: string[];
  textHits: number;
  propHits: number;
  missingMarkers: MissingMarker[];
}

/**
 * Run `applyMarkedTextUpdates` + `applyMarkedPropUpdates` against every
 * code file referenced by `updates`. Writes results back to disk.
 * Returns the list of changed paths plus a tally of marker hits and
 * missing markers (so callers can build a 'manual edit needed' fallback
 * PR when nothing applies).
 *
 * Pure-disk-IO helper. Does NOT touch git or backup the source tree —
 * callers (cron's apply.ts, Phase B's designer-approval.ts) handle that.
 */
export function applyMarkedUpdatesToFiles(
  textUpdates: readonly TextUpdate[],
  propUpdates: readonly ComponentPropUpdate[],
  repoRoot: string
): MarkedApplyResult {
  const codeFiles = new Set<string>();
  for (const update of textUpdates) codeFiles.add(update.code);
  for (const update of propUpdates) codeFiles.add(update.code);

  const changedAbsPaths: string[] = [];
  const changedRepoPaths: string[] = [];
  const missingMarkers: MissingMarker[] = [];
  let textHits = 0;
  let propHits = 0;

  for (const codePath of codeFiles) {
    const absPath = resolveCodePath(codePath);
    const source = readFileSync(absPath, 'utf-8');
    const textResult = applyMarkedTextUpdates(
      source,
      textUpdates.filter(u => u.code === codePath)
    );
    const propResult = applyMarkedPropUpdates(
      textResult.source,
      propUpdates.filter(u => u.code === codePath)
    );

    textHits += textResult.appliedNodeIds.length;
    propHits += propResult.appliedNodeIds.length;

    if (textResult.missingNodeIds.length > 0) {
      missingMarkers.push({ kind: 'text', code: codePath, nodeIds: textResult.missingNodeIds });
    }
    if (propResult.missingNodeIds.length > 0) {
      missingMarkers.push({ kind: 'prop', code: codePath, nodeIds: propResult.missingNodeIds });
    }

    if (textResult.changed || propResult.changed) {
      writeFileSync(absPath, propResult.source, 'utf-8');
      changedAbsPaths.push(absPath);
      changedRepoPaths.push(absPath.startsWith(`${repoRoot}/`) ? absPath.slice(repoRoot.length + 1) : absPath);
    }
  }

  return { changedAbsPaths, changedRepoPaths, textHits, propHits, missingMarkers };
}
