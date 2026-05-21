import type { CsManifestState } from './cs-manifest.ts';

export interface IssueLike {
  title?: string;
  body?: string;
}

export function extractCsIdFromIssue(issue: IssueLike): string | null {
  const values = [issue.title, issue.body];
  for (const value of values) {
    const match = value?.match(/cs-\d{4}-\d{2}-\d{2}T[0-9-]+/);
    if (match) return match[0];
  }
  return null;
}

export function stateForDesignerLabel(label: string): CsManifestState | null {
  if (label === 'designer-approved') return 'designer-approved';
  if (label === 'designer-rejected') return 'designer-rejected';
  return null;
}

export function buildDesignerDecisionComment(state: CsManifestState, csId: string): string {
  if (state === 'designer-approved') {
    return `✅ Designer approval recorded for \`${csId}\`. Phase A records the decision; marker-based code automation follows in Task 10 Phase B.`;
  }
  if (state === 'designer-rejected') {
    return `🛑 Designer rejection recorded for \`${csId}\`. Baseline and code remain unchanged.`;
  }
  return `Designer decision recorded for \`${csId}\`: ${state}.`;
}
