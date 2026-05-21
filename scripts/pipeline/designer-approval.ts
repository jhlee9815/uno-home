import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Octokit } from 'octokit';
import { createLogger } from './lib/logger.ts';
import { transitionManifest, type CsManifestState } from './lib/cs-manifest.ts';
import { buildDesignerDecisionComment, extractCsIdFromIssue, stateForDesignerLabel } from './lib/designer-approval.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const logger = createLogger('designer-approval');

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

  const manifest = transitionManifest(REPO_ROOT, csId, {
    state,
    at: new Date().toISOString(),
    by: actor,
    via: `label:${label}`,
    note: event?.issue?.html_url,
  });
  logger.success(`Manifest ${csId} transitioned to ${manifest.state}`);
  await commentOnIssue(event, state, csId);
}

function loadEvent(): IssueEvent | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;
  return JSON.parse(readFileSync(eventPath, 'utf-8')) as IssueEvent;
}

async function commentOnIssue(event: IssueEvent | null, state: CsManifestState, csId: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = event?.repository?.full_name ?? process.env.GITHUB_REPOSITORY;
  const issueNumber = event?.issue?.number;
  if (!token || !repoFull || !issueNumber) return;
  const [owner, repo] = repoFull.split('/');
  const octokit = new Octokit({ auth: token });
  const body = buildDesignerDecisionComment(state, csId);
  await octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

main().catch(err => {
  logger.error(String(err));
  process.exit(1);
});
