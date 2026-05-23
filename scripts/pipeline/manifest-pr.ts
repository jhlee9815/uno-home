import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Octokit } from 'octokit';
import {
  buildManifestPrBody,
  buildManifestPrTitle,
  manifestBranchForCs,
  pathsFromPorcelain,
} from './lib/manifest-pr.ts';

const csId = process.argv[2];
if (!csId) {
  console.error('Usage: manifest-pr.ts <cs-id>');
  process.exit(1);
}

const repoFull = process.env.GITHUB_REPOSITORY ?? '';
const [owner, repo] = repoFull.split('/');
const token = process.env.GITHUB_TOKEN;
const sourceWorkflow = process.env.MANIFEST_SOURCE_WORKFLOW ?? process.env.GITHUB_WORKFLOW ?? 'unknown';
const sourceRunUrl = process.env.MANIFEST_SOURCE_RUN_URL
  ?? (repoFull && process.env.GITHUB_RUN_ID
    ? `https://github.com/${repoFull}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined);

if (!owner || !repo) {
  console.error('GITHUB_REPOSITORY env var must be set (e.g. owner/repo)');
  process.exit(1);
}
if (!token) {
  console.error('GITHUB_TOKEN env var is required');
  process.exit(1);
}

main().catch(err => {
  console.error(`[manifest-pr] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

async function main(): Promise<void> {
  if (!existsSync('.automation/cs')) {
    console.log('[manifest-pr] no .automation/cs directory; nothing to persist');
    return;
  }

  const initialStatus = exec('git status --porcelain -- .automation/cs');
  if (!initialStatus) {
    console.log('[manifest-pr] no CS manifest changes to persist');
    return;
  }
  const initialPaths = pathsFromPorcelain(initialStatus);
  if (initialPaths.length === 0) {
    console.log('[manifest-pr] no CS manifest json changes to persist');
    return;
  }
  const fileContents = initialPaths.map(path => ({
    path,
    content: readFileSync(path, 'utf-8'),
  }));

  exec('git fetch origin main');
  exec('git checkout main');
  exec('git reset --hard origin/main');
  const branch = manifestBranchForCs(csId);
  exec(`git checkout -B ${JSON.stringify(branch)}`);
  for (const file of fileContents) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content, 'utf-8');
  }

  const paths = pathsFromPorcelain(exec('git status --porcelain -- .automation/cs'));
  if (paths.length === 0) {
    console.log('[manifest-pr] no CS manifest json changes after restoring state; nothing to persist');
    return;
  }

  exec('git config user.name "designer-bot[bot]"');
  exec('git config user.email "designer-bot[bot]@users.noreply.github.com"');
  exec(`git remote set-url origin ${JSON.stringify(`https://x-access-token:${token}@github.com/${repoFull}.git`)}`);
  for (const path of paths) {
    exec(`git add ${JSON.stringify(path)}`);
  }
  exec(`git commit -m ${JSON.stringify(`Record CS manifest for ${csId}`)} || true`);
  exec(`git push origin ${JSON.stringify(branch)} --force-with-lease`);

  const octokit = new Octokit({ auth: token });
  const title = buildManifestPrTitle(csId);
  const body = buildManifestPrBody({ csId, sourceWorkflow, sourceRunUrl, paths });
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
    console.log(`[manifest-pr] updated PR #${existing.data[0].number}: ${existing.data[0].html_url}`);
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
  console.log(`[manifest-pr] created PR #${created.data.number}: ${created.data.html_url}`);
  await enableAutoMerge(octokit, created.data.node_id, created.data.number);
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
    console.log(`[manifest-pr] auto-merge enabled for PR #${prNumber}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[manifest-pr] auto-merge not enabled for PR #${prNumber}: ${message}`);
  }
}

function exec(cmd: string): string {
  console.log(`[manifest-pr] $ ${redact(cmd)}`);
  return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

function redact(value: string): string {
  return value.replace(/x-access-token:[^@]+@/g, 'x-access-token:<redacted>@');
}
