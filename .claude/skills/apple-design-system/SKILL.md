---
name: apple-design-system
description: Translate Apple-inspired Markdown design system changes into developer checklists. Use when the experiment track (apple-tokens.json / token-mapping.md / design-systems/apple/) is the source of design changes, instead of the UNO Figma pipeline. Produces the same auto / Claude-summary / human-review band shape as the uno-design-system skill — keep both skills schema-aligned.
metadata:
  source: Apple-inspired Markdown DS (awesome-design-md/design-md/apple, adapted to design-systems/apple/)
  schemaVersion: 1
  parentTrack: Apple-inspired DS experiment (project-plan/archive/phase-1..5)
  disclaimer: Apple-inspired only. Not official Apple Design System. Not affiliated with Apple Inc.
---

# Apple-inspired Design System Skill

## Why this Skill is separate from `uno-design-system`

| Axis | UNO DS | Apple-inspired |
|---|---|---|
| Source of truth | Figma file `qDCHLZbwY41wKVYIVXiZst` | Markdown `DESIGN.md` + `apple-tokens.json` |
| Pipeline coupling | Drives `snapshot → diff → classify` directly | No Figma node IDs — no automated snapshot/diff possible |
| Token style | `--color-*`, `--background-*`, `--text-*` (UNO naming) | `--apple-color-*`, `--apple-radius-*` (Apple-prefixed) |
| Use case | Daily product work | Presentation / experiment track |

The two Skills share output shape on purpose, so a single reviewer (the wrapper `scripts/pipeline/claude-review.ts`) can call either based on the `source` field of the input.

## Inputs (do NOT modify these files)

| Path | Purpose |
|---|---|
| `design-systems/apple/apple-tokens.json` | Authoritative Apple-inspired token JSON (DTCG-style). |
| `design-systems/apple/token-mapping.md` | UNO ↔ Apple correspondence + risk table. |
| `design-systems/apple/preview.html` | Visual reference for hero / typography / dark mode. |
| `project-plan/archive/phase-2/apple-tokens.json` | Mirror under archived phase folder. Same content. |
| `project-plan/archive/phase-2/source-summary.md` | Phase 2 record (archived). |
| External (read-only): `/Users/juhee/Work/Test/awesome-design-md/design-md/apple/DESIGN.md` | Original Markdown source. Cite, do not edit. |

Since there is no Figma snapshot, the "diff" input for this Skill is a hand-authored or wrapper-generated change list comparing `apple-tokens.json` between two timestamps (or between `apple-tokens.json` and the current UNO `index.css`).

## Output shape

Identical to `uno-design-system` — three sections, in this order:

```markdown
## Auto-applied (N items)
- {key}: {before} → {after} | mapping: {section}/{apply} | code touched: {file}

## Claude review checklist (M items)
- [ ] **{key}** ({class}) — {one-line summary}
  - Why this needs review: {reason}
  - Suggested developer action: {concrete step referencing existing token or component file}
  - Rollback: {how to revert if shipped wrong}

## Human review required (K items)
- {key} ({class}) — {what the Skill can't decide}
  - Why blocked: {reason}
  - Manual action: {who should look, with which file}
```

If a section is empty, write `- _no items_`.

## Decision rules (Apple track)

The Apple track has no Figma classify stage, so the Skill itself is the classifier. Use the rules below.

| Change kind | Skill band | Reason |
|---|---|---|
| Color HEX / rgba value swap within the `apple.primitives.color.*` set | **Auto-applied** | CSS variable rename only. Safe via `design-systems/apple/apple-tokens.css` once generated. |
| Radius value change | **Auto-applied** | Single-value swap. |
| Shadow value change | **Auto-applied** | Single-value swap. |
| Typography font-size / font-weight / line-height / letter-spacing | **Claude review** | May break vertical rhythm — list affected roles and suggest re-checking the preview. |
| Semantic role retargeting (e.g. `background.page` now points to a different primitive) | **Claude review** | Many components depend on semantic tokens; enumerate consumers from `token-mapping.md`. |
| Adding a new primitive that no semantic role uses | **Claude review** | Token-orphan flag. Suggest binding or removing. |
| Component definition change (Button, Card, Hero) in `apple.component.*` | **Claude review** | Cite the corresponding UNO component file (Button.tsx, Card.tsx) and flag what needs to change there. |
| Layout / spacing rhythm change (large additions to `apple.spacing.scale`) | **Human review** | Layout class is permanently manual on the UNO side; mirror that policy here. |
| Photography / brand fit / navigation structure | **Human review** | Listed in `apple-tokens.json`'s `automationPolicy.requiresHumanReview`. |
| Full-app redesign suggestion ("replace UNO buttons with Apple buttons") | **Human review** | Listed in `automationPolicy.requiresHumanReview`. |

## Token name policy (Apple track)

Refer to Apple tokens by their JSON dot-path or CSS variable form:

- JSON: `apple.primitives.color.appleBlue`, `apple.typography.roles.displayHero`, `apple.radius.pill`.
- CSS (when proposing code edits): `--apple-color-blue`, `--apple-radius-pill`, `--apple-shadow-card`.
- Font family: prefer `apple.typography.fontFamily.projectFallback` (Inter-led) over `display`/`text` (SF Pro-led) when suggesting code edits — SF Pro Icons is Apple-proprietary, don't push it into the codebase.

When the diff introduces a value outside the current `apple-tokens.json`, flag as "out-of-system" inside Claude review with the suggestion to either (a) add the value to `apple-tokens.json` AND `token-mapping.md`, or (b) reject the change.

## Component coverage (Apple track)

The current Apple experiment intentionally scopes to a handful of components. Use this table:

| Apple component | UNO mapping candidate | Skill band default | Notes |
|---|---|---|---|
| `apple.component.button.primaryBlue` | `src/components/Button.tsx` variant=primary | Claude review | Variant swap requires Button.tsx + style adjustments. |
| `apple.component.button.primaryDark` | `src/components/Button.tsx` variant=ghost or new variant | Claude review | New variant — needs Button.tsx update. |
| `apple.component.button.pillLink` | (no UNO equivalent) | Claude review | Suggest new variant `pill-link` if accepted. |
| `apple.component.card.productTile` | `src/components/Card.tsx` | Claude review | Light gray surface + rare shadow. |
| `apple.component.navigation.glass` | (no UNO equivalent) | Human review | Backdrop-filter usage — designer decides whether to introduce. |
| `apple.component.hero.productHero` | (no UNO equivalent) | Human review | Full-width section — new layout pattern. |

## Disclaimer requirements

Any developer-facing output from this Skill that mentions "Apple" must include one of:

- A header phrase: "Apple-inspired (not official Apple DS)".
- A footer line: "Source: Markdown reference at awesome-design-md/design-md/apple/DESIGN.md — not affiliated with Apple Inc."

This mirrors the disclaimer policy already in `preview.html` (pill note) and `apple-tokens.json` (`$metadata.sourceType`).

## Anti-patterns to refuse

- Do **not** propose bundling SF Pro / SF Pro Display / SF Pro Icons font files into the project.
- Do **not** suggest renaming UNO tokens to Apple naming — Apple lives under its own `--apple-*` namespace.
- Do **not** auto-apply changes that affect UNO HOME's status color system (red/yellow/green/blue). Apple uses a single-blue-accent philosophy that intentionally conflicts with UNO status semantics.
- Do **not** modify input files. Read-only Skill.
- Do **not** invent visual claims about official Apple designs.

## How this Skill is invoked

- Primary: via the same wrapper `scripts/pipeline/claude-review.ts` with `--source apple` (or auto-detect from input path).
- Manual: `claude --skill apple-design-system` from `uno-home/` with the change list as input.
- Demo: `npm run figma:claude-review -- --source apple` (after Phase 3 wrapper lands).

## Cross-track interaction

Apple-inspired changes never overwrite UNO tokens. If a Claude review item proposes a CSS edit that would touch `src/index.css`, the Skill must explicitly state "this edit lives in `design-systems/apple/apple-tokens.css` (Apple adapter), NOT in `src/index.css` (UNO)".
