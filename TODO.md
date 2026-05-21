# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-21 16:55 KST (Phase B live 검증 1-2 완료: #19 라벨 재적용, artifact download 성공. 다음 blocker: GITHUB_TOKEN PR 생성 권한)

---

## 0. 현재 상태 (30초 요약)

전체 목표 `Figma 편집 → diff (텍스트/속성 + 새 프레임 + DS 미반영 감지) → Slack 알림 → 디자이너 확인 → 개발 변경 → 개발자 머지`의 5단계 진척:

| # | 단계 | 진척 | 비고 |
|:-:|---|:-:|---|
| 1 | Figma 편집 | 100% | 도구 외부 |
| 2 | 스케쥴 diff | 95% | cron 2h 동작. 감지 범위: 텍스트/속성, `new-frame`, `detached-style`, `image-change`. task-8 ✅. task-5 webhook은 optional. |
| 3 | Slack 알림 + 디자이너 확인 | 100% | PR #10 merged, baseline images seeded(PR #16), Pages built, viewer URL 포함 Issue 생성, `designer-approved` 라벨 → manifest transition 확인. |
| 4 | 개발 코드 변경 | 65% | Phase B 코드 PR #17/#18 merged. 이번 세션에서 approval workflow artifact download fix 구현. live 재검증은 commit/push 후 필요. |
| 5 | 개발자 머지 | 55% | PR 생성/업데이트 라이브러리와 manual-edit fallback 구현. Phase C visual diff/branch protection/baseline promote 미완료. |

**가중 진척 ≈ 82%.** 가장 큰 잔여 가치는 Phase B artifact handoff fix를 원격에 반영한 뒤 승인 라벨 → PR 생성까지 live 재검증하는 것, 그 다음 Phase C 안전망.

### 최신 운영 증거 (2026-05-21)

- `main` 최신: `fc3cda8` (`Record designer decision for 19`).
- merged PRs: #10 Phase A, #13 webhook failure isolation, #16 baseline image seed, #17 Phase B prep, #18 Phase B auto-edit PR flow.
- GitHub Pages: `https://jhlee9815.github.io/uno-home/` built, latest viewer `https://jhlee9815.github.io/uno-home/cs/cs-2026-05-21T07-07-04/`.
- Actions: `figma-pipeline` run `26211009015` success, Pages run `26211035500` success, `designer-approval` run `26211056345` success.
- Latest review Issue: #19 `cs-2026-05-21T07-07-04`, labels `designer-review`, `report-only`, `designer-approved`.
- Latest manifest: `.automation/cs/cs-2026-05-21T07-07-04.json` state `designer-approved`, stateHistory includes `label:designer-approved`.
- Live verification 1-2 complete: #19 `designer-approved` 라벨 재적용 → run `26212122539`; `Download originating pipeline artifacts` succeeded for `figma-pipeline-26211009015`. Next blocker: PR creation failed because GitHub Actions is not permitted to create pull requests.

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

## 2. 우선순위 1 — Phase B live 재검증 (승인 라벨 → auto-edit/manual-edit PR)

Phase B artifact handoff fix는 로컬 구현됨. 다음은 원격 반영 후 live에서 승인 라벨을 다시 걸어 PR 생성까지 확인하는 것이다.

### 구현된 fix
- `designer-approval.yml` 권한에 `actions: read` 추가.
- `Prepare approval artifact download` step이 Issue의 `cs-*`를 찾고 `.automation/cs/{csId}.json`의 `runId`를 `CS_RUN_ID`로 export.
- `actions/download-artifact@v4`가 `figma-pipeline-${CS_RUN_ID}` artifact를 checkout root에 복원.
- 기존 `designer-approval.ts`가 `.automation/diffs/`, `.automation/snapshots/`, baseline paths를 그대로 읽어 apply/PR 생성 시도.
- 회귀 테스트: `npm run figma:test:workflow-artifacts` 추가.

### 다음 해야 할 검증 작업
1. ✅ `designer-approved` 라벨 재적용 또는 신규 `cs-*` 승인으로 `designer-approval.yml`을 다시 실행한다. #19 라벨 재적용 완료 → run `26212122539`.
2. ✅ workflow 로그에서 `Download originating pipeline artifacts`가 성공하는지 확인한다. `figma-pipeline-26211009015` 다운로드 성공.
3. ⏭️ 다음: `Classified diff or snapshots missing`이 더 이상 나오지 않는지 확인한다. 이번 run은 artifact download 후 apply 단계까지 진입했다.
4. 🟠 Blocked: marker hit가 있으면 Draft PR 생성, marker hit가 없으면 `.automation/manual-edits/{csId}.md` fallback PR 생성 확인. 현재는 `GitHub Actions is not permitted to create or approve pull requests` 권한 에러로 PR create 실패.
5. ⏳ manifest state가 `designer-approved`에서 `pr-open`까지 transition되는지 확인.
6. 위 결과를 문서에 기록하고, 실패 시 해당 로그 기준으로 좁게 후속 fix를 잡는다.

### 완료 조건
- ✅ 최신 또는 신규 `cs-*`에 `designer-approved` 라벨을 붙였을 때 artifact download가 성공한다.
- 🟡 `Classified diff or snapshots missing`이 사라진다. 이번 run은 artifact download 후 apply 단계까지 진입했으나 PR 권한에서 실패.
- 🟠 marker hit가 있으면 Draft PR 생성, marker hit가 없으면 `.automation/manual-edits/{csId}.md` fallback PR 생성. 현재 fallback branch `designer-approved/cs-2026-05-21T07-07-04`는 push됐지만 PR 생성 권한에서 실패.
- ⏳ manifest state가 `designer-approved`에서 `pr-open`까지 transition된다.

---

## 3. 우선순위 2 — Phase C 안전망

Phase B live handoff가 확인된 후 진행.

### 목표
- visual diff (Playwright pixel diff) — 변경 화면 실제 렌더 vs baseline image
- branch protection rule — CODEOWNERS review + visual-diff CI 강제
- post-merge baseline auto-promote — PR에 baseline 갱신 commit 포함 또는 follow-up PR
- e2e fixture test + 롤백 시나리오 문서화

---

## 4. 끼워넣기 옵션 — Task 5 Cloudflare Worker (단계 2 즉시 트리거)

디자이너가 "Figma 편집 후 2시간 기다리는 문제"에 답답해할 때 1-2h로 추가. 지금은 Phase B handoff fix가 더 직접적인 병목이다.

- 필요: Cloudflare 계정, `wrangler` CLI, GitHub fine-grained PAT 또는 repository dispatch 권한, Figma webhook passcode/signature 검증.
- 목표: Figma 편집 → Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → `figma-pipeline.yml` 즉시 실행.
- 부수 옵션: 같은 Worker에 `/slack` 엔드포인트 추가하면 Slack slash command 트리거 가능 (Slack Workflow Builder 대체).

---

## 5. ~~Task 6 Resend 이메일~~ ⏭ SKIPPED

- Slack 알림 두 채널 (notifySlack webhook + GitHub 공식 Slack 앱)이 디자이너/PM에 도달하고 있어 이메일 채널 불필요.
- 코드 정리: `post-run-actions.ts`의 RESEND placeholder 제거 + `figma-pipeline.yml`의 RESEND env 제거 완료.
- 미래에 이메일이 필요해지면 [`task-6-email-resend.md`](./project-plan/phase-6/task-6-email-resend.md) 설계 그대로 부활 가능.

---

## 6. task-3 완료 기록 (2026-05-20 20:20 KST)

V1~V4 실검증 PASS. 세부는 [`project-plan/phase-6/task-3-post-run-actions.md`](./project-plan/phase-6/task-3-post-run-actions.md) "검증 결과" 섹션. 코덱스 review session: `019e4514-e802`.

증거: Issue [#1](https://github.com/jhlee9815/uno-home/issues/1) (closed, `[verified]` prefix), PR [#2](https://github.com/jhlee9815/uno-home/pull/2) (closed). 원격 브랜치 `designer-bot/cs-fixture-2026-05-20T11-15` 삭제 완료. 3개 commit (bfc478e, d175c35, 8697e58) push 완료.

Not-tested 갭: PR body update on existing PR — task-5 이후 자연 cs 발생 시 확인.

### task-4 (2026-05-20 20:45 KST)

`.github/CODEOWNERS` 단일 owner `jhlee9815` + Phase 7 영역 분리 TODO. PR/Issue 템플릿, `labels.yml` 추가. task-3 자동 생성 라벨 4개 색상/설명 표준화 (PATCH ×4). branch protection rule은 task-5 이후 분리.

---

## 7. task-7 완료 기록

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

## 8. 참고 문서 인덱스

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
| Phase 7 canonical 계획 | [project-plan/phase-7/phase-plan-7.md](./project-plan/phase-7/phase-plan-7.md) |
| Phase 7 quick handoff | [project-plan/phase-7/plan-7.md](./project-plan/phase-7/plan-7.md) |
| 운영 가이드 | [README.md](./README.md) |
| 디자이너 핸드오프 | [handoff.md](./handoff.md) |


## 9. Task 8 완료 기록 (2026-05-21 10:50 KST)

- PR #9 merged to `main` (`6d4cd94`).
- 구현: snapshot deep traversal compliance 수집, stable-key diff, classify report-only policy, cs report compliance sections, pending local viewer.
- 검증: full figma test loop, `npm run lint`, `npm run build`, Stage 6 real Figma probe PASS.
- rollout 보강: old-schema baseline compliance diff skip guard.
- 상세: [project-plan/phase-6/task-8-ds-compliance-detection.md](./project-plan/phase-6/task-8-ds-compliance-detection.md) §8-13.
- 후속 상태: Task 10 Phase A는 완료됐고 Phase B 코드는 merge됨. artifact handoff fix는 구현됐고 현재 다음은 commit/push 후 Phase B live 재검증.
