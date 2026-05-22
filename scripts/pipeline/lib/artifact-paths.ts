import { resolve } from 'node:path';

const AUTOMATION_SEGMENT = '.automation/';

/**
 * CS manifests are immutable and can contain absolute runner paths from an
 * earlier repository name. Artifact downloads restore the same `.automation/**`
 * tree under the current checkout, so remap that suffix when present.
 */
export function resolveAutomationPath(repoRoot: string, storedPath: string): string {
  if (!storedPath) return storedPath;
  if (storedPath.startsWith(AUTOMATION_SEGMENT)) {
    return resolve(repoRoot, storedPath);
  }

  const index = storedPath.indexOf(`/${AUTOMATION_SEGMENT}`);
  if (index !== -1) {
    return resolve(repoRoot, storedPath.slice(index + 1));
  }

  return storedPath;
}
