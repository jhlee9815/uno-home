#!/usr/bin/env tsx
/**
 * post-run-actions.ts
 *
 * Routes a single change-set report to downstream channels:
 *   - auto-apply changes  -> Draft PR (label: designer-bot, auto-apply)
 *   - report-only changes -> Issue   (label: designer-review, report-only)
 *   - notification        -> Slack / Discord webhook (when env set)
 *   - email digest        -> Resend (task-6 wires this in)
 *
 * Behavior:
 *   - Graceful no-op when channel env vars are missing.
 *   - DRY_RUN=1 logs every external call but does not perform it.
 *   - Reuses the per-cs branch name so repeat runs update the existing PR
 *     instead of opening duplicates.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Octokit } from 'octokit';
import { loadManifest, updateManifest } from './lib/cs-manifest.ts';

const csId = process.argv[2];
if (!csId) {
  console.error('Usage: post-run-actions.ts <cs-id>');
  console.error('Example: post-run-actions.ts cs-2026-05-20T05-48-54');
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const REPO_FULL = process.env.GITHUB_REPOSITORY ?? '';
const [owner, repo] = REPO_FULL.split('/');
const token = process.env.GITHUB_TOKEN;

if (!owner || !repo) {
  console.error('GITHUB_REPOSITORY env var must be set (e.g. owner/repo)');
  process.exit(1);
}
if (!token && !DRY_RUN) {
  console.error('GITHUB_TOKEN env var required (or set DRY_RUN=1 for local testing)');
  process.exit(1);
}

// ----- read inputs -----

const reportsDir = resolve('.automation/reports');
const diffsDir = resolve('.automation/diffs');

const csPath = join(reportsDir, `${csId}.md`);
if (!existsSync(csPath)) {
  console.error(`cs report not found: ${csPath}`);
  process.exit(1);
}
const csReport = readFileSync(csPath, 'utf-8');
const manifest = loadManifestIfPresent(csId);
const csReportWithViewer = prependViewerLink(csReport, manifest?.viewerUrl);

// classified diff lives at .automation/diffs/<timestamp>-classified.json
// cs-id format: cs-<timestamp> -> classified file: <timestamp>-classified.json
const timestampPart = csId.replace(/^cs-/, '');
const classifiedPath = join(diffsDir, `${timestampPart}-classified.json`);
if (!existsSync(classifiedPath)) {
  console.error(`classified diff not found: ${classifiedPath}`);
  process.exit(1);
}
const classified = JSON.parse(readFileSync(classifiedPath, 'utf-8')) as {
  summary: { total: number; autoApply: number; reportOnly: number; unknown: number };
  changes: Array<{
    key: string;
    nodeId: string;
    nodeName: string;
    classes: string[];
    decision: 'auto-apply' | 'report-only';
    target?: { section?: string };
  }>;
};

const autoApplyChanges = classified.changes.filter(c => c.decision === 'auto-apply');
const reportOnlyChanges = classified.changes.filter(c => c.decision === 'report-only');

console.log(`[post-run] cs=${csId}  auto-apply=${autoApplyChanges.length}  report-only=${reportOnlyChanges.length}`);
if (DRY_RUN) console.log('[post-run] DRY_RUN=1 — no external calls will be made');

// ----- helpers -----

const octokit = token ? new Octokit({ auth: token }) : null;

function exec(cmd: string): string {
  if (DRY_RUN) {
    console.log(`[dry-run exec] ${cmd}`);
    return '';
  }
  return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

async function postWebhook(url: string, payload: object, label: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[dry-run ${label}] POST ${url.replace(/[A-Za-z0-9_-]{20,}/g, '<redacted>')}`);
    return;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.warn(`[${label}] webhook returned ${res.status} ${res.statusText}`);
  } else {
    console.log(`[${label}] notified`);
  }
}

function truncateBody(body: string, maxLen = 60000): string {
  if (body.length <= maxLen) return body;
  return body.slice(0, maxLen) + `\n\n---\n_Report truncated — see workflow artifact for full content._`;
}


function loadManifestIfPresent(id: string): { viewerUrl?: string } | null {
  try {
    return loadManifest(process.cwd(), id);
  } catch {
    return null;
  }
}

function prependViewerLink(body: string, viewerUrl: string | undefined): string {
  if (!viewerUrl) return body;
  return `> 🔎 Before/after viewer: ${viewerUrl}

${body}`;
}

function updateManifestIssue(id: string, issueNumber: number, issueUrl: string): void {
  try {
    updateManifest(process.cwd(), id, current => ({
      ...current,
      githubIssueNumber: issueNumber,
      githubIssueUrl: issueUrl,
    }));
  } catch {
    // Manifest is best-effort for legacy change sets.
  }
}

// ----- notify channels -----

async function notifySlack(): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) { console.log('[slack] skipped (SLACK_WEBHOOK_URL not set)'); return; }
  const summary =
    `🎨 *Figma 변경 감지* — \`${csId}\`\n` +
    `• auto-apply: ${classified.summary.autoApply}건\n` +
    `• report-only: ${classified.summary.reportOnly}건\n` +
    `• repo: <https://github.com/${owner}/${repo}|${owner}/${repo}>`;
  await postWebhook(url, { text: summary }, 'slack');
}

async function notifyDiscord(): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) { console.log('[discord] skipped (DISCORD_WEBHOOK_URL not set)'); return; }
  const content =
    `🎨 **Figma 변경 감지** — \`${csId}\`\n` +
    `auto-apply: ${classified.summary.autoApply}건 · report-only: ${classified.summary.reportOnly}건\n` +
    `repo: https://github.com/${owner}/${repo}`;
  await postWebhook(url, { content }, 'discord');
}

// ----- GitHub Issue (report-only) -----

async function createOrUpdateIssue(): Promise<{ url?: string }> {
  if (reportOnlyChanges.length === 0) {
    console.log('[issue] skipped (no report-only changes)');
    return {};
  }
  if (!octokit) {
    console.log('[issue] skipped (no GITHUB_TOKEN)');
    return {};
  }
  const title = `[designer-review] ${csId} — ${reportOnlyChanges.length} item(s) need review`;
  if (DRY_RUN) {
    console.log(`[issue dry-run] would create or update: ${title}`);
    return {};
  }
  // Search for an existing open issue with the same csId in title (dedupe)
  const search = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${owner}/${repo} is:issue is:open in:title "${csId}"`,
  });
  if (search.data.total_count > 0) {
    const existing = search.data.items[0];
    console.log(`[issue] existing open issue found: #${existing.number} — updating body`);
    if (!DRY_RUN) {
      await octokit.rest.issues.update({
        owner, repo, issue_number: existing.number,
        body: truncateBody(csReportWithViewer),
      });
    }
    updateManifestIssue(csId, existing.number, existing.html_url);
    return { url: existing.html_url };
  }
  const created = await octokit.rest.issues.create({
    owner, repo,
    title,
    body: truncateBody(csReportWithViewer),
    labels: ['designer-review', 'report-only'],
  });
  updateManifestIssue(csId, created.data.number, created.data.html_url);
  console.log(`[issue] created: #${created.data.number} ${created.data.html_url}`);
  return { url: created.data.html_url };
}

// ----- GitHub PR (auto-apply) -----

async function createOrUpdatePR(): Promise<{ url?: string }> {
  if (autoApplyChanges.length === 0) {
    console.log('[pr] skipped (no auto-apply changes)');
    return {};
  }
  if (!octokit) {
    console.log('[pr] skipped (no GITHUB_TOKEN)');
    return {};
  }

  const branchName = `designer-bot/${csId}`;
  if (DRY_RUN) {
    console.log(`[pr dry-run] would create or update Draft PR for ${branchName}`);
    return {};
  }

  // git status: see if there are actual code changes to push
  const dirty = exec('git status --porcelain').length > 0;
  if (!dirty) {
    console.log('[pr] skipped — apply.ts produced no code changes (apply is no-op)');
    return {};
  }

  // commit to branch
  exec('git config user.name "designer-bot"');
  exec('git config user.email "designer-bot@users.noreply.github.com"');
  exec(`git checkout -B ${branchName}`);
  exec('git add -A');
  exec(`git commit -m "design: ${csId} auto-apply" || true`);
  exec(`git push origin ${branchName} --force-with-lease`);

  // find existing open PR for branch
  const prs = await octokit.rest.pulls.list({
    owner, repo, head: `${owner}:${branchName}`, state: 'open',
  });

  if (prs.data.length > 0) {
    const pr = prs.data[0];
    console.log(`[pr] existing PR #${pr.number} — updating body`);
    if (!DRY_RUN) {
      await octokit.rest.pulls.update({
        owner, repo, pull_number: pr.number,
        body: truncateBody(csReportWithViewer),
      });
    }
    return { url: pr.html_url };
  }

  const pr = await octokit.rest.pulls.create({
    owner, repo,
    head: branchName,
    base: 'main',
    title: `[designer-bot] ${csId} — ${autoApplyChanges.length} auto-apply change(s)`,
    body: truncateBody(csReportWithViewer),
    draft: true,
  });
  await octokit.rest.issues.addLabels({
    owner, repo, issue_number: pr.data.number,
    labels: ['designer-bot', 'auto-apply'],
  });
  console.log(`[pr] created Draft PR #${pr.data.number} ${pr.data.html_url}`);
  return { url: pr.data.html_url };
}

// ----- main -----

(async () => {
  try {
    const [issueRes, prRes] = await Promise.all([
      createOrUpdateIssue(),
      createOrUpdatePR(),
    ]);
    await notifySlack();
    await notifyDiscord();
    // Resend email is wired in task-6 — placeholder noop here
    if (process.env.RESEND_API_KEY) {
      console.log('[email] RESEND_API_KEY detected — implementation arrives in task-6');
    }
    console.log('[post-run] done');
    if (issueRes.url) console.log(`  issue: ${issueRes.url}`);
    if (prRes.url) console.log(`  pr:    ${prRes.url}`);
  } catch (err) {
    console.error('[post-run] failed:', err);
    process.exit(1);
  }
})();
