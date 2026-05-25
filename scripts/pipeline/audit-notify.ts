#!/usr/bin/env tsx
/**
 * audit-notify.ts
 *
 * Reads the JSON output produced by audit.ts (`audit_json` workflow output)
 * and posts a daily DS-compliance summary to Slack.
 *
 * Env:
 *   AUDIT_JSON          required — path to audit-*.json on disk
 *   SLACK_WEBHOOK_URL   required — Incoming Webhook URL
 *   ISSUE_URL           optional — link to the audit Issue created by the workflow
 *   RUN_URL             optional — link to the workflow run
 *   AUDIT_TOP_N         optional — override default top-N (5)
 *   DRY_RUN=1           optional — log instead of POSTing
 *
 * Policy: silent when report.hasViolations === false (matches the audit Issue
 * policy of only creating an Issue when violations are present).
 */

import { readFileSync } from 'node:fs';
import type { AuditReport } from './lib/audit-aggregator.ts';
import { buildAuditSlackMessage } from './lib/audit-slack.ts';
import { postWebhook } from './lib/webhook.ts';

async function main(): Promise<void> {
  const auditJsonPath = process.env.AUDIT_JSON;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  if (!auditJsonPath) {
    console.error('[audit-notify] AUDIT_JSON env var required');
    process.exit(1);
  }
  if (!slackUrl) {
    console.log('[audit-notify] skipped — SLACK_WEBHOOK_URL not set');
    return;
  }

  const raw = readFileSync(auditJsonPath, 'utf-8');
  const report = JSON.parse(raw) as AuditReport;

  if (!report.hasViolations) {
    console.log('[audit-notify] skipped — no violations (silent policy)');
    return;
  }

  const topN = process.env.AUDIT_TOP_N ? Number(process.env.AUDIT_TOP_N) : undefined;
  const message = buildAuditSlackMessage(report, {
    issueUrl: process.env.ISSUE_URL || undefined,
    runUrl: process.env.RUN_URL || undefined,
    topN,
  });

  await postWebhook({
    url: slackUrl,
    payload: { text: message.text },
    label: 'audit-slack',
    dryRun,
  });
}

main().catch(err => {
  console.error(`[audit-notify] unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
