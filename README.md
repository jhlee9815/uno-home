# Figma Automation

This project is a local React/Vite prototype connected to a Figma change-detection pipeline. The pipeline watches mapped Figma nodes, snapshots them, compares them with the approved baseline, applies safe code changes, verifies the app, and creates a designer review report when there is something to review.

## Current Registration

| Item | Value |
|---|---|
| Figma file | `SXPVingkmqkrcLzcXYFsZd` |
| Mapping file | `config/figma-mapping.yaml` |
| Total mapped entries | `186` |
| Components | `6` |
| Compositions | `7` |
| Screens / frames | `173` |
| Approved snapshot baseline | `.automation/baseline/2026-05-06T06-00-44.json` |
| Tracking-only code target | `src/screens/FigmaFrameTracking.ts` |

All top-level Figma frames in the file are registered. Frames that do not yet have a React route are mapped as `report-only` screens and point to `FigmaFrameTracking.ts`; this keeps preflight valid while still detecting future Figma-only changes.

## How The Current Registration Was Done

1. Fetched the Figma file tree from the REST API with `depth=2`.
2. Collected every top-level `FRAME` from all pages.
3. Skipped frame node IDs that were already mapped to implemented screens.
4. Added the remaining frames under `screens:` in `config/figma-mapping.yaml`.
5. Set unimplemented frames to `automation.apply: report-only`.
6. Used `src/screens/FigmaFrameTracking.ts` as the tracking-only code path for those frames.
7. Ran preflight, snapshot, diff, classify, apply, verify, report, approve, and promote.
8. Promoted the registration change-set so future diffs compare against the new 186-node baseline.

The registration change-set was `cs-2026-05-06T06-00-51`. It contained `165` report-only registration changes, no code changes, and was promoted to baseline `.automation/baseline/2026-05-06T06-00-44.json`.

## Daily Workflow

Use this path when the recipient is working with the same Figma file, `SXPVingkmqkrcLzcXYFsZd`.

1. Designer edits the Figma file.
2. Run `npm run figma:run`, or wait for the 21:00 launchd schedule.
3. The pipeline runs `preflight -> snapshot -> diff -> classify -> apply -> verify -> report -> promote`.
4. If changes are detected, inspect `.automation/reports/cs-{id}.md`.
5. If report-only details exist, inspect `.automation/reports/diff-report-only-{timestamp}.md`.
6. Approve or reject the change-set.
7. Approved change-sets are promoted to `dist-dev/` and update `.automation/baseline/`.

If there are no changes, the pipeline still writes apply/verify operational logs, but skips the designer review `cs-{id}.md`.

## Commands

```bash
npm run figma:preflight
npm run figma:snapshot
npm run figma:diff
npm run figma:classify
npm run figma:apply
npm run figma:verify
npm run figma:report
npm run figma:approve cs-{id}
npm run figma:reject cs-{id} "reason"
npm run figma:promote cs-{id}
npm run figma:register-file -- "<app-figma-url-or-file-key>" --project-name "Project Name" --package-name "package-name"
npm run figma:register-file -- "<app-figma-url-or-file-key>" --project-name "Project Name" --package-name "package-name" --design-system-url "<design-system-figma-url-or-file-key>"
npm run figma:run
npm run figma:claude-review                       # 3-band 체크리스트 (UNO 트랙)
npm run figma:claude-review -- --source apple     # Apple-inspired 트랙
```

Use `npm run figma:run` for the normal end-to-end cycle. Use the individual commands only when debugging a specific stage.

## Design System Skill (Phase 3·보완 트랙)

The pipeline's deterministic classify stage is augmented by a Skill layer that produces a developer-facing checklist with three bands (Auto-applied / Claude review / Human review).

| Skill | Location | Track |
|---|---|---|
| UNO Design System | `.claude/skills/uno-design-system/SKILL.md` | UNO Figma pipeline (main) |
| Apple-inspired DS | `.claude/skills/apple-design-system/SKILL.md` | External Markdown DS (experiment) |
| Wrapper | `scripts/pipeline/claude-review.ts` | both, `--source` flag |
| Sample report | `project-plan/supplementary-2026-05-20/sample-cs-report.md` | presentation-ready model |

Run `npm run figma:claude-review` to generate the Skill output. Implementation is deterministic (no API call). An `--use-claude` flag for LLM-augmented natural-language summaries is planned.

## Where To Check Results

| Path | Purpose |
|---|---|
| `.automation/snapshots/` | Raw Figma node snapshots for mapped entries |
| `.automation/diffs/` | Baseline-vs-head diff JSON and classified diff JSON |
| `.automation/reports/cs-{id}.md` | Designer review report for a change-set |
| `.automation/reports/diff-report-only-{timestamp}.md` | Manual follow-up list for report-only changes |
| `.automation/reports/apply-cs-{id}.md` | Code application result |
| `.automation/reports/verify-cs-{id}.md` | Build/lint/visual verification result |
| `.automation/reports/promote-cs-{id}.md` | Promotion result |
| `.automation/baseline/` | Approved snapshot and screenshot baselines |

## How To Repeat This On A New Figma Change

For normal design edits, do not re-register frames. Just run:

```bash
npm run figma:run
```

Then read the generated report. For a mapped frame like `0:8063` (`mo - No Home Hub`), future text/layout/structure changes will appear in the diff because the frame is now part of the approved baseline.

## How A New Recipient Starts

1. Put the transferred `design-test` folder anywhere on the machine.
2. Install dependencies.
3. Create `uno-home/.env` with their own Figma token.
4. Run preflight.
5. Decide whether they are using the same Figma file or their own app/design-system Figma files.

```bash
cd /path/to/design-test/uno-home
npm install
printf 'FIGMA_TOKEN=YOUR_FIGMA_TOKEN\n' > .env
npm run figma:preflight
```

If they use the same Figma file, they can immediately run:

```bash
npm run figma:run
```

Keep `.automation/baseline/` when handing off the project. Without it, the first run cannot compare against the approved 186-node baseline.

## How To Use A Different Project And Figma File

Different Figma files are supported, but the existing node IDs cannot be reused. Figma node IDs are file-local, so a new file needs a new mapping and a new baseline. The project display name and npm package name can be changed during registration.

If the project has only an app/screen Figma file:

```bash
cd /path/to/design-test/uno-home
npm run figma:register-file -- "https://www.figma.com/design/APP_FILE_KEY/FileName?m=dev" --project-name "Project Name" --package-name "package-name"
npm run figma:preflight
npm run figma:run
```

If the project has a separate design-system Figma file:

```bash
cd /path/to/design-test/uno-home
npm run figma:register-file -- "https://www.figma.com/design/APP_FILE_KEY/FileName?m=dev" --project-name "Project Name" --package-name "package-name" --design-system-url "https://www.figma.com/design/DESIGN_SYSTEM_FILE_KEY/FileName?m=dev"
npm run figma:preflight
npm run figma:run
```

`figma:register-file` does this:

- Backs up `config/figma.yaml`, `config/figma-mapping.yaml`, and `package.json` to `.automation/backups/`.
- Updates `config/figma.yaml` to the new app file key.
- Stores `--project-name` in `config/figma-mapping.yaml`.
- Stores `--package-name` in `package.json`.
- Replaces `config/figma-mapping.yaml` with a tracking-only mapping for the new files.
- Registers every app-file top-level `FRAME` as a `report-only` screen.
- If `--design-system-url` is provided, registers top-level `FRAME`, `COMPONENT`, and `COMPONENT_SET` nodes from that file as `report-only` components.
- Clears old components/compositions automation because those node IDs must be remapped per file.

The first run after switching files will report many changes because the frames are new to the baseline. Approve/promote that registration change-set to establish the new baseline:

```bash
npm run figma:approve cs-{id}
npm run figma:promote cs-{id}
npm run figma:run
```

The final run should show `Changes: 0`. After that, future edits in the new Figma file are detected normally.

Important limits:

- New files start in report-only tracking mode.
- Automatic token/text/prop code changes require manually reviewing/remapping `components:` and `compositions:` for that specific app/design-system file.
- Visual diff only works for mapped screens with a real `route`.
- The folder can be renamed from `uno-home`, but any launchd plist paths in `config/com.uno-home.figma-pipeline.plist` must be updated if scheduler automation is used.

## How To Register New Frames Later

Only do this when the Figma file gains new top-level frames.

1. Fetch the file tree with Figma REST API `GET /v1/files/{fileKey}?depth=2`.
2. Find top-level nodes with `type: "FRAME"`.
3. Check whether each frame `id` already exists as a `figmaNodeId` in `config/figma-mapping.yaml`.
4. Add only missing frames under `screens:`.
5. For unimplemented screens, use:

```yaml
code: ../src/screens/FigmaFrameTracking.ts
targetType: screen
automation:
  apply: report-only
  allowedClasses:
    - token
    - text
    - layout
    - structure
```

6. Do not add a `route` unless the frame has a real React route and should participate in visual diff.
7. Run `npm run figma:preflight`.
8. Run `npm run figma:run`.
9. Approve and promote the registration change-set to establish a clean baseline.
10. Run `npm run figma:run` again and confirm `Changes: 0`.

The first run after registration is expected to show many `report-only` changes because the new frames were missing from the old baseline. That run is a baseline reset, not a product UI change.

## What The Pipeline Can And Cannot Prove

The pipeline can prove that a mapped Figma node changed after the last approved baseline. It can also prove whether safe token/text/prop changes were applied to code and whether build/lint/visual checks passed.

It cannot infer historical edits that happened before a node was registered. If a frame was not in the old baseline, the first detection only says “this node is newly tracked.” After promotion, future edits to that same frame are detectable.

Visual diff only runs for mapped screens with a `route`. Tracking-only Figma frames without routes are reported in markdown, not screenshot-compared against the app UI.
