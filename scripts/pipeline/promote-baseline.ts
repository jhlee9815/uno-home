import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { Octokit } from 'octokit';
import {
  baselineBranchForCs,
  buildPromotePrBody,
  buildPromotePrTitle,
  decideBaselinePromote,
} from './lib/baseline-promote.ts';

const csId = process.argv[2];
if (!csId) {
  console.error('Usage: promote-baseline.ts <cs-id>');
  process.exit(1);
}

const BASELINE_DIR = '.automation/baseline';
const SNAPSHOTS_DIR = '.automation/snapshots';
const MANIFEST_PATH = `.automation/cs/${csId}.json`;

const dryRun = process.env.FIGMA_PROMOTE_DRY_RUN === '1';
const repoFull = process.env.GITHUB_REPOSITORY ?? '';
const [owner, repo] = repoFull.split('/');
const token = process.env.GITHUB_TOKEN;
const sourceWorkflow = process.env.MANIFEST_SOURCE_WORKFLOW ?? process.env.GITHUB_WORKFLOW ?? 'unknown';
const sourceRunUrl = process.env.MANIFEST_SOURCE_RUN_URL
  ?? (repoFull && process.env.GITHUB_RUN_ID
    ? `https://github.com/${repoFull}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined);

main().catch(err => {
  console.error(`[promote-baseline] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

async function main(): Promise<void> {
  if (!existsSync(MANIFEST_PATH)) {
    console.log(`[promote-baseline] manifest ${MANIFEST_PATH} not found; nothing to do`);
    return;
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as {
    csId: string;
    createdAt: string;
    headSnapshotPath?: string;
  };

  const snapshotPath = resolveSnapshotPath(csId, manifest.headSnapshotPath);
  const baselineFiles = existsSync(BASELINE_DIR) ? readdirSync(BASELINE_DIR) : [];

  const decision = decideBaselinePromote({
    manifest,
    snapshotPath,
    baselineFiles,
    baselineDir: BASELINE_DIR,
    now: new Date(),
    fileExists: existsSync,
    readFile: (p) => readFileSync(p, 'utf-8'),
  });

  if (decision.action === 'skip') {
    console.log(`[promote-baseline] skip: ${decision.reason}`);
    return;
  }

  if (dryRun) {
    console.log(
      `[promote-baseline] DRY-RUN would create ${decision.newBaselineRelPath} (${decision.snapshotContent.length} bytes, prev baseline: ${decision.currentBaseline ?? '<none>'})`,
    );
    return;
  }

  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY env var must be set (e.g. owner/repo) for real promote');
  }
  if (!token) {
    throw new Error('GITHUB_TOKEN env var is required for real promote');
  }

  exec('git fetch origin main');
  exec('git checkout main');
  exec('git reset --hard origin/main');
  const branch = baselineBranchForCs(csId);
  exec(`git checkout -B ${JSON.stringify(branch)}`);

  mkdirSync(dirname(decision.newBaselineRelPath), { recursive: true });
  writeFileSync(decision.newBaselineRelPath, decision.snapshotContent, 'utf-8');

  exec('git config user.name "designer-bot[bot]"');
  exec('git config user.email "designer-bot[bot]@users.noreply.github.com"');
  exec(`git remote set-url origin ${JSON.stringify(`https://x-access-token:${token}@github.com/${repoFull}.git`)}`);
  exec(`git add ${JSON.stringify(decision.newBaselineRelPath)}`);
  exec(`git commit -m ${JSON.stringify(`Promote baseline from ${csId}`)} || true`);
  exec(`git push origin ${JSON.stringify(branch)} --force-with-lease`);

  const octokit = new Octokit({ auth: token });
  const title = buildPromotePrTitle(csId);
  const body = buildPromotePrBody({
    csId,
    newBaselineName: decision.newBaselineName,
    previousBaseline: decision.currentBaseline,
    sourceWorkflow,
    sourceRunUrl,
  });

  const existing = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'open',
  });

  if (existing.data[0]) {
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: existing.data[0].number,
      title,
      body,
    });
    console.log(`[promote-baseline] updated PR #${existing.data[0].number}: ${existing.data[0].html_url}`);
    await enableAutoMerge(octokit, existing.data[0].node_id, existing.data[0].number);
    return;
  }

  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branch,
    base: 'main',
    title,
    body,
  });
  console.log(`[promote-baseline] created PR #${created.data.number}: ${created.data.html_url}`);
  await enableAutoMerge(octokit, created.data.node_id, created.data.number);
}

function resolveSnapshotPath(csId: string, headSnapshotPath: string | undefined): string | undefined {
  const csSuffix = csId.replace(/^cs-/, '');
  const localCandidate = `${SNAPSHOTS_DIR}/${csSuffix}.json`;
  if (existsSync(localCandidate)) return localCandidate;
  if (headSnapshotPath) {
    const downloaded = `${SNAPSHOTS_DIR}/${basename(headSnapshotPath)}`;
    if (existsSync(downloaded)) return downloaded;
    if (existsSync(headSnapshotPath)) return headSnapshotPath;
  }
  return undefined;
}

async function enableAutoMerge(octokit: Octokit, pullRequestId: string, prNumber: number): Promise<void> {
  try {
    await octokit.graphql(
      `mutation($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
        enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
          pullRequest { number }
        }
      }`,
      { pullRequestId, mergeMethod: 'SQUASH' },
    );
    console.log(`[promote-baseline] auto-merge enabled for PR #${prNumber}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[promote-baseline] auto-merge not enabled for PR #${prNumber}: ${message}`);
  }
}

function exec(cmd: string): string {
  console.log(`[promote-baseline] $ ${redact(cmd)}`);
  return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

function redact(value: string): string {
  return value.replace(/x-access-token:[^@]+@/g, 'x-access-token:<redacted>@');
}
