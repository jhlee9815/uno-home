import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './lib/logger.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const CANDIDATES_PATH = resolve(REPO_ROOT, '.automation/audit-candidates.json');
// Mirror config-loader.ts: FIGMA_CONFIG_DIR env var wins so downstream
// template installs that point at their own config directory get the
// auto-registered entries appended to *their* mapping, not the repo's.
const CONFIG_DIR = process.env.FIGMA_CONFIG_DIR
  ? resolve(process.env.FIGMA_CONFIG_DIR)
  : resolve(REPO_ROOT, 'config');
const MAPPING_PATH = resolve(CONFIG_DIR, 'figma-mapping.yaml');

const logger = createLogger('auto-register');

interface Candidate {
  nodeId: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sightingCount: number;
}

interface CandidatesFile {
  generatedAt: string;
  threshold: number;
  candidates: Candidate[];
}

export function generateMappingKey(c: Candidate): string {
  const slug = c.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'frame';
  const idPart = c.nodeId.replace(/:/g, '_');
  return `auto_${slug}_${idPart}`;
}

export function buildYamlEntry(c: Candidate, today: string): string {
  const key = generateMappingKey(c);
  const safeName = yamlScalar(c.name);
  return [
    `  # Auto-registered by figma-audit on ${today} (sighted ${c.sightingCount} times, first seen ${c.firstSeenAt.slice(0, 10)})`,
    `  ${key}:`,
    `    figmaNodeId: "${c.nodeId}"`,
    `    figmaNodeName: ${safeName}`,
    `    figmaNodePath: []`,
    `    code: ../src/screens/FigmaFrameTracking.ts`,
    `    targetType: screen`,
    `    automation:`,
    `      apply: report-only`,
    `      audit: include`,
    `      allowedClasses:`,
    `        - token`,
    `        - text`,
    `        - layout`,
    `        - structure`,
    ``,
  ].join('\n');
}

function yamlScalar(value: string): string {
  // YAML 1.1 flow scalars: quote when the value contains special chars or
  // could be parsed as something other than a string.
  if (/[:#&*!|>%@`{}[\],]/.test(value) || /^[-?]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function main(): void {
  if (!existsSync(CANDIDATES_PATH)) {
    logger.info('No candidates file. Run figma:audit first.');
    process.exit(0);
  }
  let data: CandidatesFile;
  try {
    data = JSON.parse(readFileSync(CANDIDATES_PATH, 'utf-8')) as CandidatesFile;
  } catch (err) {
    logger.error(`Could not parse candidates file: ${String(err)}`);
    process.exit(1);
  }
  if (data.candidates.length === 0) {
    logger.info('No auto-register candidates. Nothing to do.');
    process.exit(0);
  }

  if (!existsSync(MAPPING_PATH)) {
    logger.error(`Mapping not found at ${MAPPING_PATH}`);
    process.exit(1);
  }
  let mappingContent = readFileSync(MAPPING_PATH, 'utf-8');
  if (!mappingContent.endsWith('\n')) mappingContent += '\n';

  // Idempotency: skip candidates whose nodeId already appears in mapping
  // (e.g. registered by a hand-edit between the audit and this step).
  const additions: string[] = [];
  const registered: Candidate[] = [];
  const skipped: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const c of data.candidates) {
    const idLiteral = `figmaNodeId: "${c.nodeId}"`;
    if (mappingContent.includes(idLiteral)) {
      skipped.push(c.nodeId);
      continue;
    }
    additions.push(buildYamlEntry(c, today));
    registered.push(c);
  }

  if (additions.length === 0) {
    logger.info(`All ${data.candidates.length} candidates already registered. Nothing to do.`);
    if (skipped.length) logger.info(`Skipped (already in mapping): ${skipped.join(', ')}`);
    surfaceOutput([], skipped);
    process.exit(0);
  }

  const newContent = mappingContent + additions.join('');
  writeFileSync(MAPPING_PATH, newContent, 'utf-8');
  logger.success(
    `Registered ${additions.length} candidates (skipped ${skipped.length} already-mapped)`
  );
  for (const c of registered) {
    logger.info(`  + ${generateMappingKey(c)} → ${c.nodeId}  (${c.name})`);
  }

  surfaceOutput(registered, skipped);
}

function isEntryPoint(): boolean {
  const thisFile = fileURLToPath(import.meta.url);
  return process.argv[1] === thisFile;
}

function surfaceOutput(registered: Candidate[], skipped: string[]): void {
  if (!process.env.GITHUB_OUTPUT) return;
  const out = [
    `registered_count=${registered.length}`,
    `skipped_count=${skipped.length}`,
    `registered_ids=${registered.map(c => c.nodeId).join(',')}`,
    `registered_names=${registered.map(c => c.name).join(' | ')}`,
  ].join('\n');
  try {
    const cur = existsSync(process.env.GITHUB_OUTPUT) ? readFileSync(process.env.GITHUB_OUTPUT, 'utf-8') : '';
    writeFileSync(process.env.GITHUB_OUTPUT, `${cur}${out}\n`, 'utf-8');
  } catch (err) {
    logger.warn(`Could not write GITHUB_OUTPUT: ${String(err)}`);
  }
}

if (isEntryPoint()) main();
