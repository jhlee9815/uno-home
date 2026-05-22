# Audit auto-register handoff — 2026-05-21 23:28 KST

## 한 줄 상태

Claude 세션은 `figma-audit` 2-sighting auto-register 기능을 구현해 PR #23으로 `main`에 merge했고, live 검증 중 auto-register PR #25를 만들었으나 세션 한도 때문에 PR #25 후속 수정/merge 전에 멈췄다.

## 현재 repo 상태

- Repo: `jhlee9815/uno-home`
- Local path: `/Users/juhee/Work/Test/design-test/uno-home`
- Current branch: `main`
- Latest main: `bcb7e98 feat(audit): two-sighting auto-register + daily cron (#23)`
- Local working tree at handoff: markdown docs only modified. No code changes pending.
- Open follow-up PR: #25 `[auto-register] 2 frame(s) — 2026-05-21`
  - URL: https://github.com/jhlee9815/uno-home/pull/25
  - Head: `auto-register/audit-2026-05-21`
  - Base: `main`
  - Diff: only `config/figma-mapping.yaml`
  - Adds:
    - `auto_test1_35_244` → `35:244` / `test1`
    - `auto_test2_35_382` → `35:382` / `test2`

## Claude가 완료한 것

1. `figma:audit`에 audit state persistence 추가
   - `.automation/audit-state.json` 캐시로 미등록 top-level frame sighting count 추적.
   - `.automation/audit-candidates.json` 생성.
   - 기본 threshold는 2회 sighting, `FIGMA_AUDIT_REGISTER_THRESHOLD`로 override 가능.
2. `scripts/pipeline/lib/audit-state.ts` + 테스트 추가
   - 새 frame sighting count 증가.
   - 사라진 frame은 state에서 제거.
   - threshold 이상 후보만 auto-register 대상으로 선정.
3. `scripts/pipeline/auto-register.ts` + 테스트 추가
   - 후보를 `config/figma-mapping.yaml`에 `report-only` screen으로 append.
   - `FIGMA_CONFIG_DIR`를 존중해 템플릿/다른 config dir에서도 올바른 mapping에 append.
   - Figma frame name은 JSON-quoted YAML scalar로 출력.
   - names output은 base64로 내보내도록 수정.
4. `.github/workflows/figma-audit.yml` 확장
   - weekly에서 daily cron으로 변경.
   - audit state cache restore.
   - auto-register 후보가 있으면 mapping 수정 branch 생성.
   - open `auto-register` PR이 있으면 새 PR을 만들지 않고 comment만 추가.
   - `GITHUB_TOKEN`은 checkout credential로 지속하지 않고 push/PR 구간에만 remote URL로 주입.
   - PR 생성 후 `pr-checks.yml`을 `workflow_dispatch`로 실행.
5. Review/CI
   - Codex review round 7까지 반영.
   - PR #23 merged to `main`.
   - `pr-checks` on PR #23 passed repeatedly.

## Live 검증 증거

- `figma-audit` run 1: `26232066749` success
  - state cache seeding run.
  - candidates expected 0.
- `figma-audit` run 2: `26232107808` success
  - threshold hit.
  - auto-register step opened PR #25.
- PR #25 validation dispatch:
  - `pr-checks` run `26232141435` success on branch `auto-register/audit-2026-05-21`.
- PR #25 diff confirms both generated entries exist and have correct names in YAML.

## 왜 멈췄나

Claude Code pane hit the session cap:

```text
You've hit your session limit · resets 2am (Asia/Seoul)
```

Stopped while investigating PR #25 follow-up issues. Todo screen showed 10 tasks, 9 done, 1 in progress: live verify.

## 멈춘 지점 / 발견된 이슈

1. PR #25 body에서 두 번째 frame name이 비어 있음
   - Body shows:
     - `35:244` — test1
     - `35:382` —
   - But PR diff correctly contains `figmaNodeName: "test2"`.
   - Likely cause: workflow decodes base64 names into a `while read` loop. If decoded content does not end with a trailing newline, Bash `read` can drop the last line unless the loop handles `|| [ -n "$line" ]`.
   - Candidate fix in `.github/workflows/figma-audit.yml`:
     ```bash
     while IFS= read -r line || [ -n "$line" ]; do
       NAMES+=("$line")
     done < <(printf '%s' "${REGISTERED_NAMES_B64}" | base64 -d 2>/dev/null || true)
     ```
2. PR #25 `statusCheckRollup` is empty even though `pr-checks` workflow_dispatch succeeded
   - `gh pr view 25` showed `mergeStateStatus: BLOCKED`, `reviewDecision: APPROVED`, `statusCheckRollup: []`.
   - `gh run list --workflow pr-checks.yml --branch auto-register/audit-2026-05-21` showed run `26232141435` success.
   - Next session should check whether workflow_dispatch runs are attached to PR required checks for this branch protection setup. If not, change strategy so the required check appears on the PR head SHA, or document that manual merge requires checking the dispatch run.
3. Need decide/perform PR #25 close path
   - If status/check association is acceptable or fixed, merge PR #25.
   - If body/status issue needs code changes, open a small follow-up PR against `main` for workflow fix, then rerun `figma-audit` or recreate/comment on auto-register PR.

## Resume commands

```bash
cd /Users/juhee/Work/Test/design-test/uno-home

git status --short --branch
git pull --ff-only

gh pr view 25 --repo jhlee9815/uno-home --json number,title,state,mergeStateStatus,reviewDecision,statusCheckRollup,body,url

gh run list --repo jhlee9815/uno-home --workflow pr-checks.yml --branch auto-register/audit-2026-05-21 --limit 5   --json databaseId,status,conclusion,createdAt,updatedAt,url

gh pr diff 25 --repo jhlee9815/uno-home
```

## Recommended next steps

1. Fix/document the PR body name decoding bug.
2. Investigate why PR #25 has empty `statusCheckRollup` despite dispatch success.
3. If needed, patch `.github/workflows/figma-audit.yml` on a new branch and run:
   ```bash
   npm run figma:test:audit-state
   npm run figma:test:auto-register-format
   npm run lint
   npm run build
   git diff --check
   ```
4. Re-dispatch `figma-audit` twice only if PR #25 must be regenerated.
5. Merge PR #25 once body/check status are acceptable.
6. After #25, return to Task 10 Phase B designer approval PR creation/manifest `pr-open` verification if that remains a product priority.

## Related docs updated in this handoff

- `README.md`
- `TODO.md`
- `handoff.md`
- `plan.md`
- `project-plan/phase-6/phase-plan-6.md`
- `project-plan/phase-6/task-8-ds-compliance-detection.md`
- `project-plan/phase-6/task-8-execution-goal.md`
- `project-plan/phase-6/task-10-designer-workflow-design.md`
