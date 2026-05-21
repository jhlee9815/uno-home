import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type CsManifestState =
  | 'pending'
  | 'designer-approved'
  | 'designer-rejected'
  | 'pr-open'
  | 'merged'
  | 'shipped';

export interface CsManifestStateEvent {
  state: CsManifestState;
  at: string;
  by: string;
  via?: string;
  note?: string;
}

export interface CsManifestImageRef {
  before: string | null;
  after: string | null;
}

export interface CsManifest {
  csId: string;
  createdAt: string;
  fileKey: string;
  baseSnapshotPath: string;
  headSnapshotPath: string;
  classifiedDiffPath: string;
  reportPath: string;
  classifiedDiffSha256: string;
  headSnapshotSha256: string;
  imageRefs: Record<string, CsManifestImageRef>;
  runId: string | null;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  viewerUrl?: string;
  state: CsManifestState;
  stateHistory: CsManifestStateEvent[];
}

export interface CreateManifestInput {
  csId: string;
  createdAt: string;
  fileKey: string;
  baseSnapshotPath: string;
  headSnapshotPath: string;
  classifiedDiffPath: string;
  reportPath: string;
  classifiedDiffSha256: string;
  headSnapshotSha256: string;
  imageRefs?: Record<string, CsManifestImageRef>;
  runId?: string | null;
  actor: string;
}

const ALLOWED_TRANSITIONS: Record<CsManifestState, CsManifestState[]> = {
  pending: ['designer-approved', 'designer-rejected', 'pr-open'],
  'designer-approved': ['pr-open', 'merged', 'shipped'],
  'designer-rejected': [],
  'pr-open': ['merged', 'shipped'],
  merged: ['shipped'],
  shipped: [],
};

export function manifestPath(repoRoot: string, csId: string): string {
  assertCsId(csId);
  return resolve(repoRoot, '.automation/cs', `${csId}.json`);
}

export function createManifest(repoRoot: string, input: CreateManifestInput): CsManifest {
  assertCsId(input.csId);
  const path = manifestPath(repoRoot, input.csId);
  if (existsSync(path)) {
    return loadManifest(repoRoot, input.csId);
  }

  const manifest: CsManifest = {
    csId: input.csId,
    createdAt: input.createdAt,
    fileKey: input.fileKey,
    baseSnapshotPath: input.baseSnapshotPath,
    headSnapshotPath: input.headSnapshotPath,
    classifiedDiffPath: input.classifiedDiffPath,
    reportPath: input.reportPath,
    classifiedDiffSha256: input.classifiedDiffSha256,
    headSnapshotSha256: input.headSnapshotSha256,
    imageRefs: input.imageRefs ?? {},
    runId: input.runId ?? null,
    state: 'pending',
    stateHistory: [
      {
        state: 'pending',
        at: input.createdAt,
        by: input.actor,
        via: 'report-generation',
      },
    ],
  };
  writeManifest(repoRoot, manifest);
  return manifest;
}

export function loadManifest(repoRoot: string, csId: string): CsManifest {
  const path = manifestPath(repoRoot, csId);
  if (!existsSync(path)) {
    throw new Error(`cs manifest not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as CsManifest;
}

export function updateManifest(
  repoRoot: string,
  csId: string,
  updater: (manifest: CsManifest) => CsManifest
): CsManifest {
  const current = loadManifest(repoRoot, csId);
  const next = updater(structuredClone(current));
  if (next.csId !== current.csId) {
    throw new Error('Cannot change manifest csId');
  }
  writeManifest(repoRoot, next);
  return next;
}

export function transitionManifest(
  repoRoot: string,
  csId: string,
  event: CsManifestStateEvent
): CsManifest {
  return updateManifest(repoRoot, csId, manifest => {
    const allowed = ALLOWED_TRANSITIONS[manifest.state];
    if (!allowed.includes(event.state)) {
      throw new Error(`Invalid cs manifest transition: ${manifest.state} -> ${event.state}`);
    }
    manifest.state = event.state;
    manifest.stateHistory.push(event);
    return manifest;
  });
}

export function sha256File(path: string): string {
  return sha256Buffer(readFileSync(path));
}

export function sha256Buffer(value: Buffer): string {
  return 'sha256:' + createHash('sha256').update(value).digest('hex');
}

function writeManifest(repoRoot: string, manifest: CsManifest): void {
  const path = manifestPath(repoRoot, manifest.csId);
  mkdirSync(resolve(repoRoot, '.automation/cs'), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

function assertCsId(csId: string): void {
  if (!/^cs-[A-Za-z0-9T_.:-]+$/.test(csId)) {
    throw new Error(`Invalid cs id: ${csId}`);
  }
}
