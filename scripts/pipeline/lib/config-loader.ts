import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// config/ directory (repo root config/ by default).
// Downstream repos can point the pipeline at their own config directory via
// the FIGMA_CONFIG_DIR env var without editing source files.
const CONFIG_DIR = process.env.FIGMA_CONFIG_DIR
  ? resolve(process.env.FIGMA_CONFIG_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../../config');

export interface FigmaConfig {
  figma: {
    fileKey: string;
    fileUrl: string;
    designSystemFileKey?: string;
    designSystemFileUrl?: string;
  };
  automation: {
    stages: string[];
  };
}

export type AuditMode = 'skip' | 'include';

export interface MappingEntry {
  figmaFileKey?: string | null;
  figmaNodeId: string | null;
  figmaNodeName: string | null;
  figmaNodePath: string[] | null;
  code: string;
  targetType: string;
  automation: {
    apply: string;
    allowedClasses?: string[];
    // 'skip' excludes the entry from `npm run figma:audit` output.
    // Use for intentional reference frames (e.g. Codex-generated DS preview)
    // that shouldn't be flagged for detached styles.
    audit?: AuditMode;
  };
}

export interface FigmaMapping {
  version: number;
  project: {
    name: string;
    figmaFileKey: string;
  };
  pathResolution: {
    base: string;
    description?: string;
  };
  tokens: {
    source: { file: string };
    output: { css: string };
    automation: { classes: string[]; apply: string };
  };
  // Top-level audit overrides for nodes that aren't registered as mapping
  // entries (e.g. icon libraries living next to tracked screens).
  audit?: {
    excludeNodeIds?: string[];
  };
  components: Record<string, MappingEntry>;
  compositions: Record<string, MappingEntry>;
  screens: Record<string, MappingEntry & { route?: string }>;
}

export function loadFigmaConfig(): FigmaConfig {
  const filePath = resolve(CONFIG_DIR, 'figma.yaml');
  if (!existsSync(filePath)) {
    throw new ConfigError(`figma.yaml not found at: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new ConfigError(`Failed to parse figma.yaml: ${String(err)}`);
  }

  const cfg = parsed as Record<string, unknown>;

  const figmaSection = cfg?.figma as Record<string, unknown> | undefined;
  if (!figmaSection?.fileKey || typeof figmaSection.fileKey !== 'string') {
    throw new ConfigError('figma.yaml: figma.fileKey is required');
  }
  if (!figmaSection?.fileUrl || typeof figmaSection.fileUrl !== 'string') {
    throw new ConfigError('figma.yaml: figma.fileUrl is required');
  }

  const automationSection = cfg?.automation as Record<string, unknown> | undefined;
  if (!Array.isArray(automationSection?.stages) || automationSection.stages.length === 0) {
    throw new ConfigError('figma.yaml: automation.stages must be a non-empty array');
  }

  const config = parsed as FigmaConfig;
  const fileKeyOverride = process.env.FIGMA_FILE_KEY?.trim();
  if (fileKeyOverride) {
    config.figma.fileKey = fileKeyOverride;
  }

  return config;
}

export function loadFigmaMapping(): FigmaMapping {
  const filePath = resolve(CONFIG_DIR, 'figma-mapping.yaml');
  if (!existsSync(filePath)) {
    throw new ConfigError(`figma-mapping.yaml not found at: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new ConfigError(`Failed to parse figma-mapping.yaml: ${String(err)}`);
  }

  const m = parsed as Record<string, unknown>;

  if (!m?.version) {
    throw new ConfigError('figma-mapping.yaml: version is required');
  }
  if (!m?.project) {
    throw new ConfigError('figma-mapping.yaml: project is required');
  }
  if (!m?.pathResolution) {
    throw new ConfigError('figma-mapping.yaml: pathResolution is required');
  }
  if (!m?.tokens) {
    throw new ConfigError('figma-mapping.yaml: tokens is required');
  }
  if (!m?.components) {
    throw new ConfigError('figma-mapping.yaml: components is required');
  }
  if (!m?.compositions) {
    throw new ConfigError('figma-mapping.yaml: compositions is required');
  }
  if (!m?.screens) {
    throw new ConfigError('figma-mapping.yaml: screens is required');
  }

  const mapping = parsed as FigmaMapping;

  const allMappingEntries: [string, MappingEntry][] = [
    ...Object.entries(mapping.components),
    ...Object.entries(mapping.compositions),
    ...Object.entries(mapping.screens),
  ];

  for (const [key, entry] of allMappingEntries) {
    const required = ['figmaNodeId', 'figmaNodeName', 'figmaNodePath', 'code', 'targetType', 'automation'];
    for (const field of required) {
      if (!(field in entry)) {
        throw new ConfigError(`figma-mapping.yaml: entry '${key}' is missing field '${field}'`);
      }
    }
  }

  return mapping;
}

export function resolveCodePath(relPath: string): string {
  return resolve(CONFIG_DIR, relPath);
}
