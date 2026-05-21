import { execSync } from 'node:child_process';
import type { Octokit } from 'octokit';

export interface DesignerPrInput {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  baseBranch?: string;
  title: string;
  body: string;
  labels?: readonly string[];
  commitMessage: string;
  draft?: boolean;
  paths: readonly string[];
  dryRun?: boolean;
  authorName?: string;
  authorEmail?: string;
}

export interface DesignerPrResult {
  url?: string;
  prNumber?: number;
  branch: string;
  committedPaths: string[];
  skipped?: 'no-paths' | 'dry-run' | 'no-token';
}

const DEFAULT_AUTHOR_NAME = 'designer-bot';
const DEFAULT_AUTHOR_EMAIL = 'designer-bot@users.noreply.github.com';
const DEFAULT_BASE = 'main';

function exec(cmd: string): string {
  return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

/**
 * Commit explicit paths to a branch and open or update the matching PR.
 *
 * Caller responsibilities:
 *   - paths must already exist on disk before calling
 *   - paths should NOT include manifest/audit-trail artifacts that
 *     belong on main (e.g. .automation/cs/, .automation/diffs/, etc.)
 *   - caller restores working tree state (e.g. checkout main) after
 *     this returns; this function deliberately does not reset HEAD
 *
 * Behaviour:
 *   - empty paths array → skipped 'no-paths', no PR created
 *   - dryRun → all git/octokit calls logged, skipped 'dry-run'
 *   - branch already pushed with matching open PR → update body only
 *   - no existing PR → create draft PR + apply labels
 */
export async function createOrUpdateDesignerPr(input: DesignerPrInput): Promise<DesignerPrResult> {
  const {
    octokit,
    owner,
    repo,
    branch,
    baseBranch = DEFAULT_BASE,
    title,
    body,
    labels = [],
    commitMessage,
    draft = true,
    paths,
    dryRun = false,
    authorName = DEFAULT_AUTHOR_NAME,
    authorEmail = DEFAULT_AUTHOR_EMAIL,
  } = input;

  if (paths.length === 0) {
    return { branch, committedPaths: [], skipped: 'no-paths' };
  }

  if (dryRun) {
    console.log(`[github-pr dry-run] would create or update PR for ${branch} with ${paths.length} path(s)`);
    return { branch, committedPaths: [...paths], skipped: 'dry-run' };
  }

  exec(`git config user.name ${JSON.stringify(authorName)}`);
  exec(`git config user.email ${JSON.stringify(authorEmail)}`);
  exec(`git checkout -B ${branch}`);
  for (const path of paths) {
    exec(`git add ${JSON.stringify(path)}`);
  }
  exec(`git commit -m ${JSON.stringify(commitMessage)} || true`);
  exec(`git push origin ${branch} --force-with-lease`);

  const existing = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'open',
  });

  if (existing.data.length > 0) {
    const pr = existing.data[0];
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: pr.number,
      body,
    });
    return { url: pr.html_url, prNumber: pr.number, branch, committedPaths: [...paths] };
  }

  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branch,
    base: baseBranch,
    title,
    body,
    draft,
  });

  if (labels.length > 0) {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: created.data.number,
      labels: [...labels],
    });
  }

  return {
    url: created.data.html_url,
    prNumber: created.data.number,
    branch,
    committedPaths: [...paths],
  };
}

/**
 * Filter `git status --porcelain` output to the path list that should
 * be committed to a PR branch. excludePrefixes drops manifest/audit-
 * trail artifacts that belong on main only.
 */
export function selectPathsForPrBranch(
  statusPorcelain: string,
  excludePrefixes: readonly string[]
): string[] {
  return statusPorcelain
    .split('\n')
    .map(line => line.slice(3))
    .filter(path => path && !excludePrefixes.some(prefix => path.startsWith(prefix)));
}
