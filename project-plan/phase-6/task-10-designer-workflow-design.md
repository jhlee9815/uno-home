# Task 6-10 — Designer Review → Auto-Edit → Dev Merge Workflow (DESIGN)

> **목표**: 디자이너 Slack 알림 → 클릭 → before/after HTML 확인 → 승인 → 코드 자동 수정 시도 → 개발자 확인 → 머지. cron 2시간 사이클이 자동으로 끝까지 흘러가되 결정 게이트 2개(디자이너 승인, 개발자 머지)는 사람.
>
> **diff 감지 범위 (task-8 ✅)**: 단순 텍스트/속성 변경뿐 아니라 (a) 새 프레임 추가 (`new-frame`), (b) DS 토큰 미반영 — 타이포/색상 토큰 해제 (`detached-style`), (c) 이미지 변경 (`image-change`)도 자손 트리 깊이까지 감지. 모두 `report-only` 정책으로 자동 patch 없이 디자이너 검토 큐로 들어감.
> **상태**: 🟠 Phase A live 완료, Phase B 코드 merge 완료(PR #17/#18), artifact handoff fix live 검증 완료(artifact download 성공). 별도 audit auto-register track은 PR #23으로 merge됐고 PR #25 후속 확인 중이다. Phase B의 PR 생성/manifest `pr-open` 검증은 PR #25 이후 재개한다(2026-05-21).
> **Codex 검증 반영 (2026-05-21)**:
> - **A. Stage 3a 신설**: immutable cs manifest 도입 (`.automation/cs/{id}.json` git-tracked) — 라벨은 event, manifest가 state.
> - **B. Stage 4 Tier 2 (text-matching) 드롭**: marker 없는 text 변경은 PR description에 "marker 필요" 명시, 자동 patch 안 함.
> - **C. Stage 6 알림 분산**: 별도 stage 제거, 각 transition stage(2/3/4/5)에 inline 알림 훅.
> - 추가: Stage 1 bootstrap — 매핑된 모든 review target에 대해 baseline 이미지를 한 번에 시드 (첫 사이클 "before 없음" 문제 회피).
> - 추가: Stage 5 baseline promote를 main 직접 push 대신 PR에 포함 또는 follow-up PR로 (branch protection 충돌 회피).
> **선행**: task-3/4 ✅ (이미 GitHub Issue/PR 자동 생성 + 라벨), task-8 ✅ merged (detection core), `npm run figma:viewer` 즉시 viewer ✅
> **블록 해제**: 디자이너가 Figma 편집 → 코드 머지까지 ops 노이즈 없이 흐름

## 10-1. 현재 워크플로 vs 목표

**현재 (실제 측정):**
```
Figma 편집 → cron 2h → snapshot → diff → classify
  ├─ auto-apply 가능 변경 → 자동 PR (task-3 ✅)
  └─ report-only / class 차단 → GitHub Issue + Slack 알림 (작동 중)
                                ↓
                          ★ 디자이너가 손으로 ★
                          1. Slack → Issue 본문 읽음
                          2. Figma 새 탭 열어서 변경 확인
                          3. IDE 열어서 .tsx 손으로 수정
                          4. `npm run figma:approve` 수동 실행
                          5. commit + push 수동
```

**목표 (이 task 완료 후):**
```
Figma 편집 → cron 2h → snapshot → diff → classify → render images
  ├─ auto-apply → 자동 PR (변화 없음, task-3 그대로)
  └─ report-only → GitHub Issue + Slack 알림 + viewer URL
                                ↓
                          디자이너 (1클릭 + 1라벨):
                          1. Slack 알림 → viewer URL 클릭
                          2. 브라우저에서 before/after side-by-side 확인
                          3. GitHub Issue에 `designer-approved` 또는 `designer-rejected` 라벨 추가
                                ↓
                          자동 (workflow_dispatch):
                          4. 코드 자동 수정 시도 → 새 PR
                                ↓
                          개발자 (1머지):
                          5. PR 확인 + CI 통과 확인 → Merge
                                ↓
                          자동: baseline 승급, Slack에 "shipped" 알림
```

## 10-2. Stage 분해 (Codex 검증 반영)

| Stage | 산출물 | 예상 시간 | 외부 의존성 |
|:-:|---|---|---|
| 1 | Baseline 이미지 bootstrap + snapshot 이미지 fetch 인프라 | 3-4h | Figma `/v1/images` API |
| 2 | cs-{id} viewer HTML 생성 + GitHub Pages 호스팅 + Slack hook (새 cs 알림) | 2-3h | gh-pages 브랜치 권한 |
| 3 | 디자이너 승인 라벨 트리거 workflow + Slack hook (approved/rejected) | 1.5h | GitHub Actions label event |
| **3a** | **Immutable cs manifest** (`.automation/cs/{id}.json` git-tracked: classified diff, snapshot refs, image refs, run ID, artifact hashes, issue ID, state machine) | 2-3h | 없음 |
| 4 | 코드 자동 수정 (Tier 1 marker only + AST-driven component-props selector) + Slack hook (PR open) | 3-4h | ts-morph 또는 동등 |
| 5 | dev gate (CI required + visual diff) + baseline promote는 PR 포함 또는 follow-up PR + Slack hook (shipped) | 2-3h | branch protection |
| 7 | contract tests (artifact persistence, label idempotency, patch tier별) + e2e + 롤백 시나리오 | 2-3h | 없음 |

**총**: 15.5-22.5시간 (구 13-18에서 +2-4h, Stage 3a/Stage 1 bootstrap/contract test 추가분).

**Stage 6 (전용 알림) 제거** — Codex 권고대로 Stage 2/3/4/5 각각에 inline hook.

### Phase 분할 (incremental ship)

| Phase | 포함 Stage | 시간 | 상태 (2026-05-21) | 디자이너 가치 |
|---|---|---|---|---|
| **A** | 1 + 2 + 3 + 3a | 8.5-11.5h | ✅ Live 완료. PR #10 merged, baseline seed PR #16 merged, Pages/viewer/Issue/label→manifest transition 확인. | `figma:images:bootstrap`, `figma:viewer:generate`, `.automation/cs/{id}.json`, `designer-approval.yml` |
| **B** | 4 | 3-4h | 🟠 코드 merge 완료(PR #17/#18), artifact handoff fix live 검증 완료. PR 생성 권한 fix 후 재검증 대기. | Tier 1/2 marker hit PR 또는 manual-edit fallback PR |
| **C** | 5 + 7 | 4-6h | ⚪ 미시작. Phase B 동작 확인 후 진입. | dev gate + 회귀 안전망 |

Phase A는 ship 완료. Phase B는 코드가 main에 있고 artifact handoff fix도 live에서 artifact download까지 확인됐다. 실제 auto-edit/manual-edit PR 생성은 repo Actions 권한을 `write` + PR 생성 허용으로 바꾼 뒤 재검증해야 한다.

### Phase A live 검증 완료 (2026-05-21)
1. `npm run figma:images:bootstrap` 결과 baseline PNG seed가 PR #16으로 main에 들어감.
2. `figma-pipeline` run `26211009015` success, Pages run `26211035500` success, viewer `https://jhlee9815.github.io/uno-home/cs/cs-2026-05-21T07-07-04/` 생성.
3. Issue #19에 `designer-approved` 라벨 부착 → `designer-approval.yml` run `26211056345` success → `.automation/cs/cs-2026-05-21T07-07-04.json` state `designer-approved` 기록.

### Phase B artifact handoff fix (artifact download 검증 완료, PR 권한 blocker)
- Root cause: `designer-approval.ts`는 approval workflow에서 `.automation/diffs/{timestamp}-classified.json`과 manifest의 `baseSnapshotPath` / `headSnapshotPath`를 읽는데, #19 당시 issue-label workflow checkout에는 cron runner artifacts가 없었다.
- Fix: `designer-approval.yml`에 `actions: read` 권한을 추가하고, Issue의 `cs-*` → `.automation/cs/{csId}.json` → `runId`를 추출해 `actions/download-artifact@v4`로 `figma-pipeline-${runId}`를 checkout root에 복원한다.
- `figma-pipeline.yml`은 이미 `.automation/reports/`, `.automation/snapshots/`, `.automation/diffs/`, `.automation/cs/`, `.automation/images/snapshots/`, `dist-viewer/`를 `figma-pipeline-${github.run_id}` artifact로 업로드한다.
- 회귀 테스트: `npm run figma:test:workflow-artifacts`.
- 남은 live 검증:
  1. ✅ `designer-approved` 라벨 재적용 또는 신규 `cs-*` 승인으로 `designer-approval.yml` 재실행 — #19, run `26212122539`.
  2. ✅ `Download originating pipeline artifacts` step 성공 확인 — `figma-pipeline-26211009015` 다운로드 성공.
  3. 🟡 `Classified diff or snapshots missing` 제거 확인 — artifact download 후 apply 단계 진입, missing artifact 에러 대신 PR 권한 에러 발생.
  4. 🔴 repo Actions 권한 수정 필요 — 현재 `default_workflow_permissions=read`, `can_approve_pull_request_reviews=false`; Settings → Actions → General에서 `Read and write permissions` + `Allow GitHub Actions to create and approve pull requests` 적용.
  5. 🟠 auto-edit 또는 manual-edit fallback PR 생성 확인 — 권한 수정 후 #19 라벨 재적용. 직전 run에서는 branch는 push됐지만 PR create가 `GitHub Actions is not permitted to create or approve pull requests`로 실패.
  6. ⏳ manifest `pr-open` transition 확인 — PR 생성 권한 fix 후 재검증.

---



## 10-2a. Phase A 구현 기록 (2026-05-21)

1차 구현 범위:

- **Baseline image bootstrap**: `npm run figma:images:bootstrap`
  - mapping의 components/compositions/screens node를 Figma `/v1/images`로 렌더링.
  - `.automation/images/baseline/{nodeId}.png` 저장.
  - `.automation/reports/images-bootstrap-{ts}.md` 리포트 생성.
- **Viewer generation**: `npm run figma:viewer:generate -- <cs-id>`
  - classified diff의 changed node를 렌더링해 `.automation/images/snapshots/{csId}/`에 저장.
  - baseline/snapshot 이미지를 `dist-viewer/cs/{csId}/images/`로 복사.
  - before/after HTML을 `dist-viewer/cs/{csId}/index.html`로 생성.
  - `FIGMA_VIEWER_BASE_URL`이 있으면 manifest에 hosted URL 기록.
- **Immutable cs manifest**: `.automation/cs/{csId}.json`
  - `report.ts`가 cs report 생성 시 manifest를 생성.
  - `viewer-gen.ts`가 image hash와 viewer URL을 갱신.
  - `figma-pipeline.yml`이 viewer 생성 직후 manifest를 git에 commit/push해 label workflow가 재현 가능한 상태 파일을 읽을 수 있게 한다.
  - `post-run-actions.ts`가 생성/갱신한 GitHub Issue 번호와 URL을 manifest에 best-effort로 기록한다(동일 run artifact에는 포함, repo 영구 상태의 필수 입력은 아님).
- **Designer approval label flow**:
  - `.github/labels.yml`에 `designer-approved`, `designer-rejected` 추가.
  - `.github/workflows/designer-approval.yml`이 Issue label event를 받아 manifest state를 `designer-approved` / `designer-rejected`로 transition.
  - Phase A는 결정을 기록하고 Issue에 comment한다. marker 기반 코드 자동 수정은 Phase B에서 진행.
- **Pipeline integration**:
  - `figma-pipeline.yml`이 cs 생성 후 viewer를 만들고 `gh-pages`에 publish한 뒤 manifest를 persist하고 post-run Issue/PR routing을 실행.
  - post-run Issue body 상단에 viewer URL을 추가한다.

로컬 검증:

```bash
npm run figma:test:cs-manifest
npm run figma:test:figma-images
npm run figma:test:viewer-generator
npm run figma:test:designer-approval
npm run lint
```

실환경 확인 결과 (2026-05-21):

- Baseline images seeded and merged via PR #16.
- GitHub Pages publish confirmed via run `26211035500`.
- Manifest commit/push confirmed via `0ad6775` and designer decision commit `fc3cda8`.
- `designer-approval.yml` label event confirmed via run `26211056345`.
- Artifact handoff fix implemented: designer approval downloads the original pipeline artifact by manifest `runId`. Live PR creation revalidation remains.

---

## 10-3. Stage 1 — Baseline bootstrap + snapshot 이미지 저장 인프라

**Codex 보강**: 첫 사이클 "before 없음" 문제 회피 위해 모든 매핑된 review target에 대해 baseline 이미지 일괄 시드.

**문제:** 지금 baseline JSON에는 텍스트 hash만 있고 PNG가 없음. 진정한 before/after 보여주려면 baseline 시점의 Figma 렌더가 필요.

**해결:**

0. **Bootstrap 일회성 명령** (`npm run figma:images:bootstrap`):
   - 매핑된 모든 review target node ID 추출
   - 배치로 `/v1/images` 호출 (한 호출에 ~20 nodeId 안전)
   - 다운받아 `.automation/images/baseline/{nodeId}.png` 저장 + 첫 commit
   - 결과: 다음 cron이 즉시 진정한 before/after 가능
1. **snapshot 단계 확장** (`scripts/pipeline/snapshot.ts` 끝부분):
   - 변경 감지된 노드만 (전체 186개 아님) Figma `/v1/images?ids=...&format=png&scale=2` 호출
   - 응답 URL을 `fetch()` 해서 PNG 바이너리 다운
   - `.automation/images/snapshots/{ts}/{nodeId}.png` 저장 (gitignored)
   - 이미지 메타 (size, etag, hash) snapshot JSON에 추가: `nodes[key].imageSha256`
2. **promote 단계 확장** (`scripts/pipeline/promote-dev.ts`):
   - 승급되는 snapshot의 이미지를 `.automation/images/baseline/{nodeId}.png`로 복사
   - 이 디렉터리는 **git에 트래킹** (PNG는 작음 ~50-200KB, 변경된 노드만 갱신됨)
   - 누적 50MB 초과 시 git-lfs 또는 external object storage 검토 (threshold alarm)
3. **cleanup 단계** (cron 또는 수동):
   - `.automation/images/snapshots/` 14일 이상된 디렉터리 삭제
   - baseline은 그대로 (한 노드당 한 파일만 유지)

**비용/위험:**
- Figma API 호출 추가: 한 사이클 4-186 노드 × `/v1/images` 1번 (배치 가능, 한 호출에 여러 ids)
- 다운로드: 4-186 PNG × 평균 100KB ≈ 0.4-18MB per cron
- baseline image storage: 186 노드 × 200KB = 37MB git 트래킹. 매번 다 갱신 안 됨 → 실제로는 변경된 것만 갱신
- 30분 URL 만료 — snapshot 단계에서 즉시 다운받으면 안전

**완료 기준:**
- 한 사이클 돌면 `.automation/images/snapshots/{ts}/`에 변경 노드 PNG 존재
- promote 후 `.automation/images/baseline/{nodeId}.png` 존재 + git 트래킹
- snapshot JSON에 `imageSha256` 필드 포함

---

## 10-4. Stage 2 — cs-{id} viewer HTML 생성 + GitHub Pages 호스팅

**문제:** 디자이너가 클릭할 단 하나의 URL이 있어야 함. 로컬 viewer는 디자이너에게 환경 강요. 호스팅 필요.

**해결:**

1. **viewer generator** (`scripts/pipeline/viewer-gen.ts` 신규):
   - cs report + classified diff + baseline/snapshot 이미지 읽음
   - per-cs HTML 페이지 생성. 구조: 헤더(cs 메타) + per-node 카드(before/after side-by-side, 코드 경로, Figma 링크, GitHub Issue 링크, 분류 사유)
   - 이미지: `images/{nodeId}-before.png`, `{nodeId}-after.png` 상대 경로
   - 출력: `dist-viewer/cs/{id}/index.html` + `dist-viewer/cs/{id}/images/`
   - index 페이지 (`dist-viewer/index.html`): 최근 30개 cs 목록 (status별 색상)
2. **GitHub Pages 푸시** (workflow `figma-pipeline.yml`에 단계 추가):
   - cs report 생성 직후 viewer-gen 실행
   - `dist-viewer/` 를 `gh-pages` 브랜치에 푸시 (peaceiris/actions-gh-pages@v3 또는 동등)
   - URL: `https://jhlee9815.github.io/uno-home/cs/{id}/`
3. **post-run-actions 연동**:
   - GitHub Issue body 첫 줄에 viewer URL 추가
   - Slack 메시지에 viewer URL 추가

**비용/위험:**
- gh-pages 브랜치 storage: 누적 cs 30개 × 4-10 이미지 × ~200KB ≈ 24-60MB → 적정
- 푸시 race: cron concurrency `cancel-in-progress: false` 이미 설정됨 → 직렬 OK
- private repo + Pages: 사용자 GitHub 플랜에 따라 Pages 비공개 호스팅 가능 여부 확인 필요 (Pro면 OK)

**완료 기준:**
- `https://jhlee9815.github.io/uno-home/cs/{id}/` 클릭 시 viewer 표시
- Issue body + Slack에 URL 포함
- 디자이너가 Figma + IDE 안 열고도 변경 파악 가능

---

## 10-4b. Stage 3a — Immutable cs manifest (Codex 권고)

**문제 (Codex 지적):** 현재 `.automation/reports/diffs/snapshots`가 gitignored + Actions artifact로만 업로드. label workflow가 트리거됐을 때 원본 cs 데이터에 안정적으로 접근 못 함. 라벨이 state면 truth source가 GitHub UI에 종속.

**해결:** cs별 영구 manifest를 git-tracked 디렉터리에 작성.

1. **새 디렉터리** `.automation/cs/` (git-tracked):
   - `.automation/cs/{cs_id}.json` — 한 cs 당 한 파일
   - 구조:
     ```json
     {
       "csId": "cs-2026-05-20T12-00-05",
       "createdAt": "...",
       "runId": "GitHub Actions run ID",
       "fileKey": "9cevQvPHlQ...",
       "baseSnapshotPath": ".automation/baseline/2026-05-20T02-09-13.json",
       "headSnapshotRef": "sha256:...",
       "classifiedDiffRef": "sha256:...",
       "imageRefs": { "7:3": "sha256:..." },
       "githubIssueNumber": 8,
       "viewerUrl": "https://jhlee9815.github.io/uno-home/cs/cs-...",
       "state": "pending|designer-approved|designer-rejected|pr-open|merged|shipped",
       "stateHistory": [
         {"state": "pending", "at": "...", "by": "github-actions[bot]"},
         {"state": "designer-approved", "at": "...", "by": "@jhlee9815", "via": "label:designer-approved"}
       ]
     }
     ```
2. **state machine** (`scripts/pipeline/lib/cs-manifest.ts` 신규):
   - 함수: `createManifest(cs)`, `transition(csId, newState, actor)`, `loadManifest(csId)`
   - 모든 stage(report 생성, label workflow, PR open, merge, promote)가 이걸 통해 state 갱신
3. **git-tracked 가시성**:
   - 모든 cs 이력이 main 브랜치에 영구 기록 → audit trail
   - label만 봐선 못 보는 metadata 다 보존 (runId, artifact hash, viewer URL 등)
4. **artifact resolution**:
   - classifiedDiff/headSnapshot은 sha256 ref로만 manifest에 저장 (실제 본문은 여전히 artifact)
   - resolveArtifact(ref) — 1순위 local, 2순위 GitHub Actions artifact API 다운로드, 3순위 fail

**비용:**
- cs 100건 누적 시 ~100 × 2KB = 200KB git history. 무시 가능.
- 모든 stage가 manifest 통해 state 갱신 → 약간의 boilerplate 추가

**완료 기준:**
- 새 cs 생성 시 `.automation/cs/{cs_id}.json` git에 commit됨
- label/PR/merge 시점에 state 갱신되고 stateHistory에 누적
- 임의 cs_id로 `loadManifest()` 호출 시 모든 reference resolve 가능

---

## 10-5. Stage 3 — 디자이너 승인 라벨 트리거 workflow

**문제:** 디자이너 결정을 어떻게 시스템에 전달할까. CLI 명령 (`npm run figma:approve`)은 IDE 강요. UI 폼은 백엔드 강요.

**해결:** GitHub Issue 라벨 변경 = 결정. 새 라벨 2개 + 새 workflow.

1. **새 라벨** (`.github/labels.yml`):
   - `designer-approved` (초록) — "디자이너가 변경 승인. 자동 코드 수정 트리거."
   - `designer-rejected` (빨강) — "디자이너가 변경 거부. baseline 그대로 유지."
2. **새 workflow** (`.github/workflows/designer-approval.yml`):
   - 트리거: `on: issues: types: [labeled]`
   - 조건: `label.name in ('designer-approved', 'designer-rejected')`
   - 작업:
     - Issue body에서 cs_id 추출 (정규식 `cs-\d{4}-\d{2}-\d{2}T[\d-]+`)
     - approved: `tsx scripts/pipeline/designer-approve.ts cs-{id}` 실행 → 자동 코드 수정 시도 → PR 생성 (Stage 4)
     - rejected: `npm run figma:reject cs-{id} "designer rejected via Issue #N"` 실행 → baseline 변화 없음, cs를 rejected로 마킹

**비용/위험:**
- 라벨 오용: 디자이너가 실수로 다른 Issue에 라벨 → workflow 트리거 안 되게 cs_id 추출 실패 시 no-op + Issue 코멘트 "cs_id 추출 실패"
- 권한: Issue 라벨 권한 있는 사람 = 디자이너 + 개발자 둘 다. 디자이너 GitHub 계정 필요.

**완료 기준:**
- Issue에 `designer-approved` 라벨 → 1분 내 workflow 트리거 → PR 또는 noop Issue 코멘트
- `designer-rejected` 라벨 → cs 파일에 `rejectReason` 기록

---

## 10-6. Stage 4 — 코드 자동 수정 시도 (Codex 반영: Tier 2 드롭)

**문제:** 디자이너 승인 = "이 변경 받아들이겠다." 코드를 어떻게 수정할까. 현재 `apply-code.ts`는 marker-based text patch만 함.

**Codex 권고 반영:** 안전한 자동 patch만 시도. Tier 2 (단순 text-matching)는 silent false-patch 위험 (i18n 키 충돌, CI/visual-diff 둘 다 못 잡음) — 드롭.

**해결:** 2-tier + fallback. AST 기반 selector.

1. **Tier 1: marker-based text patch** (기존, 변화 없음)
   - `// figma-marker: pesse.send.cta` 주석 또는 jsx attribute `data-figma-marker="pesse.send.cta"` 옆 텍스트 patch
2. **Tier 2: AST-driven component-props patch** (신규, code-adjacent marker 기반)
   - 매핑은 **글로벌 yaml이 아니라 code-adjacent marker**로:
     ```tsx
     {/* figma-prop: pesse_send.Variant -> variant */}
     <CTAButton variant="primary" disabled={false} />
     ```
   - parsing: ts-morph로 JSX attribute 찾기. marker 주석이 component 위에 있으면 매핑 적용.
   - 매핑 없으면 skip + PR description에 "props marker 필요" 명시
3. **Tier 3 (fallback)**: 위 둘 다 실패 → PR description에 "자동 patch 불가. 수동 편집 필요: `{code_path}`" + 변경 사항 요약 + viewer URL. PR은 여전히 생성 (디자이너 승인 기록 + 개발자 액션 게이트로서 의미).
4. **출력**:
   - 브랜치 `designer-bot/cs-{id}` (task-3과 동일 패턴)
   - PR title: `[designer-approved] cs-{id} — N change(s)`
   - PR body: cs report + viewer URL + tier별 patch 결과 + manifest link
   - CODEOWNERS 자동 reviewer 할당 (개발자)
   - **Slack hook (inline)**: PR open 시 "🛠 PR #M open for cs-{id} — dev review pending: {url}"

**비용/위험:**
- Tier 2 marker 없는 경우가 대부분 — 초기엔 자동 patch율 낮음. 마커 점진 추가 → 자동화율 ↑
- ts-morph 의존성 추가 (~3-5MB) — bundle은 안 들어감 (script-only)

**완료 기준:**
- fixture: text marker, props marker, no-marker (fallback) 3종 → 각각 Tier 1/2/3 동작
- PR 생성됨 + tier 결과 PR description에 명시
- false-patch 0건 (Tier 1/2 모두 명시적 marker만 건드림)
- Tier 2 silently 잘못된 prop 건드리는 시나리오 fixture 검증 ("marker 없으면 절대 안 건드림" 보장)

---

## 10-7. Stage 5 — 개발자 머지 게이트

**문제:** auto-PR이 머지될 때 안전 보장.

**해결:** 기존 GitHub 기능 활용 (대부분 task-4에서 이미 셋업).

1. **PR CI 체크**:
   - tsc + lint + build (기존)
   - + visual diff: Playwright로 변경 화면 실제 렌더 → baseline image와 pixel diff (이미 `visual-diff.ts` 있음, auto-apply 경로용)
   - + Figma render vs app render 일치 검증 (Stage 1 baseline image vs Playwright 렌더, pixel diff threshold 5%)
2. **branch protection** (`main` 브랜치):
   - require `figma-pipeline` + `visual-diff` 통과
   - require 1 review from CODEOWNERS (개발자)
   - disallow self-approval
3. **post-merge** (Codex 반영: branch protection 충돌 회피):
   - **방법 A (권장)**: PR 자체에 baseline 갱신 commit 포함. designer-approve 시점에 `figma:promote` 실행해서 새 brand baseline을 cs branch에 commit → 한 PR이 코드 수정 + baseline 갱신 동시에 함
   - **방법 B**: PR 머지 후 별도 follow-up PR `auto-promote/cs-{id}` 생성 → dev가 한 번 더 머지
   - 직접 main push는 금지 (branch protection)
   - Slack hook (inline): merge 직후 "🚀 cs-{id} shipped"

**비용/위험:**
- visual-diff 시간: 화면당 ~10-30초 × N 화면. 4개 화면 → 2분 추가. OK.
- branch protection 자기-승인 금지 → 1인 dev 환경에서 막힘. 일단 require review 비활성, CI만 강제. 추후 팀 늘면 켬.

**완료 기준:**
- auto-PR 머지 → 1분 내 promote workflow 트리거 → baseline 갱신 commit이 main에 push
- 다음 cron 사이클에서 동일 diff 다시 안 잡힘

---

## 10-8. (제거됨) ~~Stage 6 — 라이프사이클 Slack 알림 전용 stage~~

**Codex 반영:** 별도 stage 제거. 각 transition은 해당 stage에서 inline hook.

| Transition | 어디서 (stage) | Slack 메시지 |
|---|---|---|
| 새 cs 생성 | Stage 2 (viewer-gen 직후) | 🔔 cs-{id} — N change(s), viewer: {url}, Issue: {url} |
| 디자이너 승인 | Stage 3 (label workflow) | ✅ Designer approved cs-{id} (Issue #N), PR generation in progress |
| 디자이너 거부 | Stage 3 (label workflow) | ❌ cs-{id} rejected by designer, baseline unchanged |
| auto-PR 생성 | Stage 4 (apply 직후) | 🛠 PR #M open for cs-{id} — needs dev review: {url} |
| PR 머지 + promote | Stage 5 (post-merge) | 🚀 cs-{id} shipped — baseline updated |

검증: Stage 7 contract test에 알림 검증 포함.

---

## 10-9. Stage 7 — e2e fixture 테스트 + 롤백

**문제:** 7개 stage 통합되면 race / 누락 / cascade fail 발생 가능.

**해결:**

1. **e2e fixture test** (`scripts/pipeline/e2e-designer-workflow.test.ts`):
   - mock Figma 변경 fixture → snapshot/diff/classify/report 통과 → Issue 생성 시뮬 → 라벨 부착 시뮬 → designer-approve 실행 → PR/no-op 검증
2. **롤백 시나리오**:
   - 디자이너 승인했는데 auto-edit 실패 → Tier 4 PR (변경 없음) → 개발자 close → cs는 어떻게? → 새 상태 `pending-manual-edit` 도입 또는 cs 그대로 두고 다음 cron에 다시 잡힘 (현재 동작과 일관)
   - PR 머지 후 production에서 visual 회귀 발견 → revert PR → post-revert workflow가 baseline rollback (이건 v2 후순위, 일단 수동)
3. **observability**: 각 transition을 jsonl에 기록 (`.automation/lifecycle.jsonl`) — 디버깅용

**완료 기준:** e2e test 통과 + 롤백 시나리오 1개 이상 문서화

---

## 10-10. 결정 사항 / 미정

| 결정 | 선택 | 사유 |
|---|---|---|
| 디자이너 결정 채널 | GitHub Issue 라벨 | UI 없이 즉시 작동, GitHub 권한만 있으면 됨 |
| Viewer 호스팅 | GitHub Pages (gh-pages 브랜치) | 추가 서비스 없음, repo 권한만 필요. Pro 플랜이면 private repo도 Pages 가능 |
| 이미지 storage | git-tracked baseline + gitignored snapshots | baseline은 진실의 source, 작음. snapshot은 ephemeral. |
| 자동 코드 수정 범위 | 3-tier + fallback | 100% 자동 시도하되 실패 시 솔직히 PR description으로 명시 |
| AST 라이브러리 | ts-morph (강한 타입 지원) 또는 jsx-ast-utils (가볍지만 wrapper 필요) | Stage 4 진입 시 결정 |
| Designer GitHub 계정 | 필수 | 라벨 권한 위해. 외부 디자이너면 collaborator 추가 |

## 10-11. 미정 위험

| # | 위험 | 완화책 |
|:-:|---|---|
| 1 | Figma `/v1/images` rate limit (분당 300 호출) | 변경된 노드만 렌더 (대부분 사이클 4-10건). 캐시 LRU 도입 |
| 2 | gh-pages private repo 호스팅 안 됨 (구 Free 플랜) | Pro 확인. 안 되면 viewer를 GitHub Actions artifact로 zip 첨부 + 디자이너가 다운받음 (UX 후퇴) |
| 3 | text-matching patch가 i18n 키와 충돌 | dry-run 모드 + 단일 매칭만 적용 + 단어 경계 |
| 4 | 디자이너 GitHub 미숙 → 라벨 안 붙임 | viewer 페이지에 "라벨 붙이는 법" 가이드 + 라벨 부착 버튼 (GitHub deeplink) |
| 5 | auto-PR 양산 | concurrent cs 처리 시 race condition. cs당 PR 1개 정책, 이미 PR 있으면 update |
| 6 | 디자이너가 라벨 잘못 붙임 (다른 Issue) | cs_id 추출 실패 시 Issue 코멘트로 "cs_id 못 찾음, 의도 확인 부탁" |
| 7 | 개발자 부재 시 PR 적체 | branch protection 시 review 요구 비활성 옵션 (1인 env), 팀 늘면 활성 |

## 10-12. 점진적 ship 경로 (Codex 반영 후 최종)

- **Phase A (8.5-11.5h)**: ✅ 완료 — Stage 1 + 2 + 3 + 3a. Bootstrap baseline 이미지, viewer 호스팅, 라벨 트리거, immutable cs manifest가 live로 확인됨.
- **Phase B (3-4h)**: 🟠 코드 merge + artifact handoff fix live artifact download 확인 — 다음 작업은 Actions 권한을 풀고 auto-edit/manual-edit PR 생성과 manifest `pr-open` 전이를 확인하는 것.
- **Phase C (4-6h)**: ⚪ 미시작 — dev gate (CI required, baseline은 PR에 포함) + contract/e2e test.

Phase B PR 생성과 manifest `pr-open` 전이 확인 후 Phase C 진입 권장. task-5는 cron 지연이 운영상 더 큰 문제가 될 때 끼워넣는다.

## 10-13. 범위 외 (명시)

- Real-time Figma webhook 트리거 — task-5 (Cloudflare Worker)
- Resend 이메일 알림 — task-6 ⏭ SKIPPED (Slack 도달로 대체, 2026-05-21)
- INSTANCE_SWAP 감지 — task-8 v2
- LLM 기반 코드 생성 — 후속 task
- 디자인 시스템 일관성 자동 fixup (예: hex 색상 → 토큰 자동 변환) — task-10 v2
- Tier 2 단순 text-matching patch — Codex 권고로 영구 제외 (silent false-patch 위험)
- 디자이너 전용 webhook UI 백엔드 — 라벨로 충분, 백엔드 운영 비용 회피


## 10-14. Cross-track note — audit auto-register handoff (2026-05-21 23:28 KST)

Task 10 Phase B와 별도로, Task 8 후속 audit auto-register track이 진행됐다.

- PR #23 merged: `bcb7e98 feat(audit): two-sighting auto-register + daily cron (#23)`.
- Live verify created PR #25 with two generated report-only mappings.
- PR #25 needs body/check follow-up before merge: second frame name blank in body, PR `statusCheckRollup` empty despite validation dispatch success.
- Resume doc: [`audit-auto-register-handoff-2026-05-21.md`](./audit-auto-register-handoff-2026-05-21.md).

After #25 is resolved, return to Phase B PR creation/manifest `pr-open` verification and then Phase C.
