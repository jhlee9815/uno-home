import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.ts';
import { loadFigmaConfig, loadFigmaMapping, type MappingEntry } from './lib/config-loader.ts';
import { baselineImagePath, fetchAndSaveFigmaImages } from './lib/figma-images.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const REPORTS_DIR = resolve(REPO_ROOT, '.automation/reports');
const logger = createLogger('images-bootstrap');

interface Target {
  key: string;
  fileKey: string;
  nodeId: string;
  nodeName: string;
}

async function main(): Promise<void> {
  const config = loadFigmaConfig();
  const mapping = loadFigmaMapping();
  const defaultFileKey = config.figma.fileKey;
  const targets = collectTargets(mapping.components, defaultFileKey)
    .concat(collectTargets(mapping.compositions, defaultFileKey))
    .concat(collectTargets(mapping.screens, defaultFileKey));

  if (targets.length === 0) {
    logger.warn('No mapped Figma nodes found for image bootstrap.');
    return;
  }

  logger.info(`Bootstrapping baseline images for ${targets.length} mapped node(s).`);
  const lines: string[] = [
    '# Figma baseline image bootstrap',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Targets: ${targets.length}`,
    '',
    '| Key | Node | Status | Sha256 |',
    '|---|---|---|---|',
  ];

  for (const [fileKey, fileTargets] of groupByFile(targets)) {
    logger.info(`Fetching ${fileTargets.length} image(s) from file ${fileKey}`);
    const hashes = await fetchAndSaveFigmaImages({
      fileKey,
      nodeIds: fileTargets.map(t => t.nodeId),
      pathForNode: nodeId => baselineImagePath(REPO_ROOT, nodeId),
    });
    for (const target of fileTargets) {
      const hash = hashes[target.nodeId];
      lines.push(
        `| \`${target.key}\` | ${target.nodeName} (\`${target.nodeId}\`) | ${hash ? 'saved' : 'missing'} | ${hash ?? 'null'} |`
      );
    }
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = resolve(REPO_ROOT, '.automation/reports', `images-bootstrap-${safeTimestamp(new Date().toISOString())}.md`);
  writeFileSync(reportPath, lines.join('\n') + '\n', 'utf-8');
  logger.success(`Baseline image bootstrap report written: ${reportPath}`);
}

function collectTargets(entries: Record<string, MappingEntry>, defaultFileKey: string): Target[] {
  return Object.entries(entries)
    .filter(([, entry]) => Boolean(entry.figmaNodeId))
    .map(([key, entry]) => ({
      key,
      fileKey: entry.figmaFileKey || defaultFileKey,
      nodeId: entry.figmaNodeId as string,
      nodeName: entry.figmaNodeName || key,
    }));
}

function groupByFile(targets: Target[]): Map<string, Target[]> {
  const grouped = new Map<string, Target[]>();
  for (const target of targets) {
    grouped.set(target.fileKey, [...(grouped.get(target.fileKey) ?? []), target]);
  }
  return grouped;
}

function safeTimestamp(timestamp: string): string {
  return timestamp.replace(/:/g, '-').replace(/\..+$/, '');
}

main().catch(err => {
  logger.error(String(err));
  process.exit(1);
});
