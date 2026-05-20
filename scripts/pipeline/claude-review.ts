/**
 * scripts/pipeline/claude-review.ts
 *
 * Wrapper that turns a classified diff JSON into a 3-section developer
 * checklist (Auto-applied / Claude review checklist / Human review required)
 * using the decision rules in `.claude/skills/uno-design-system/SKILL.md`
 * (or `apple-design-system/SKILL.md` for the Apple track).
 *
 * The wrapper is deterministic — it encodes the SKILL.md rule table in TS so
 * the demo runs offline with no API key required. The SKILL.md remains the
 * authoritative spec; if the rules diverge, the SKILL.md wins and this file
 * should be updated.
 *
 * Usage:
 *   npm run figma:claude-review                 # UNO track, latest classified
 *   npm run figma:claude-review -- --source apple
 *   npm run figma:claude-review -- --input .automation/diffs/<ts>-classified.json
 *   npm run figma:claude-review -- --output .automation/reports/custom.md
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.ts';
import type { ClassifiedChange, ClassifiedDiffFile } from './lib/classify-diff.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const DIFFS_DIR = resolve(REPO_ROOT, '.automation/diffs');
const REPORTS_DIR = resolve(REPO_ROOT, '.automation/reports');
const SKILL_UNO = resolve(REPO_ROOT, '.claude/skills/uno-design-system/SKILL.md');
const SKILL_APPLE = resolve(REPO_ROOT, '.claude/skills/apple-design-system/SKILL.md');

const logger = createLogger('claude-review');

type Source = 'uno' | 'apple';
type Band = 'auto' | 'claude' | 'human';

interface BandedChange {
  band: Band;
  reason: string;
  change: ClassifiedChange;
}

interface CliArgs {
  source: Source;
  inputPath: string | null;
  outputPath: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { source: 'uno', inputPath: null, outputPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') {
      const v = argv[++i];
      if (v !== 'uno' && v !== 'apple') {
        throw new Error(`--source must be 'uno' or 'apple' (got '${v}')`);
      }
      args.source = v;
    } else if (a === '--input') {
      args.inputPath = argv[++i];
    } else if (a === '--output') {
      args.outputPath = argv[++i];
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp(): void {
  process.stdout.write(`claude-review.ts — produce developer checklist from classified diff

Options:
  --source <uno|apple>   Skill to apply (default: uno)
  --input <path>         Classified diff JSON (default: latest in .automation/diffs/)
  --output <path>        Output markdown path (default: .automation/reports/claude-review-<ts>.md)
  -h, --help             Show this help
`);
}

function findLatestClassified(): string {
  if (!existsSync(DIFFS_DIR)) {
    throw new Error(`Diffs directory not found: ${DIFFS_DIR}. Run 'npm run figma:classify' first.`);
  }
  const candidates = readdirSync(DIFFS_DIR)
    .filter(name => name.endsWith('-classified.json'))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`No classified diff found in ${DIFFS_DIR}. Run 'npm run figma:classify' first.`);
  }
  return resolve(DIFFS_DIR, candidates.at(-1) as string);
}

/**
 * Band a single ClassifiedChange according to SKILL.md (uno-design-system) rules.
 * Mirrors the decision-rules table in SKILL.md §"Decision rules (Skill-side)".
 */
function bandUnoChange(c: ClassifiedChange): BandedChange {
  // Pipeline already decided auto-apply — trust it.
  if (c.decision === 'auto-apply') {
    return { band: 'auto', reason: 'Pipeline auto-apply target', change: c };
  }

  const section = c.target?.section ?? 'unknown';
  const classes = new Set(c.classes ?? []);

  // Unmapped target → always human review.
  if (section === 'unknown') {
    return {
      band: 'human',
      reason: 'No mapping entry — register in figma-mapping.yaml before next cycle',
      change: c,
    };
  }

  // Asset / layout / structure / unknown class → always human review.
  if (classes.has('asset')) {
    return { band: 'human', reason: 'Asset change (Lucide icon swap) — manual', change: c };
  }
  if (classes.has('layout') || classes.has('structure')) {
    return {
      band: 'human',
      reason: 'Layout/structure auto-apply is Phase 5-4 M4 (deferred)',
      change: c,
    };
  }
  if (classes.has('unknown')) {
    return { band: 'human', reason: 'Unknown change class — manual', change: c };
  }

  // text on screens → human review (designer-edit policy)
  if (classes.has('text') && section === 'screens') {
    return {
      band: 'human',
      reason: 'Screen text is permanent designer-edit policy (handoff.md)',
      change: c,
    };
  }

  // text on components/compositions → Claude review (no figma:text marker case)
  if (classes.has('text') && (section === 'components' || section === 'compositions')) {
    return {
      band: 'claude',
      reason: 'Text change without figma:text marker — propose exact code edit',
      change: c,
    };
  }

  // token drift → Claude review
  if (classes.has('token') && section === 'tokens') {
    return {
      band: 'claude',
      reason: 'Token value drift — verify against UNO neutral scale & downstream usage',
      change: c,
    };
  }

  // component-props on components/compositions → Claude review
  if (classes.has('component-props') && (section === 'components' || section === 'compositions')) {
    return {
      band: 'claude',
      reason: 'Variant prop change — list affected screens via mapping',
      change: c,
    };
  }

  // Fallback — anything else report-only → human review with reasons surfaced.
  return {
    band: 'human',
    reason: c.decisionReasons.join('; ') || 'No decision band rule matched',
    change: c,
  };
}

/**
 * Apple track has no classified diff. Skill takes apple-tokens.json + token-mapping.md
 * and produces a "current state checklist" of which Apple tokens map to which UNO targets.
 *
 * v1 implementation: render the existing token-mapping.md "자동 적용 가능성 분류" sections
 * as the 3-band output. This codifies that the Apple track currently has zero auto-apply
 * (no Figma binding) and the LLM-layer work is to refine which Claude/Human items move.
 */
function buildAppleReport(timestamp: string): string {
  const tokensPath = resolve(REPO_ROOT, 'design-systems/apple/apple-tokens.json');
  const mappingPath = resolve(REPO_ROOT, 'design-systems/apple/token-mapping.md');
  if (!existsSync(tokensPath) || !existsSync(mappingPath)) {
    throw new Error('Apple track inputs missing. Expected design-systems/apple/apple-tokens.json and token-mapping.md.');
  }

  // Apple-inspired only. Disclaimer required per SKILL.md.
  const header = [
    `# Claude review report — Apple-inspired track`,
    ``,
    `> Generated: ${timestamp}`,
    `> Skill: \`.claude/skills/apple-design-system/SKILL.md\``,
    `> Apple-inspired only. Not official Apple Design System. Not affiliated with Apple Inc.`,
    ``,
  ].join('\n');

  // Apple track has no Figma binding, so auto-apply is empty by definition.
  const auto = ['## Auto-applied (0 items)', '', '- _no items_ (Apple track has no Figma node bindings yet)', ''].join('\n');

  const claude = [
    '## Claude review checklist (4 items)',
    '',
    '- [ ] **apple.component.button.primaryBlue → src/components/Button.tsx** (component-props)',
    '  - Why this needs review: New Apple primary variant uses `--apple-color-blue` (#0071e3); UNO uses `--color-neutral-950`. Both can coexist as namespaced variants.',
    '  - Suggested developer action: Add a new `variant="apple-primary"` to Button.tsx that reads `--apple-color-blue` + radius `--apple-radius-standard`.',
    '  - Rollback: Remove the `apple-primary` branch from Button.tsx; no shared token touched.',
    '',
    '- [ ] **apple.component.card.productTile → src/components/Card.tsx** (component-props)',
    '  - Why this needs review: Light gray surface (`--apple-color-light-gray`) + rare shadow (`--apple-shadow-card`). UNO Card already uses `--background-card`. Decide whether to add an `apple-tile` variant.',
    '  - Suggested developer action: Extend Card.tsx with a `surface="apple-tile"` prop wired to `--apple-color-light-gray`. Keep default surface unchanged.',
    '  - Rollback: Remove the `apple-tile` branch.',
    '',
    '- [ ] **apple.typography.roles.displayHero → presentation hero only** (text)',
    '  - Why this needs review: 56px / 600 weight headline is not used in any current UNO screen. Suitable for a presentation hero, not for product screens.',
    '  - Suggested developer action: Create a one-off demo route (e.g. `src/screens/AppleDemoHero.tsx`) that uses Apple typography for the presentation; do NOT touch existing UNO typography classes.',
    '  - Rollback: Delete the demo route file.',
    '',
    '- [ ] **apple.typography.fontFamily.display → projectFallback** (token)',
    '  - Why this needs review: `display` value leads with "SF Pro Display, SF Pro Icons". SF Pro Icons is Apple-proprietary. Code should use `projectFallback` (Inter-led).',
    '  - Suggested developer action: When emitting `--apple-font-display` CSS, prefer the `projectFallback` value from apple-tokens.json. Keep the SF Pro chain as a comment-only reference.',
    '  - Rollback: Restore the SF Pro chain in any consuming CSS file.',
    '',
  ].join('\n');

  const human = [
    '## Human review required (3 items)',
    '',
    '- **apple.component.navigation.glass** (structure)',
    '  - Why blocked: Backdrop-filter glass nav is a new layout pattern, not present in UNO.',
    '  - Manual action: Designer + PM decide whether to introduce. If yes, scope to one demo screen only.',
    '',
    '- **Status color overlap (UNO red/yellow/green vs Apple single-blue accent)** (token)',
    '  - Why blocked: Apple single-accent philosophy conflicts with UNO health/state semantics.',
    '  - Manual action: Keep UNO status tokens authoritative; Apple track CTA/hero only.',
    '',
    '- **Full-app redesign suggestion** (structure)',
    '  - Why blocked: Listed in apple-tokens.json `automationPolicy.requiresHumanReview`.',
    '  - Manual action: Explicitly out of scope for this experiment.',
    '',
  ].join('\n');

  const footer = [
    '---',
    '',
    'Source: Markdown reference at `awesome-design-md/design-md/apple/DESIGN.md` — not affiliated with Apple Inc.',
    '',
  ].join('\n');

  return [header, auto, claude, human, footer].join('\n');
}

function renderUnoReport(classified: ClassifiedDiffFile, banded: BandedChange[], timestamp: string): string {
  const auto = banded.filter(b => b.band === 'auto');
  const claude = banded.filter(b => b.band === 'claude');
  const human = banded.filter(b => b.band === 'human');

  const header = [
    `# Claude review report — UNO HOME track`,
    ``,
    `> Generated: ${timestamp}`,
    `> Skill: \`.claude/skills/uno-design-system/SKILL.md\``,
    `> Classified source: \`${classified.headTs}\``,
    `> Classified summary: total=${classified.summary.total}, autoApply=${classified.summary.autoApply}, reportOnly=${classified.summary.reportOnly}, unknown=${classified.summary.unknown}`,
    ``,
  ].join('\n');

  const autoSection = [
    `## Auto-applied (${auto.length} items)`,
    ``,
    auto.length === 0
      ? `- _no items_`
      : auto.map(b => renderAutoLine(b)).join('\n'),
    ``,
  ].join('\n');

  const claudeSection = [
    `## Claude review checklist (${claude.length} items)`,
    ``,
    claude.length === 0
      ? `- _no items_`
      : claude.map(b => renderClaudeBlock(b)).join('\n'),
    ``,
  ].join('\n');

  const humanSection = [
    `## Human review required (${human.length} items)`,
    ``,
    human.length === 0
      ? `- _no items_`
      : human.map(b => renderHumanBlock(b)).join('\n'),
    ``,
  ].join('\n');

  const footer = [
    '---',
    '',
    `Generated by \`scripts/pipeline/claude-review.ts\` (deterministic encoding of SKILL.md rules — no API call).`,
    `To regenerate with an LLM-augmented natural-language summary, set \`ANTHROPIC_API_KEY\` and pass \`--use-claude\` (planned).`,
    ``,
  ].join('\n');

  return [header, autoSection, claudeSection, humanSection, footer].join('\n');
}

function renderAutoLine(b: BandedChange): string {
  const c = b.change;
  const before = formatValue(c.before);
  const after = formatValue(c.after);
  const code = c.target?.code ?? 'n/a';
  return `- \`${c.key}\`: ${before} → ${after} | mapping: ${c.target?.section ?? '?'}/${c.target?.apply ?? '?'} | code touched: \`${code}\``;
}

function renderClaudeBlock(b: BandedChange): string {
  const c = b.change;
  const summary = oneLineSummary(c);
  const action = suggestedAction(b);
  const rollback = suggestedRollback(b);
  return [
    `- [ ] **\`${c.key}\`** (${(c.classes || []).join(', ')}) — ${summary}`,
    `  - Why this needs review: ${b.reason}`,
    `  - Suggested developer action: ${action}`,
    `  - Rollback: ${rollback}`,
  ].join('\n');
}

function renderHumanBlock(b: BandedChange): string {
  const c = b.change;
  const summary = oneLineSummary(c);
  const code = c.target?.code ?? 'n/a';
  return [
    `- \`${c.key}\` (${(c.classes || []).join(', ')}) — ${summary}`,
    `  - Why blocked: ${b.reason}`,
    `  - Manual action: review \`${code}\` and decide registration / variant / explicit reject`,
  ].join('\n');
}

function oneLineSummary(c: ClassifiedChange): string {
  const before = formatValue(c.before);
  const after = formatValue(c.after);
  if (before === '∅' && after === '∅') {
    return `${c.nodeName || c.key} changed (no before/after captured)`;
  }
  return `${c.nodeName || c.key}: ${before} → ${after}`;
}

function suggestedAction(b: BandedChange): string {
  const c = b.change;
  if (c.classes.includes('token')) {
    return `Inspect \`src/index.css\` for the impacted variable; if value is out-of-system, add a new primitive or reject.`;
  }
  if (c.classes.includes('text')) {
    return `Update the text in \`${c.target?.code ?? 'the component file'}\` to match the new Figma value.`;
  }
  if (c.classes.includes('component-props')) {
    return `Update the variant default or call sites in \`${c.target?.code ?? 'the component file'}\`; verify all screens that consume the component.`;
  }
  return `Open \`${c.target?.code ?? 'the target file'}\` and apply the change manually.`;
}

function suggestedRollback(b: BandedChange): string {
  return `git checkout HEAD -- ${b.change.target?.code ?? '<file>'}  (this repo was initialized 2026-05-20)`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '...' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
  } catch {
    return '<unserializable>';
  }
}

function timestampNow(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19);
}

function ensureSkillExists(source: Source): void {
  const skillPath = source === 'uno' ? SKILL_UNO : SKILL_APPLE;
  if (!existsSync(skillPath)) {
    throw new Error(`Skill file missing: ${skillPath}. Write the Skill before running this wrapper.`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  ensureSkillExists(args.source);

  const ts = timestampNow();
  const outputPath = args.outputPath ?? resolve(REPORTS_DIR, `claude-review-${args.source}-${ts}.md`);

  let markdown: string;
  if (args.source === 'apple') {
    logger.info('Generating Apple-track review (no classified diff required)');
    markdown = buildAppleReport(ts);
  } else {
    const inputPath = args.inputPath ?? findLatestClassified();
    logger.info(`Reading classified diff: ${inputPath}`);
    const classified = JSON.parse(readFileSync(inputPath, 'utf-8')) as ClassifiedDiffFile;
    const banded = classified.changes.map(bandUnoChange);
    markdown = renderUnoReport(classified, banded, ts);
  }

  writeFileSync(outputPath, markdown, 'utf-8');
  logger.info(`Wrote ${outputPath}`);
}

main();
