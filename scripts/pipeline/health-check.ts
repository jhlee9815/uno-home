#!/usr/bin/env tsx
/**
 * health-check.ts
 *
 * Quick operational summary for figma-pipeline over the last 24h.
 * Hits GitHub REST and prints a single-screen status overview with
 * anomaly hints. No external deps beyond what's already installed.
 *
 * Usage:
 *   npm run figma:health
 *   GITHUB_TOKEN=ghp_… npm run figma:health
 *   WINDOW_HOURS=72 npm run figma:health
 *
 * Token resolution: GITHUB_TOKEN env → macOS keychain (github.com) → error.
 */

import { execSync } from 'node:child_process';

const REPO = process.env.GITHUB_REPOSITORY ?? 'jhlee9815/design-review-bot';
const WORKFLOW_FILE = 'figma-pipeline.yml';
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS ?? 24);
const STALE_HOURS = Number(process.env.STALE_HOURS ?? 48);

const [owner, repo] = REPO.split('/');
const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);

function getToken(): string {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    const out = execSync('security find-internet-password -gw -s github.com 2>/dev/null', {
      encoding: 'utf8',
    }).trim();
    if (!out) throw new Error('empty');
    return out;
  } catch {
    throw new Error(
      'No GitHub token. Set GITHUB_TOKEN env var or store one in macOS keychain (github.com).'
    );
  }
}

async function ghJson<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${res.statusText} — ${path}\n${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface Run {
  id: number;
  status: string;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_started_at: string;
}

interface Issue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: { name: string }[];
  pull_request?: object;
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function durationSec(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

async function main() {
  const token = getToken();

  const runsResp = await ghJson<{ workflow_runs: Run[] }>(
    token,
    `/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=50&created=>=${since.toISOString()}`
  );
  const runs = runsResp.workflow_runs;

  const issuesResp = await ghJson<Issue[]>(
    token,
    `/repos/${owner}/${repo}/issues?labels=designer-review&state=open&per_page=50`
  );
  const openIssues = issuesResp.filter(i => !i.pull_request);

  const prsResp = await ghJson<Issue[]>(
    token,
    `/repos/${owner}/${repo}/issues?labels=designer-bot&state=open&per_page=50`
  );
  const openPrs = prsResp.filter(i => i.pull_request);

  // ── Header ──
  const winLabel = `${WINDOW_HOURS}h`;
  console.log(`\n=== figma-pipeline health (last ${winLabel}, repo: ${REPO}) ===\n`);

  // ── Runs section ──
  if (runs.length === 0) {
    console.log(`Runs              0 in window — workflow has not executed in last ${winLabel}.`);
  } else {
    const schedule = runs.filter(r => r.event === 'schedule').length;
    const manual = runs.filter(r => r.event === 'workflow_dispatch').length;
    const dispatch = runs.filter(r => r.event === 'repository_dispatch').length;
    const success = runs.filter(r => r.conclusion === 'success').length;
    const failure = runs.filter(r => r.conclusion === 'failure').length;
    const inProgress = runs.filter(r => r.conclusion === null).length;
    const completed = runs.filter(r => r.conclusion);
    const avg = completed.length
      ? Math.round(
          completed.reduce((s, r) => s + durationSec(r.run_started_at, r.updated_at), 0) /
            completed.length
        )
      : 0;
    const latest = runs[0];
    const earliest = runs[runs.length - 1];

    console.log(
      `Runs              ${runs.length}   (schedule: ${schedule}, manual: ${manual}, dispatch: ${dispatch})`
    );
    console.log(
      `Conclusion        ✅ success: ${success}   ❌ failure: ${failure}` +
        (inProgress ? `   ⏳ in-progress: ${inProgress}` : '')
    );
    console.log(`Avg duration      ${avg}s`);
    console.log(
      `Latest run        ${latest.created_at}  ${concIcon(latest.conclusion)}  ${latest.event}  (${ago(latest.created_at)})`
    );
    console.log(
      `Earliest run      ${earliest.created_at}  ${concIcon(earliest.conclusion)}  ${earliest.event}`
    );
  }

  // ── Issues ──
  console.log(`\nOpen issues       ${openIssues.length}   (label: designer-review)`);
  for (const i of openIssues.slice(0, 10)) {
    console.log(`  #${i.number}  ${trunc(i.title, 70)}   ${ago(i.created_at)}`);
  }

  // ── PRs ──
  console.log(`\nOpen PRs          ${openPrs.length}   (label: designer-bot)`);
  for (const p of openPrs.slice(0, 10)) {
    console.log(`  #${p.number}  ${trunc(p.title, 70)}   ${ago(p.created_at)}`);
  }

  // ── Anomalies ──
  const anomalies = detectAnomalies(runs, openIssues, openPrs);
  console.log(
    `\nAnomalies         ${anomalies.length === 0 ? '✅ none detected' : '⚠️  ' + anomalies.length}`
  );
  for (const a of anomalies) console.log(`  - ${a}`);

  console.log('');
}

function concIcon(c: string | null): string {
  if (c === 'success') return '✅';
  if (c === 'failure') return '❌';
  if (c === 'cancelled') return '⏹';
  if (c === null) return '⏳';
  return c;
}

function trunc(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function detectAnomalies(runs: Run[], issues: Issue[], prs: Issue[]): string[] {
  const out: string[] = [];

  // Consecutive failures from most recent — break on ANY completed non-failure
  // conclusion (success/cancelled/skipped/timed_out/…); skip in-progress (null).
  let consecutive = 0;
  for (const r of runs) {
    if (r.conclusion === 'failure') consecutive++;
    else if (r.conclusion !== null) break;
  }
  if (consecutive >= 2) {
    out.push(
      `${consecutive} consecutive failures (most recent: ${runs[0]?.html_url ?? 'n/a'})`
    );
  }

  // Stale issues / PRs (created_at + STALE_HOURS, no update since create)
  const staleMs = STALE_HOURS * 3600 * 1000;
  for (const i of issues) {
    const age = Date.now() - new Date(i.created_at).getTime();
    if (age > staleMs && i.created_at === i.updated_at) {
      out.push(`Issue #${i.number} unchanged for ${Math.floor(age / 3600000)}h`);
    }
  }
  for (const p of prs) {
    const age = Date.now() - new Date(p.created_at).getTime();
    if (age > staleMs && p.created_at === p.updated_at) {
      out.push(`PR #${p.number} unchanged for ${Math.floor(age / 3600000)}h`);
    }
  }

  return out;
}

main().catch(err => {
  console.error('[figma:health] failed:', err.message);
  process.exit(1);
});
