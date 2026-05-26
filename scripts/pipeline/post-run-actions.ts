#!/usr/bin/env tsx
/**
 * post-run-actions.ts
 *
 * Routes a single change-set report to downstream channels:
 *   - auto-apply changes  -> Draft PR (label: designer-bot, auto-apply)
 *   - report-only changes -> Issue   (label: designer-review, report-only)
 *   - notification        -> Slack / Discord webhook (when env set)
 *
 * Behavior:
 *   - Graceful no-op when channel env vars are missing.
 *   - DRY_RUN=1 logs every external call but does not perform it.
 *   - Reuses the per-cs branch name so repeat runs update the existing PR
 *     instead of opening duplicates.
 *   - Issue and PR creation run sequentially so manifest mutations
 *     (githubIssueNumber/Url) do not race on the same file.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Octokit } from 'octokit';
import { loadManifest, updateManifest } from './lib/cs-manifest.ts';
import { createOrUpdateDesignerPr, selectPathsForPrBranch } from './lib/github-pr.ts';
import { buildLocalizedSummary as buildLocalizedSummaryPure } from './lib/slack-summary.ts';
import { postWebhook } from './lib/webhook.ts';

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
    subcategories?: string[];
    reasons?: string[];
    decision: 'auto-apply' | 'report-only';
    target?: { section?: string };
    compliance?: {
      newDetachedStyles?: unknown[];
      newFrames?: unknown[];
      changedImageRefs?: unknown[];
    };
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

async function fetchAuditContext(): Promise<{ issueLink?: string; prLink?: string }> {
  if (!octokit) return {};
  const out: { issueLink?: string; prLink?: string } = {};
  const auditRunUrl = process.env.AUDIT_RUN_URL ?? '';
  try {
    // Only surface an audit Issue when the cascading audit run actually
    // produced one — figma-audit embeds its run URL in the Issue body
    // (`Workflow run: <url>`), so we accept the latest open Issue only if
    // its body references THIS audit run URL. Otherwise the audit either
    // found no violations (no Issue created) or the open Issue is from an
    // earlier day and would mislead the designer.
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner, repo, state: 'open', labels: 'audit', per_page: 1, sort: 'created', direction: 'desc',
    });
    const issue = issues[0];
    if (issue && auditRunUrl && (issue.body ?? '').includes(auditRunUrl)) {
      out.issueLink = `<${issue.html_url}|Issue #${issue.number}>`;
    }
  } catch {/* best-effort */}
  try {
    // Auto-register PRs are also gated to this audit run.
    //
    // figma-audit references its audit run URL in TWO places:
    //   1. PR body (`Audit run: <url>`) — only on the FIRST audit run that
    //      created the PR.
    //   2. PR comment (`Audit run <url> sighted N candidate(s) again ...`)
    //      — when a subsequent audit run reuses the still-open PR instead
    //      of creating a new one.
    //
    // We accept the PR if either surface contains the current AUDIT_RUN_URL,
    // otherwise we'd miss the very common reused-PR path (the daily cron
    // hits this every day until the maintainer merges/closes the PR).
    const { data: prs } = await octokit.rest.pulls.list({
      owner, repo, state: 'open', per_page: 5, sort: 'created', direction: 'desc',
    });
    const autoRegister = prs.find(p => p.labels.some(l => l.name === 'auto-register'));
    if (autoRegister && auditRunUrl) {
      const { data: full } = await octokit.rest.pulls.get({ owner, repo, pull_number: autoRegister.number });
      let matched = (full.body ?? '').includes(auditRunUrl);
      if (!matched) {
        const { data: comments } = await octokit.rest.issues.listComments({
          owner, repo, issue_number: autoRegister.number, per_page: 30,
        });
        matched = comments.some(c => (c.body ?? '').includes(auditRunUrl));
      }
      if (matched) out.prLink = `<${autoRegister.html_url}|PR #${autoRegister.number}>`;
    }
  } catch {/* best-effort */}
  return out;
}

// Slack `text` field is limited to 4000 chars; reserve ~500 chars for the
// viewer/repo/audit lines that the wrapper appends after the summary.
const SLACK_SUMMARY_MAX_CHARS = 3500;
// Discord `content` is limited to 2000 chars; reserve ~200 chars for the
// viewer/repo lines.
const DISCORD_SUMMARY_MAX_CHARS = 1800;

async function notifySlack(): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) { console.log('[slack] skipped (SLACK_WEBHOOK_URL not set)'); return; }
  const viewerLine = manifest?.viewerUrl ? `\n• 리뷰 viewer: <${manifest.viewerUrl}|${csId}>` : '';
  // Only enrich with audit context when this pipeline run was cascaded by
  // figma-audit. For ordinary repository_dispatch / scheduled / manual runs,
  // the "latest open audit Issue / auto-register PR" links are unrelated to
  // the diff being reported and would confuse the reader.
  const auditLines: string[] = [];
  if (process.env.TRIGGER_EVENT === 'workflow_run') {
    const audit = await fetchAuditContext();
    if (audit.issueLink) auditLines.push(`• 오늘의 audit Issue: ${audit.issueLink}`);
    if (audit.prLink) auditLines.push(`• 새 화면 등록 PR: ${audit.prLink}`);
  }
  const summaryLines = buildLocalizedSummaryPure(classified, { maxChars: SLACK_SUMMARY_MAX_CHARS });
  const summary =
    `🎨 *Figma 변경 감지* — \`${csId}\`\n` +
    summaryLines.join('\n') +
    (auditLines.length ? '\n' + auditLines.join('\n') : '') +
    viewerLine +
    `\n• repo: <https://github.com/${owner}/${repo}|${owner}/${repo}>`;
  await postWebhook({ url, payload: { text: summary }, label: 'slack', dryRun: DRY_RUN });
}

async function notifyDiscord(): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) { console.log('[discord] skipped (DISCORD_WEBHOOK_URL not set)'); return; }
  const viewerLine = manifest?.viewerUrl ? `\n리뷰 viewer: ${manifest.viewerUrl}` : '';
  const summaryLines = buildLocalizedSummaryPure(classified, { maxChars: DISCORD_SUMMARY_MAX_CHARS });
  const content =
    `🎨 **Figma 변경 감지** — \`${csId}\`\n` +
    summaryLines.join('\n') +
    viewerLine +
    `\nrepo: https://github.com/${owner}/${repo}`;
  await postWebhook({ url, payload: { content }, label: 'discord', dryRun: DRY_RUN });
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

  // Filter out manifest/viewer artifacts — those belong on main only.
  const codeChanges = selectPathsForPrBranch(
    exec('git status --porcelain'),
    ['.automation/', 'dist-viewer/']
  );
  if (codeChanges.length === 0) {
    console.log('[pr] skipped — apply.ts produced no code changes (apply is no-op)');
    return {};
  }

  const result = await createOrUpdateDesignerPr({
    octokit,
    owner,
    repo,
    branch: `designer-bot/${csId}`,
    title: `[designer-bot] ${csId} — ${autoApplyChanges.length} auto-apply change(s)`,
    body: truncateBody(csReportWithViewer),
    labels: ['designer-bot', 'auto-apply'],
    commitMessage: `design: ${csId} auto-apply`,
    paths: codeChanges,
    dryRun: DRY_RUN,
  });

  if (result.url) {
    console.log(`[pr] ${result.prNumber ? `#${result.prNumber}` : ''} ${result.url}`);
  } else if (result.skipped) {
    console.log(`[pr] skipped (${result.skipped})`);
  }
  return { url: result.url };
}

// ----- main -----

(async () => {
  try {
    const issueRes = await createOrUpdateIssue();
    const prRes = await createOrUpdatePR();
    await notifySlack();
    await notifyDiscord();
    console.log('[post-run] done');
    if (issueRes.url) console.log(`  issue: ${issueRes.url}`);
    if (prRes.url) console.log(`  pr:    ${prRes.url}`);
  } catch (err) {
    console.error('[post-run] failed:', err);
    process.exit(1);
  }
})();
