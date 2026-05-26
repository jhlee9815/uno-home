---
name: uno-design-system
description: Translate UNO HOME design system Figma changes into developer checklists. Use when a classified diff JSON, a Figma change report, or a designer review (cs-{id}.md) needs to be turned into a per-change action list with auto / Claude-summary / human-review categories. Inputs are deterministic — this Skill adds the natural-language layer on top of the existing classify-diff stage.
metadata:
  source: UNO Design System (Figma file qDCHLZbwY41wKVYIVXiZst, Mobile mode)
  schemaVersion: 1
  parentTrack: uno-home main app track
---

# UNO Design System Skill

## What this Skill does

Takes a classified diff (output of `scripts/pipeline/lib/classify-diff.ts`) and produces a developer-facing checklist for one change-set.

The existing pipeline already classifies each change as **auto-apply** or **report-only** based on `figma-mapping.yaml` policy. This Skill adds a third decision band — **Claude-summary** — for report-only items that are too important to leave as a raw markdown table but not safe to auto-apply.

## Inputs (do NOT modify these files)

| Path | Purpose |
|---|---|
| `.automation/diffs/<ts>-classified.json` | Classified diff from `npm run figma:classify`. Authoritative input. |
| `config/figma-mapping.yaml` | 186 mapping entries. Determines section + apply policy + allowedClasses. |
| `src/index.css` | UNO DS tokens (Tailwind v4 `@theme` + `:root` semantic layer). Authoritative token source. |
| `tokens.json` | Mirror of token values for reference/diff. |
| `design-system.md` | Human-readable spec. |
| `src/components/` | 12 atomic components (Avatar, Badge, Button, Card, Chip, Icon, Input, OTPGroup, StatusBar, Switch, Text, Toast). |
| `phase6/phase6-2.md` | Token sync mapping notes. |
| `phase7/` | Component spec history. |

## Output shape

A single markdown block with three sections, in this order:

```markdown
## Auto-applied (N items)
- {key}: {before} → {after} | mapping: {section}/{apply} | code touched: {file}

## Claude review checklist (M items)
- [ ] **{key}** ({class}) — {one-line summary}
  - Why this needs review: {reason}
  - Suggested developer action: {concrete step referencing existing token or component file}
  - Rollback: {how to revert if shipped wrong}

## Human review required (K items)
- {key} ({class}) — {what the pipeline couldn't classify}
  - Why blocked: {decisionReasons joined}
  - Manual action: {who should look, with which file}
```

If any section is empty, write `- _no items_` rather than omitting the header — keeps the report shape stable for downstream tooling.

## Decision rules (Skill-side)

These are applied AFTER the pipeline's auto-apply / report-only split.

| Pipeline decision | Change class | Target section | Skill band | Reason |
|---|---|---|---|---|
| `auto-apply` | any | tokens / components / compositions | **Auto-applied** | Already safe. Pipeline output is the truth. |
| `report-only` | `token` | tokens | **Claude review** | Token value drift — usually a single CSS variable change, summarize and flag downstream usage. |
| `report-only` | `text` | components / compositions | **Claude review** | Text content change without `figma:text` marker — Claude can suggest the exact code edit. |
| `report-only` | `text` | screens | **Human review** | Screen text is permanent designer-edit policy (see STATUS.md §4 designer workflow). Do not suggest code edits. |
| `report-only` | `component-props` | components / compositions | **Claude review** | Variant changes — list which prop changed and which screen consumers exist. |
| `report-only` | `layout` / `structure` | any | **Human review** | Layout/structure auto-apply is Phase 5-4 M4 (currently deferred). |
| `report-only` | `asset` / `unknown` | any | **Human review** | Lucide icons (asset) and unknown classes are always manual. |
| `report-only` | any | unknown | **Human review** | No mapping entry — needs `figma-mapping.yaml` registration before next cycle. |

## UNO DS token name policy

When producing the checklist, refer to tokens by their `src/index.css` name, not by HEX or Figma variable name:

- Color: `var(--color-{group}-{step})` (e.g. `--color-red-600`) for primitives; `var(--{semantic-group}-{role})` (e.g. `--text-primary`, `--background-card`) for semantic.
- Spacing: `var(--spacing-{n})` where n ∈ {2,4,6,8,10,12,14,16,18,20,24,28,32,36,40,48,64,72,80}.
- Radius: `var(--radius-{xs|sm|md|lg|xl|full})`.
- Shadow: `var(--shadow-{xs|sm|md|lg|focus|error})`.
- Typography: class names `text-mobile-{h1|h2|h3|title|body-large|body-large-strong|body-small|body-small-strong|caption|chip-caption}`.

If the diff introduces a value that does not match any token, flag as "token-out-of-system" inside Claude review with the suggestion to either (a) add the new token to `src/index.css` if it's intentional, or (b) reject the change.

## Component coverage policy

| Component | Auto/Partial candidate? | Notes for checklist |
|---|---|---|
| Button | partial | variant + size are auto-applicable via `figma:prop`. text content is `figma:text`. |
| Input | partial | error/label/helper variants — verify Filled vs Focused vs Error visual diff before approving. |
| Badge | partial | ADMIN / MEMBER / OWNER color tokens. |
| Avatar | partial | size + state. Active state uses `interactive/primary`. |
| Card / Toast / Text / Switch / Chip | report-only | Newer additions (Phase 7-2). Marker coverage may be incomplete. |
| StatusBar / Icon | report-only | StatusBar is system-level. Icon uses Lucide (asset class — always human review). |
| OTPGroup | partial | 6-cell state machine — full visual diff required for any token change. |
| BottomNav | **not implemented** | No code target — historical Phase 7-2 design defers it. Any BottomNav change → Human review with note "no code target yet". |

## Page mapping reminder

Screens are 173 entries, mostly `report-only` in the mapping. 8 have a `route:` and participate in visual diff. The Skill must check:

- If the change's `target.section === 'screens'` AND `target.code` points to `src/screens/FigmaFrameTracking.ts`, that means the frame is tracking-only. Put it in **Human review** with note "tracking-only frame, no React route yet — register a route or leave as report-only".
- If the change touches a routed screen (`route` exists), the visual diff result from `verify-cs-{id}.md` is the authoritative signal; the Skill should quote the visual diff outcome in the checklist line.

## Worked example (Button variant change)

Given a classified change:

```json
{
  "key": "components:Button:variant",
  "classes": ["component-props"],
  "decision": "auto-apply",
  "target": { "section": "components", "apply": "partial", "code": "../src/components/Button.tsx" },
  "before": "Primary",
  "after": "Secondary"
}
```

Output line under `## Auto-applied`:

```
- components:Button:variant: Primary → Secondary | mapping: components/partial | code touched: src/components/Button.tsx
```

Given a classified change where decision is `report-only` because the new color is not a token:

```json
{
  "key": "tokens:color:button-primary-default",
  "classes": ["token"],
  "decision": "report-only",
  "decisionReasons": ["Classes not allowed by mapping: token"],
  "target": { "section": "tokens", "apply": "report-only" },
  "before": "#171717",
  "after": "#1a2236"
}
```

Output line under `## Claude review checklist`:

```
- [ ] **tokens:color:button-primary-default** (token) — primary button background drift from #171717 to #1a2236
  - Why this needs review: New value is not in the UNO neutral scale; closest token is --color-neutral-900 (#171717). "Token-out-of-system" flag.
  - Suggested developer action: Decide whether to (a) accept and add a new primitive in src/index.css, or (b) reject and ask designer to use --color-neutral-900.
  - Rollback: revert --button-primary-default value in src/index.css to var(--color-neutral-950).
```

## Anti-patterns to refuse

- Do **not** suggest "approve all" or "reject all" — the Skill must produce per-change lines.
- Do **not** invent design intent. If `before/after` doesn't explain why, write "Designer rationale not in diff — ask designer".
- Do **not** propose layout changes via code. Layout class is permanently `report-only` until Phase 5-4 M4.
- Do **not** modify any input file. The Skill is read-only on the project; it only produces markdown.
- Do **not** quote `.env` contents (FIGMA_TOKEN) under any circumstance.

## How this Skill is invoked

Primary path: via `scripts/pipeline/claude-review.ts` (wrapper) which reads the latest `.automation/diffs/<ts>-classified.json` and outputs a markdown block to `.automation/reports/claude-review-<ts>.md`. The wrapper passes the JSON content to Claude with this SKILL.md as the operating contract.

Manual path: `claude` CLI from `uno-home/` with `--skill uno-design-system` and the classified JSON as input.

Demo path (for the presentation): `npm run figma:claude-review` runs the wrapper end-to-end on the most recent classified diff.

## Pipeline interaction summary

```
Figma file → snapshot → diff → classify (deterministic) → [THIS SKILL] → designer review report (cs-{id}.md)
                                                              ↓
                                                         wrapper script:
                                                         scripts/pipeline/claude-review.ts
```

The Skill never replaces classify-diff. It augments the report-only band with a per-change developer action.
