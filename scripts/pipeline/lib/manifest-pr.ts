export interface ManifestPrBodyInput {
  csId: string;
  sourceWorkflow: string;
  sourceRunUrl?: string;
  paths: readonly string[];
}

export function manifestBranchForCs(csId: string): string {
  assertCsId(csId);
  return `manifest/${csId}`;
}

export function buildManifestPrTitle(csId: string): string {
  assertCsId(csId);
  return `[manifest] ${csId} — persist CS state`;
}

export function buildManifestPrBody(input: ManifestPrBodyInput): string {
  const lines = [
    `Persist immutable CS manifest state for \`${input.csId}\`.`,
    '',
    '**Why a PR (not direct push):** main is protected. The `validate` check must pass before merge, so workflow-generated CS state is persisted through this branch instead of pushing straight to `main`.',
    '',
    `Source workflow: \`${input.sourceWorkflow}\``,
  ];

  if (input.sourceRunUrl) {
    lines.push(`Source run: ${input.sourceRunUrl}`);
  }

  lines.push('', '## Files', '', ...input.paths.map(path => `- \`${path}\``), '', '_Created by manifest persistence automation._');
  return lines.join('\n');
}

export function pathsFromPorcelain(statusPorcelain: string): string[] {
  return statusPorcelain
    .split('\n')
    .map(line => line.slice(3).trim())
    .filter(path => path.startsWith('.automation/cs/') && path.endsWith('.json'));
}

function assertCsId(csId: string): void {
  if (!/^cs-[A-Za-z0-9T_.:-]+$/.test(csId)) {
    throw new Error(`Invalid cs id: ${csId}`);
  }
}
