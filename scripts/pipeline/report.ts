import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.ts';
import {
  buildDesignerReport,
  hashArtifacts,
  shouldCreateDesignerReport,
  type DesignerReportInput,
} from './lib/designer-review.ts';
import { createManifest, sha256File } from './lib/cs-manifest.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const REPORTS_DIR = resolve(REPO_ROOT, '.automation/reports');

const logger = createLogger('report');

function main(): void {
  logger.info('Starting report.ts — designer review report generation');

  const verifyPath = findLatestReport('verify-');
  if (!verifyPath) {
    logger.error(`No verify report found in ${REPORTS_DIR}. Run npm run figma:verify first.`);
    process.exit(1);
  }

  const verifyMarkdown = readFileSync(verifyPath, 'utf-8');
  const verifyFields = parseFrontmatter(verifyMarkdown, verifyPath);
  if (verifyFields.get('status') !== 'passed') {
    logger.error(`Verify report is not passed: ${verifyPath}`);
    process.exit(1);
  }

  const changeSetId = required(verifyFields, 'changeSetId');
  const applyReportPath = required(verifyFields, 'applyReport');
  const classifiedPath = required(verifyFields, 'classifiedPath');

  const applyMarkdown = readFileSync(applyReportPath, 'utf-8');
  const classifiedJson = readFileSync(classifiedPath, 'utf-8');
  const classified = JSON.parse(classifiedJson) as {
    generatedAt?: string;
    fileKey?: string;
    basePath?: string;
    headPath?: string;
    summary?: DesignerReportInput['classifiedSummary'];
    changes?: Array<{ compliance?: DesignerReportInput['complianceSummary'] }>;
  };
  const classifiedSummary = classified.summary ?? {
    total: 0,
    autoApply: 0,
    reportOnly: 0,
    unknown: 0,
  };
  if (!shouldCreateDesignerReport(classifiedSummary)) {
    logger.info(`No classified changes for ${changeSetId}. Designer review report skipped.`);
    return;
  }

  const reportOnlyReportPath = findReportOnlyReport(classified.generatedAt);
  const reportOnlyMarkdown = reportOnlyReportPath ? readFileSync(reportOnlyReportPath, 'utf-8') : '';

  const complianceSummary = aggregateCompliance(classified.changes ?? []);

  const report = buildDesignerReport({
    changeSetId,
    classifiedPath,
    applyReportPath,
    verifyReportPath: verifyPath,
    reportOnlyReportPath,
    classifiedSummary,
    applyStatus: required(verifyFields, 'applyStatus'),
    verifyStatus: required(verifyFields, 'status'),
    changedFiles: extractChangedFiles(applyMarkdown),
    visualReportPath: findVisualReport(changeSetId),
    verificationRows: extractVerifyRows(verifyMarkdown),
    generatedAt: new Date().toISOString(),
    artifactsSha256: hashArtifacts([classifiedJson, applyMarkdown, verifyMarkdown, reportOnlyMarkdown]),
    complianceSummary,
  });

  const outputPath = resolve(REPORTS_DIR, `${changeSetId}.md`);
  writeFileSync(outputPath, report, 'utf-8');
  logger.success(`Designer review report written: ${outputPath}`);

  createManifest(REPO_ROOT, {
    csId: changeSetId,
    createdAt: new Date().toISOString(),
    fileKey: classified.fileKey ?? 'unknown',
    baseSnapshotPath: classified.basePath ?? '',
    headSnapshotPath: classified.headPath ?? '',
    classifiedDiffPath: classifiedPath,
    reportPath: outputPath,
    classifiedDiffSha256: sha256File(classifiedPath),
    headSnapshotSha256: existsSync(classified.headPath ?? '') ? sha256File(classified.headPath as string) : 'sha256:missing',
    runId: process.env.GITHUB_RUN_ID ?? null,
    actor: process.env.GITHUB_ACTOR ?? process.env.USER ?? 'local',
  });
  logger.info(`CS manifest written: ${resolve(REPO_ROOT, '.automation/cs', `${changeSetId}.json`)}`);

  notifyDesigner(changeSetId, outputPath);
  logger.info(`Approve: npm run figma:approve ${changeSetId}`);
  logger.info(`Reject:  npm run figma:reject ${changeSetId} "reason"`);
}

function findLatestReport(prefix: string): string | null {
  if (!existsSync(REPORTS_DIR)) {
    return null;
  }

  const files = readdirSync(REPORTS_DIR)
    .filter(file => file.startsWith(prefix) && file.endsWith('.md'))
    .sort()
    .reverse();

  return files[0] ? resolve(REPORTS_DIR, files[0]) : null;
}

function findVisualReport(changeSetId: string): string | undefined {
  const visualReportPath = resolve(REPORTS_DIR, changeSetId, 'visual-diff.md');
  return existsSync(visualReportPath) ? visualReportPath : undefined;
}

function findReportOnlyReport(classifiedGeneratedAt: string | undefined): string | undefined {
  if (!classifiedGeneratedAt) {
    return undefined;
  }

  const reportPath = resolve(REPORTS_DIR, `diff-report-only-${safeTimestamp(classifiedGeneratedAt)}.md`);
  return existsSync(reportPath) ? reportPath : undefined;
}

function parseFrontmatter(markdown: string, path: string): Map<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error(`Report missing frontmatter: ${path}`);
  }

  const fields = new Map<string, string>();
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index === -1) {
      continue;
    }
    fields.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  return fields;
}

function required(fields: Map<string, string>, key: string): string {
  const value = fields.get(key);
  if (!value) {
    throw new Error(`Missing '${key}' in report frontmatter`);
  }
  return value;
}

function extractChangedFiles(markdown: string): string[] {
  const section = markdown.match(/## Changed Files\n\n([\s\S]*?)(\n## |\n?$)/);
  if (!section) {
    return [];
  }
  return section[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- `'))
    .map(line => line.replace(/^- `/, '').replace(/`$/, ''))
    .filter(file => file !== 'None');
}

function safeTimestamp(timestamp: string): string {
  return timestamp.replace(/:/g, '-').replace(/\..+$/, '');
}

function extractVerifyRows(markdown: string): DesignerReportInput['verificationRows'] {
  const rows: DesignerReportInput['verificationRows'] = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| ') || line.includes('---') || line.includes('Check | Command')) {
      continue;
    }
    const cells = line
      .slice(2, -2)
      .split(' | ')
      .map(cell => cell.trim());
    if (cells.length < 5) {
      continue;
    }
    rows.push({
      check: cells[0],
      status: cells[2],
      message: cells[4],
    });
  }
  return rows;
}

function aggregateCompliance(
  changes: Array<{ compliance?: DesignerReportInput['complianceSummary'] }>
): DesignerReportInput['complianceSummary'] | undefined {
  const newDetachedStyles: NonNullable<DesignerReportInput['complianceSummary']>['newDetachedStyles'] = [];
  const newFrames: NonNullable<DesignerReportInput['complianceSummary']>['newFrames'] = [];
  const changedImageRefs: NonNullable<DesignerReportInput['complianceSummary']>['changedImageRefs'] = [];
  for (const change of changes) {
    if (!change.compliance) continue;
    newDetachedStyles.push(...change.compliance.newDetachedStyles);
    newFrames.push(...change.compliance.newFrames);
    changedImageRefs.push(...change.compliance.changedImageRefs);
  }
  if (newDetachedStyles.length === 0 && newFrames.length === 0 && changedImageRefs.length === 0) {
    return undefined;
  }
  return { newDetachedStyles, newFrames, changedImageRefs };
}

function notifyDesigner(changeSetId: string, outputPath: string): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const result = spawnSync('osascript', [
    '-e',
    `display notification "검토 리포트가 생성되었습니다: ${changeSetId}" with title "UNO HOME Figma Pipeline" subtitle "${outputPath}"`,
  ]);

  if (result.error || result.status !== 0) {
    logger.warn('macOS notification skipped; report generation succeeded.');
  }
}

main();
