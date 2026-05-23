export interface ManifestLike {
  csId: string;
  createdAt: string;
  headSnapshotPath?: string;
}

export type PromoteDecision =
  | {
      action: 'promote';
      snapshotContent: string;
      newBaselineName: string;
      newBaselineRelPath: string;
      currentBaseline: string | undefined;
    }
  | { action: 'skip'; reason: string };

export interface DecideBaselinePromoteInput {
  manifest: ManifestLike;
  snapshotPath: string | undefined;
  baselineFiles: readonly string[];
  baselineDir: string;
  now: Date;
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string;
}

export function toFilenameTimestamp(iso: string): string {
  return iso.replace(/\..+$/, '').replace(/Z$/, '').replace(/:/g, '-');
}

export function currentBaselineFilenameTimestamp(baselineFiles: readonly string[]): string | undefined {
  const sorted = baselineFiles.filter(f => f.endsWith('.json')).slice().sort();
  const latest = sorted.at(-1);
  return latest?.replace(/\.json$/, '');
}

export function baselineBranchForCs(csId: string): string {
  assertCsId(csId);
  return `baseline-promote/${csId}`;
}

export function buildPromotePrTitle(csId: string): string {
  assertCsId(csId);
  return `[baseline-promote] ${csId} — promote approved snapshot to baseline`;
}

export interface PromotePrBodyInput {
  csId: string;
  newBaselineName: string;
  previousBaseline: string | undefined;
  sourceWorkflow: string;
  sourceRunUrl?: string;
}

export function buildPromotePrBody(input: PromotePrBodyInput): string {
  const lines = [
    `Promote the approved snapshot from \`${input.csId}\` as the new design baseline.`,
    '',
    '**Why:** the designer approved this change set, so the post-change snapshot becomes the new reference. Future runs of `figma-pipeline` compare against this baseline, which silences repeated detection of the now-accepted differences.',
    '',
    `New baseline: \`.automation/baseline/${input.newBaselineName}\``,
  ];

  if (input.previousBaseline) {
    lines.push(`Previous baseline: \`.automation/baseline/${input.previousBaseline}.json\` (kept on disk; rollback = \`git rm\` the new file)`);
  }

  lines.push('', `Source workflow: \`${input.sourceWorkflow}\``);
  if (input.sourceRunUrl) {
    lines.push(`Source run: ${input.sourceRunUrl}`);
  }

  lines.push('', '_Created by baseline-promote automation._');
  return lines.join('\n');
}

export function decideBaselinePromote(input: DecideBaselinePromoteInput): PromoteDecision {
  const { manifest, snapshotPath, baselineFiles, baselineDir, now, fileExists, readFile } = input;

  if (!snapshotPath || !fileExists(snapshotPath)) {
    return { action: 'skip', reason: `snapshot not found for ${manifest.csId} (looked at: ${snapshotPath ?? '<no path resolved>'})` };
  }

  const currentBaseline = currentBaselineFilenameTimestamp(baselineFiles);
  const csTimestamp = toFilenameTimestamp(manifest.createdAt);
  if (currentBaseline && csTimestamp < currentBaseline) {
    return {
      action: 'skip',
      reason: `cs ${manifest.csId} created at ${csTimestamp} is older than current baseline ${currentBaseline}; not promoting to avoid regression`,
    };
  }

  const newBaselineName = `${toFilenameTimestamp(now.toISOString())}.json`;
  if (baselineFiles.includes(newBaselineName)) {
    return { action: 'skip', reason: `baseline ${newBaselineName} already exists; another promote already happened this second` };
  }

  return {
    action: 'promote',
    snapshotContent: readFile(snapshotPath),
    newBaselineName,
    newBaselineRelPath: `${baselineDir}/${newBaselineName}`,
    currentBaseline,
  };
}

function assertCsId(csId: string): void {
  if (!/^cs-[A-Za-z0-9T_.:-]+$/.test(csId)) {
    throw new Error(`Invalid cs id: ${csId}`);
  }
}
