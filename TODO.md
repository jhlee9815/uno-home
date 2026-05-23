# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-23 14:50 KST (manifest PR auto-merge + baseline-promote dry-run + mapping cleanup live 확인 완료. 다음: dry-run flip + i18n + audit dedup.)

---

## 0. 현재 상태 (30초 요약)

전체 목표 `Figma 편집 → diff (텍스트/속성 + 새 프레임 + DS 미반영 감지) → Slack 알림 → 디자이너 확인 → 개발 변경 → 개발자 머지`의 5단계 진척:

| # | 단계 | 진척 | 비고 |
|:-:|---|:-:|---|
| 1 | Figma 편집 | 100% | 도구 외부 |
| 2 | 스케쥴 diff | 99% | daily audit + 2시간 pipeline cron + workflow_run cascade + 2-sighting auto-register live. baseline `2026-05-21T07-43-40` (다음 approval에서 자동 갱신 예정). |
| 3 | Slack 알림 + 디자이너 확인 | 100% | Korean labels + audit→pipeline cascade(#33), 라벨링 시 designer-approval workflow 정상. |
| 4 | 개발 코드 변경 | 85% | designer-bot App token으로 PR 작성(#28/#45), manifest PR auto-merge(#63), baseline-promote 자동화 dry-run(#67) 완료. live promote는 flip 후. |
| 5 | 개발자 머지 | 80% | manifest PR auto-merge live. baseline-promote PR auto-merge 코드 준비됨(dry-run). Phase C visual diff/branch protection은 별개. |

**가중 진척 ≈ 93%.** 가장 큰 잔여 가치는 baseline-promote dry-run→prod flip(접근법 확정, 안전망 검증 끝). 그 다음 audit/Issue 노이즈 정량 감소(한국어화/dedup/threshold).

### 최신 운영 증거 (2026-05-23)

- repo 리네임: `uno-home → design-review-bot` (PR #36 2026-05-22).
- merged PRs (2026-05-22~23 핵심):
  - **#63 manifest PR auto-merge** — `enablePullRequestAutoMerge(SQUASH)`로 validate 통과 시 manifest PR 자동 land. 이전 누적된 9개 manifest PR(#42/47/49/51/53/55/57/59/62) squash-merge로 정리.
  - **#67 baseline-promote 자동화 (dry-run)** — `scripts/pipeline/lib/baseline-promote.ts` 순수 결정 함수 + `promote-baseline.ts` CLI + designer-approval workflow step. `FIGMA_PROMOTE_DRY_RUN: '1'`로 안전망. lib 5 test 케이스 통과.
  - **#74 mapping cleanup** — `figma_appleInspiredDesignSystemGeneratedPreview_2_2` (page 2 DS preview, 2:2) 제거. mapping entries 9 → 8.
  - 이전: #28/#45 designer-bot App token, #33 Korean labels + audit→pipeline cascade, #36 repo rename, #37/#43 manifest persistence under branch protection.
- baseline-promote live 증거 (run `26324997509`, Issue #68 `cs-2026-05-23T05-45-46` 라벨링):
  - 로그: `[promote-baseline] DRY-RUN would create .automation/baseline/2026-05-23T05-48-23.json (848269 bytes, prev baseline: 2026-05-21T07-43-40)`
  - 의미: snapshot artifact 다운로드 정상, cs.createdAt이 newer-than-current 통과, promote 결정 도달, 실제 mutation 없음 (flag 정상 작동).
- audit live (run `26324994936`, Issue #70):
  - Detached styles: **1167** (변동 없음 — 새 frame들이 DS-clean이라는 증거)
  - Unregistered top-level frames: **4** — `test_clean_001` (78:1024), `test_clean_002` (78:1046), `test_clean_003` (78:1073), `Apple-inspired Design System / Generated Preview` (79:306).
- stale manual-edit PR: #20 (cs-2026-05-21T07-07-04), #40 (cs-2026-05-22T01-12-45), #64 (cs-2026-05-23T02-42-47). 본문 path가 옛 `uno-home/` prefix.

### 단계 2 감지 매트릭스 (task-8 구현, report-only 정책)

| 감지 종류 | class | 트리거 | 자동 patch | 디자이너 검토 필요 |
|---|---|---|---|---|
| 텍스트 변경 (marker 있음) | `text-change` | 매핑된 텍스트 노드 변경 | ✅ Tier 1 marker patch | (auto-apply) |
| 속성/스타일 변경 (매핑 외) | (다양) | 매핑 외 속성 변경 | ❌ | ✅ Issue |
| **새 프레임 추가** | `new-frame` | snapshot에 없던 frame 노드 추가 | ❌ | ✅ Issue |
| **DS 토큰 미반영 (타이포/색상)** | `detached-style` | Figma 변수/스타일 해제 (로컬 hex/font) | ❌ | ✅ Issue |
| 이미지 변경 | `image-change` | image fill의 ref hash 변경 | ❌ | ✅ Issue |

---

## 1. 첫 진입 — 5분

```bash
cd /Users/juhee/Work/Test/design-test/uno-home

git status --short --branch
git pull --ff-only
npm run figma:health
npm run figma:preflight
npm run lint
npm run build
```

문서만 수정한 세션에서는 최소 `git diff --check`를 추가로 확인한다.

---

## 2. 우선순위 1 — baseline-promote dry-run → production flip

PR #67이 baseline-promote 자동화를 dry-run으로 land했다. dry-run 로그가 2026-05-23 05:48 UTC live run에서 정상 패턴(`would create … bytes, prev baseline: …`)으로 떨어졌다. 추가 관찰 없이 flip 가능 상태.

### 작업 내용

1. `.github/workflows/designer-approval.yml`에서 `FIGMA_PROMOTE_DRY_RUN: '1'` → `'0'`로 변경 (해당 step 환경변수 한 줄).
2. PR로 land + auto-merge.
3. 다음 `designer-approved` 라벨 시 실제 baseline 파일이 `.automation/baseline/` 디렉토리에 새로 생성되고, 그 다음 figma-pipeline run에서 해당 4건이 더 이상 안 나오는지 확인.
4. 실패 시 롤백: 잘못 promote된 baseline 파일을 `git rm` → 자동으로 직전 baseline로 복귀 (sort().at(-1) 로직).

### 우선순위 2 — Issue/Slack 노이즈 추가 감소

baseline-promote가 켜져도 audit Issue(detached 1167 + unregistered frames) 노이즈는 별도 메커니즘. 다음 세션에서 줄일 수 있는 항목:

- **report-only / structure 한국어화** — `scripts/pipeline/lib/classify-diff.ts:110,115`와 `scripts/pipeline/lib/report-only-guidance.ts:91,101`의 영어 reason 문자열을 한국어로 (단순 치환). 추가로 manual action도 한국어. Issue 본문이 디자이너가 읽기 좋아짐.
- **audit Issue dedup** — 직전 audit Issue와 detached/unregistered 카운트가 동일하면 새 Issue 생성하지 말고 댓글로만 갱신 또는 skip. Issue #60/#70 같은 중복 발생 패턴 차단.
- **stale manual-edit PR #20/#40/#64 정리** — close + 본문 path를 새 repo 이름(`design-review-bot/`)으로 normalize하는 코드 수정 (`scripts/pipeline/lib/manual-edits.ts` 추정).
- **baseline 디렉토리 자동 prune** — 최근 N개만 유지하는 cleanup 스크립트 (현재 6개+ 누적 중).

### 우선순위 3 — test_clean_* mapping 자동 등록 확인

2026-05-23 05:50 UTC에 figma-audit를 다시 trigger했음 (run `26325098092`). 2-sighting policy로 `test_clean_001/002/003`에 대한 auto-register PR이 자동 생성되어야 함. PR 머지 → preflight에 entries 8→11로 늘어남 → 다음 pipeline run에서 새 frame이 pipeline diff에서도 잡히는지 확인.

### 다음 해야 할 작업

1. `gh pr view 25 --repo jhlee9815/uno-home --json number,title,state,mergeStateStatus,reviewDecision,statusCheckRollup,body,url`로 현재 gate 확인.
2. `gh run list --repo jhlee9815/uno-home --workflow pr-checks.yml --branch auto-register/audit-2026-05-21 --limit 5`로 dispatch validation 증거 확인.
3. body name bug는 `.github/workflows/figma-audit.yml`의 base64 decode loop가 trailing newline 없는 마지막 줄을 놓치는지 확인한다. 후보 fix는 handoff 문서에 있음.
4. dispatch run이 branch protection required check로 인정되지 않으면 PR check strategy를 고치거나 수동 검증/merge 정책을 문서화한다.
5. #25를 merge하거나, code fix가 필요하면 작은 follow-up PR을 만든 뒤 audit PR을 재생성/수정한다.

### 완료 조건

- ✅ PR #25 body가 등록 frame을 둘 다 정확히 표시하거나, body 표시 버그가 비차단으로 명시된다.
- ✅ PR #25 validation 상태가 merge gate에 붙거나, dispatch validation run `26232141435`로 대체 검증하는 운영 규칙이 명시된다.
- ✅ PR #25가 merge되어 `config/figma-mapping.yaml`에 두 auto-registered frame이 main에 들어간다.

---

## 3. 우선순위 2 — GitHub Actions PR 생성 권한 해제 → Phase B 재검증

Phase B artifact handoff fix는 원격에 반영됐고 live에서 artifact download 성공까지 확인됐다. PR #25 이후에는 repo Actions workflow 권한 또는 workflow-level permissions를 정리한 뒤 #19 라벨을 다시 걸어 PR 생성과 manifest `pr-open` 전이를 확인한다.

### 구현된 fix
- `designer-approval.yml` 권한에 `actions: read` 추가.
- `Prepare approval artifact download` step이 Issue의 `cs-*`를 찾고 `.automation/cs/{csId}.json`의 `runId`를 `CS_RUN_ID`로 export.
- `actions/download-artifact@v4`가 `figma-pipeline-${CS_RUN_ID}` artifact를 checkout root에 복원.
- 기존 `designer-approval.ts`가 `.automation/diffs/`, `.automation/snapshots/`, baseline paths를 그대로 읽어 apply/PR 생성 시도.
- 회귀 테스트: `npm run figma:test:workflow-artifacts` 추가.

### 다음 해야 할 작업
1. 🔴 GitHub repo Settings → Actions → General → Workflow permissions 변경:
   - `Read and write permissions` 선택
   - `Allow GitHub Actions to create and approve pull requests` 체크
   - CLI/API 대안:
     ```bash
     gh api -X PUT repos/jhlee9815/uno-home/actions/permissions/workflow \
       -f default_workflow_permissions=write \
       -F can_approve_pull_request_reviews=true
     ```
2. 🔁 #19 `designer-approved` 라벨을 제거/재부착하거나 신규 `cs-*`를 승인해서 `designer-approval.yml` 재실행.
3. ✅ workflow 로그에서 다음을 확인:
   - `Download originating pipeline artifacts` 성공 유지
   - `Classified diff or snapshots missing` 미발생
   - auto-edit 또는 manual-edit fallback PR 생성 성공
4. ✅ `.automation/cs/{csId}.json` manifest state가 `designer-approved` → `pr-open`으로 전이되는지 확인.
5. 결과를 `TODO.md`, `phase-plan-6.md`, `task-10-designer-workflow-design.md`에 기록한다.

### 완료 조건
- ✅ repo Actions workflow 권한이 `write` + PR 생성 허용으로 바뀐다.
- ✅ 최신 또는 신규 `cs-*`에 `designer-approved` 라벨을 붙였을 때 artifact download가 성공한다.
- ✅ `Classified diff or snapshots missing` 없이 apply 단계가 진행된다.
- ✅ marker hit가 있으면 Draft PR 생성, marker hit가 없으면 `.automation/manual-edits/{csId}.md` fallback PR 생성.
- ✅ manifest state가 `designer-approved`에서 `pr-open`까지 transition된다.

---

## 4. 우선순위 3 — Phase C 안전망

Phase B PR 생성 + manifest `pr-open` 전이가 확인된 후 진행.

### 목표
- visual diff (Playwright pixel diff) — 변경 화면 실제 렌더 vs baseline image
- branch protection rule — CODEOWNERS review + visual-diff CI 강제
- post-merge baseline auto-promote — PR에 baseline 갱신 commit 포함 또는 follow-up PR
- e2e fixture test + 롤백 시나리오 문서화

---

## 5. 끼워넣기 옵션 — Task 5 Cloudflare Worker (단계 2 즉시 트리거)

디자이너가 "Figma 편집 후 2시간 기다리는 문제"에 답답해할 때 1-2h로 추가. 지금은 Phase B handoff fix가 더 직접적인 병목이다.

- 필요: Cloudflare 계정, `wrangler` CLI, GitHub fine-grained PAT 또는 repository dispatch 권한, Figma webhook passcode/signature 검증.
- 목표: Figma 편집 → Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → `figma-pipeline.yml` 즉시 실행.
- 부수 옵션: 같은 Worker에 `/slack` 엔드포인트 추가하면 Slack slash command 트리거 가능 (Slack Workflow Builder 대체).

---

## 6. ~~Task 6 Resend 이메일~~ ⏭ SKIPPED

- Slack 알림 두 채널 (notifySlack webhook + GitHub 공식 Slack 앱)이 디자이너/PM에 도달하고 있어 이메일 채널 불필요.
- 코드 정리: `post-run-actions.ts`의 RESEND placeholder 제거 + `figma-pipeline.yml`의 RESEND env 제거 완료.
- 미래에 이메일이 필요해지면 [`task-6-email-resend.md`](./project-plan/phase-6/task-6-email-resend.md) 설계 그대로 부활 가능.

---

## 7. task-3 완료 기록 (2026-05-20 20:20 KST)

V1~V4 실검증 PASS. 세부는 [`project-plan/phase-6/task-3-post-run-actions.md`](./project-plan/phase-6/task-3-post-run-actions.md) "검증 결과" 섹션. 코덱스 review session: `019e4514-e802`.

증거: Issue [#1](https://github.com/jhlee9815/uno-home/issues/1) (closed, `[verified]` prefix), PR [#2](https://github.com/jhlee9815/uno-home/pull/2) (closed). 원격 브랜치 `designer-bot/cs-fixture-2026-05-20T11-15` 삭제 완료. 3개 commit (bfc478e, d175c35, 8697e58) push 완료.

Not-tested 갭: PR body update on existing PR — task-5 이후 자연 cs 발생 시 확인.

### task-4 (2026-05-20 20:45 KST)

`.github/CODEOWNERS` 단일 owner `jhlee9815` + Phase 7 영역 분리 TODO. PR/Issue 템플릿, `labels.yml` 추가. task-3 자동 생성 라벨 4개 색상/설명 표준화 (PATCH ×4). branch protection rule은 task-5 이후 분리.

---

## 8. task-7 완료 기록

완료 파일:

- `scripts/pipeline/promote-dev.ts`
- `scripts/pipeline/verify.ts`
- `scripts/pipeline/lib/config-loader.ts`
- `.github/workflows/figma-pipeline.yml`
- 문서: `project-plan/phase-6/task-7-bugfixes.md`, `project-plan/phase-7/phase-plan-7.md`, `project-plan/phase-7/plan-7.md`

검증:

```bash
npm run build
npm run lint
npm run figma:preflight
FIGMA_FILE_KEY=9cevQvPHlQ5vZv5Pz3QaLL FIGMA_CONFIG_DIR=/Users/juhee/Work/Test/design-test/uno-home/config npm run figma:preflight
npx tsc --noEmit
```

---

## 9. 참고 문서 인덱스

| 종류 | 경로 |
|---|---|
| 전체 계획 | [plan.md](./plan.md) |
| Phase 6 계획 | [project-plan/phase-6/phase-plan-6.md](./project-plan/phase-6/phase-plan-6.md) |
| task-3 완료 기록 | [project-plan/phase-6/task-3-post-run-actions.md](./project-plan/phase-6/task-3-post-run-actions.md) |
| task-4 완료 기록 | [project-plan/phase-6/task-4-codeowners-governance.md](./project-plan/phase-6/task-4-codeowners-governance.md) |
| Slack 통합 가이드 | [project-plan/phase-6/slack-integration.md](./project-plan/phase-6/slack-integration.md) |
| task-7 완료 기록 | [project-plan/phase-6/task-7-bugfixes.md](./project-plan/phase-6/task-7-bugfixes.md) |
| task-8 완료 기록 | [project-plan/phase-6/task-8-ds-compliance-detection.md](./project-plan/phase-6/task-8-ds-compliance-detection.md) |
| task-10 다음 설계 | [project-plan/phase-6/task-10-designer-workflow-design.md](./project-plan/phase-6/task-10-designer-workflow-design.md) |
| audit auto-register handoff | [project-plan/phase-6/audit-auto-register-handoff-2026-05-21.md](./project-plan/phase-6/audit-auto-register-handoff-2026-05-21.md) |
| Phase 7 canonical 계획 | [project-plan/phase-7/phase-plan-7.md](./project-plan/phase-7/phase-plan-7.md) |
| Phase 7 quick handoff | [project-plan/phase-7/plan-7.md](./project-plan/phase-7/plan-7.md) |
| 운영 가이드 | [README.md](./README.md) |
| 디자이너 핸드오프 | [handoff.md](./handoff.md) |


## 10. Task 8 완료 기록 (2026-05-21 10:50 KST)

- PR #9 merged to `main` (`6d4cd94`).
- 구현: snapshot deep traversal compliance 수집, stable-key diff, classify report-only policy, cs report compliance sections, pending local viewer.
- 검증: full figma test loop, `npm run lint`, `npm run build`, Stage 6 real Figma probe PASS.
- rollout 보강: old-schema baseline compliance diff skip guard.
- 상세: [project-plan/phase-6/task-8-ds-compliance-detection.md](./project-plan/phase-6/task-8-ds-compliance-detection.md) §8-13.
- 후속 상태: Task 10 Phase A는 완료됐고 Phase B 코드는 merge됨. schema-compatible baseline은 `614dfc8`로 push 완료. audit auto-register PR #23은 `bcb7e98`로 main에 merge됨. 현재 다음은 PR #25 body/check follow-up 후 merge.
