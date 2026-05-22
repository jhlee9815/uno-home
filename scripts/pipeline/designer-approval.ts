import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Octokit } from 'octokit';
import { createLogger } from './lib/logger.ts';
import {
  loadManifest,
  transitionManifest,
  type CsManifest,
  type CsManifestState,
} from './lib/cs-manifest.ts';
import {
  buildDesignerDecisionComment,
  extractCsIdFromIssue,
  stateForDesignerLabel,
} from './lib/designer-approval.ts';
import { extractComponentPropUpdates, extractTextUpdates } from './lib/apply-code.ts';
import { applyMarkedUpdatesToFiles, type MarkedApplyResult } from './lib/apply-runner.ts';
import { manualEditFilePath, writeManualEditFile } from './lib/manual-edits.ts';
import { createOrUpdateDesignerPr } from './lib/github-pr.ts';
import { resolveAutomationPath } from './lib/artifact-paths.ts';
import type { ClassifiedDiffFile } from './lib/classify-diff.ts';
import type { SnapshotFile } from './lib/diff-snapshot.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const DIFFS_DIR = resolve(REPO_ROOT, '.automation/diffs');
const logger = createLogger('designer-approval');

const TERMINAL_STATES: ReadonlyArray<CsManifestState> = ['pr-open', 'merged', 'shipped'];

interface IssueEvent {
  label?: { name?: string };
  issue?: { number?: number; title?: string; body?: string; html_url?: string };
  sender?: { login?: string };
  repository?: { full_name?: string };
}

async function main(): Promise<void> {
  const event = loadEvent();
  const label = process.argv[3] ?? event?.label?.name;
  const csId = process.argv[2] ?? extractCsIdFromIssue({ title: event?.issue?.title, body: event?.issue?.body });
  const actor = process.env.GITHUB_ACTOR ?? event?.sender?.login ?? process.env.USER ?? 'local-designer';

  if (!csId || !label) {
    logger.error('Usage: npm run figma:designer-approval -- <cs-id> <designer-approved|designer-rejected>');
    process.exit(1);
  }

  const state = stateForDesignerLabel(label);
  if (!state) {
    logger.info(`Ignored label: ${label}`);
    return;
  }

  let manifest: CsManifest;
  try {
    manifest = loadManifest(REPO_ROOT, csId);
  } catch (err) {
    logger.error(`Manifest not found for ${csId}: ${String(err)}`);
    process.exit(1);
  }

  // Terminal-state early exit (dupe label, replay after merge, etc.)
  if (TERMINAL_STATES.includes(manifest.state)) {
    logger.info(`Manifest already at ${manifest.state}; no-op`);
    await commentOnIssue(event, `⏭️ Already at \`${manifest.state}\`; designer-approval no-op.`);
    return;
  }

  if (state === 'designer-rejected') {
    await handleReject(manifest, event, actor, label);
    return;
  }

  await handleApprove(manifest, event, actor, label, csId);
}

async function handleReject(
  manifest: CsManifest,
  event: IssueEvent | null,
  actor: string,
  label: string
): Promise<void> {
  if (manifest.state === 'designer-rejected') {
    logger.info('Already rejected; no-op');
    return;
  }
  const updated = transitionManifest(REPO_ROOT, manifest.csId, {
    state: 'designer-rejected',
    at: new Date().toISOString(),
    by: actor,
    via: `label:${label}`,
    note: event?.issue?.html_url,
  });
  logger.success(`Manifest ${manifest.csId} transitioned to ${updated.state}`);
  await commentOnIssue(event, buildDesignerDecisionComment(updated.state, manifest.csId));
}

async function handleApprove(
  manifest: CsManifest,
  event: IssueEvent | null,
  actor: string,
  label: string,
  csId: string
): Promise<void> {
  const branch = `designer-approved/${csId}`;
  const { octokit, owner, repo } = resolveGithub(event);

  // Idempotency: already approved + open PR → no-op recovery skip
  if (manifest.state === 'designer-approved' && octokit) {
    const existing = await findOpenPrForBranch(octokit, owner, repo, branch);
    if (existing) {
      logger.info(`Already approved with open PR ${existing}; no-op`);
      return;
    }
    logger.info('Already approved but no PR; re-running apply (recovery)');
  }

  // First-time approval: transition pending → designer-approved BEFORE apply work
  if (manifest.state === 'pending') {
    const approved = transitionManifest(REPO_ROOT, manifest.csId, {
      state: 'designer-approved',
      at: new Date().toISOString(),
      by: actor,
      via: `label:${label}`,
      note: event?.issue?.html_url,
    });
    logger.success(`Manifest ${manifest.csId} transitioned to ${approved.state}`);
  }

  // Run apply attempt. HEAD will be left on designer-approved/{csId} after
  // this; the workflow's "Commit manifest transition" step uses the
  // figma-pipeline stash pattern to preserve .automation/cs/* deltas,
  // switch back to main, and push manifest-only. Do NOT restore main here
  // — `git reset --hard` would wipe the transitionManifest writes before
  // the workflow can commit them.
  const result = await runApplyAndPr({ csId, manifest, octokit, owner, repo, branch, event });
  if (result.url) {
    // Transition pr-open ONLY after PR succeeds.
    transitionManifest(REPO_ROOT, csId, {
      state: 'pr-open',
      at: new Date().toISOString(),
      by: 'designer-bot',
      via: `pr:${result.url}`,
    });
    logger.success(`Manifest ${csId} transitioned to pr-open`);
  } else {
    logger.warn('PR creation skipped or failed; manifest stays at designer-approved for retry.');
  }

  await commentOnIssue(
    event,
    `${buildDesignerDecisionComment('designer-approved', csId)}\n\n${result.summary}`
  );
}

interface RunApplyAndPrInput {
  csId: string;
  manifest: CsManifest;
  octokit: Octokit | null;
  owner: string;
  repo: string;
  branch: string;
  event: IssueEvent | null;
}

interface RunApplyAndPrResult {
  url?: string;
  summary: string;
}

async function runApplyAndPr(input: RunApplyAndPrInput): Promise<RunApplyAndPrResult> {
  const { csId, manifest, octokit, owner, repo, branch } = input;

  const artifacts = loadCsArtifacts(csId, manifest);
  if (!artifacts) {
    return { summary: '⚠️ Classified diff or snapshots missing; skipped apply attempt.' };
  }

  const textUpdates = extractTextUpdates(artifacts.classified, artifacts.base, artifacts.head, {
    decisionFilter: ['report-only'],
  });
  const propUpdates = extractComponentPropUpdates(artifacts.classified, artifacts.base, artifacts.head, {
    decisionFilter: ['report-only'],
  });

  const applyResult = applyMarkedUpdatesToFiles(textUpdates, propUpdates, REPO_ROOT);
  logger.info(
    `apply: text hits=${applyResult.textHits}, prop hits=${applyResult.propHits}, missing=${applyResult.missingMarkers.length}`
  );

  let pathsToCommit: string[];
  let tier: 'hit' | 'fallback';
  let title: string;
  let commitMessage: string;

  if (applyResult.changedRepoPaths.length > 0) {
    pathsToCommit = applyResult.changedRepoPaths;
    tier = 'hit';
    const hits = applyResult.textHits + applyResult.propHits;
    title = `[designer-approved] ${csId} — ${hits} auto-edit(s)`;
    commitMessage = `design: ${csId} approved auto-apply`;
  } else {
    const magicPath = writeManualEditFile(REPO_ROOT, {
      csId,
      classified: artifacts.classified,
      viewerUrl: manifest.viewerUrl,
      missingMarkers: applyResult.missingMarkers,
    });
    pathsToCommit = [magicPath.startsWith(`${REPO_ROOT}/`) ? magicPath.slice(REPO_ROOT.length + 1) : magicPath];
    tier = 'fallback';
    title = `[designer-approved] ${csId} — manual edit needed`;
    commitMessage = `design: ${csId} approved (manual edit needed)`;
  }

  if (!octokit) {
    return {
      summary: `⚠️ Skipped PR creation (no GITHUB_TOKEN). Tier: ${tier}. Paths: ${pathsToCommit.join(', ')}`,
    };
  }

  const body = buildPrBody({
    csId,
    tier,
    applyResult,
    manifest,
    pathsToCommit,
  });

  const pr = await createOrUpdateDesignerPr({
    octokit,
    owner,
    repo,
    branch,
    title,
    body,
    labels: ['designer-approved'],
    commitMessage,
    paths: pathsToCommit,
  });

  if (pr.url) {
    logger.success(`PR ${pr.prNumber ? `#${pr.prNumber}` : ''} ${pr.url} (tier: ${tier})`);
    return {
      url: pr.url,
      summary: `✅ PR: ${pr.url} (tier: ${tier}, ${pathsToCommit.length} path(s))`,
    };
  }

  return {
    summary: `⚠️ PR not created (skipped: ${pr.skipped ?? 'unknown'}). Tier: ${tier}.`,
  };
}

interface CsArtifacts {
  classified: ClassifiedDiffFile;
  base: SnapshotFile;
  head: SnapshotFile;
}

function loadCsArtifacts(csId: string, manifest: CsManifest): CsArtifacts | null {
  const timestamp = csId.replace(/^cs-/, '');
  const classifiedPath = resolveAutomationPath(REPO_ROOT, manifest.classifiedDiffPath)
    || resolve(DIFFS_DIR, `${timestamp}-classified.json`);
  if (!existsSync(classifiedPath)) {
    logger.error(`Classified diff not found: ${classifiedPath}`);
    return null;
  }
  const classified = JSON.parse(readFileSync(classifiedPath, 'utf-8')) as ClassifiedDiffFile;
  const baseSnapshotPath = resolveAutomationPath(REPO_ROOT, manifest.baseSnapshotPath);
  const headSnapshotPath = resolveAutomationPath(REPO_ROOT, manifest.headSnapshotPath);
  if (!existsSync(baseSnapshotPath)) {
    logger.error(`Base snapshot not found: ${baseSnapshotPath}`);
    return null;
  }
  if (!existsSync(headSnapshotPath)) {
    logger.error(`Head snapshot not found: ${headSnapshotPath}`);
    return null;
  }
  return {
    classified,
    base: JSON.parse(readFileSync(baseSnapshotPath, 'utf-8')) as SnapshotFile,
    head: JSON.parse(readFileSync(headSnapshotPath, 'utf-8')) as SnapshotFile,
  };
}

interface BuildPrBodyInput {
  csId: string;
  tier: 'hit' | 'fallback';
  applyResult: MarkedApplyResult;
  manifest: CsManifest;
  pathsToCommit: readonly string[];
}

function buildPrBody(input: BuildPrBodyInput): string {
  const lines: string[] = [
    `## Designer approved \`${input.csId}\``,
    '',
    input.manifest.viewerUrl
      ? `Before/after viewer: ${input.manifest.viewerUrl}`
      : '_No viewer URL recorded in manifest._',
    '',
    `Tier: **${input.tier === 'hit' ? 'auto-edit (Tier 1/2 marker match)' : 'fallback (manual edit needed)'}**`,
    '',
    `- text marker hits: ${input.applyResult.textHits}`,
    `- prop marker hits: ${input.applyResult.propHits}`,
    `- missing markers: ${input.applyResult.missingMarkers.length}`,
    '',
    '## Files in this PR',
    '',
    ...input.pathsToCommit.map(p => `- \`${p}\``),
    '',
  ];

  if (input.tier === 'fallback') {
    const magicRel = manualEditFilePath(REPO_ROOT, input.csId).replace(`${REPO_ROOT}/`, '');
    lines.push(
      '## Next step',
      '',
      `Open \`${magicRel}\` for the change summary and code paths. Apply the edits manually, push to this PR branch, then merge.`,
      ''
    );
  }

  lines.push(
    '---',
    '',
    '_Generated by `designer-approval.ts` after the `designer-approved` label was applied._'
  );
  return lines.join('\n');
}

async function findOpenPrForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<string | null> {
  const list = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'open',
  });
  return list.data[0]?.html_url ?? null;
}

function resolveGithub(event: IssueEvent | null): {
  octokit: Octokit | null;
  owner: string;
  repo: string;
} {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = event?.repository?.full_name ?? process.env.GITHUB_REPOSITORY ?? '';
  const [owner = '', repo = ''] = repoFull.split('/');
  if (!token || !owner || !repo) {
    return { octokit: null, owner, repo };
  }
  return { octokit: new Octokit({ auth: token }), owner, repo };
}

function loadEvent(): IssueEvent | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;
  return JSON.parse(readFileSync(eventPath, 'utf-8')) as IssueEvent;
}

async function commentOnIssue(event: IssueEvent | null, body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = event?.repository?.full_name ?? process.env.GITHUB_REPOSITORY;
  const issueNumber = event?.issue?.number;
  if (!token || !repoFull || !issueNumber) return;
  const [owner, repo] = repoFull.split('/');
  const octokit = new Octokit({ auth: token });
  await octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

main().catch(err => {
  logger.error(String(err));
  process.exit(1);
});
