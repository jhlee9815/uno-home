# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-25 22:30 KST (검출 결손 3종 해결: PR #131 새 frame compliance + PR #132 audit→slack live 확인. 다음: Phase 2 PR-B 슬랙 본문 강화.)

---

## 0. 현재 상태 (30초 요약)

전체 목표 `Figma 편집 → diff (텍스트/속성 + 새 프레임 + DS 미반영 감지) → Slack 알림 → 디자이너 확인 → 개발 변경 → 개발자 머지`의 5단계 진척:

| # | 단계 | 진척 | 비고 |
|:-:|---|:-:|---|
| 1 | Figma 편집 | 100% | 도구 외부 |
| 2 | 스케쥴 diff | 100% | daily audit + 2시간 pipeline cron + workflow_run cascade + 2-sighting auto-register live. **신규 frame compliance도 첫 cycle에 검출** (PR #131). baseline production flip 완료 (PR #80). |
| 3 | Slack 알림 + 디자이너 확인 | 100% (UX 강화 여지) | per-cs 알림 + **daily audit 절대량 알림** (PR #132) 둘 다 live. pipeline 본문은 카테고리 라인이 빈약 — Phase 2(PR-B)에서 raw class 라인 + cap 추가 예정. |
| 4 | 개발 코드 변경 | 90% | designer-bot App token, manifest PR auto-merge, baseline-promote production. 잔여: stale manual-edit PR 정리, baseline 디렉토리 prune. |
| 5 | 개발자 머지 | 90% | manifest/baseline-promote PR auto-merge live. Phase C visual diff/branch protection은 별개. |

**가중 진척 ≈ 96%.** 검출 결손 3종(신규 frame DS 미사용 / pipeline slack 카운트 / audit absolute slack)이 모두 해소돼 검출 시스템은 완성. 잔여는 UX(Phase 2)와 운영 정리.

### 최신 운영 증거 (2026-05-25)

- merged PRs (2026-05-25):
  - **#131 new-frame compliance detection** — `diff-snapshot.ts:129-140`의 `!beforeNode` 분기에 `diffCompliance(undefined, afterNode)` 연결. 신규 frame의 detached-style/new-frame/image-change가 첫 cycle에 슬랙·viewer·issue로 surface. T1~T5 단위 테스트 추가. 17/17 + 6/6 통과.
  - **#132 audit→slack notification** — `lib/audit-slack.ts` 순수 포매터 + `audit-notify.ts` 엔트리 + `lib/webhook.ts` 공유 helper. `figma-audit.yml`에 `Notify Slack` step + audit Issue URL `$GITHUB_OUTPUT` 캡쳐. `hasViolations=false`이면 침묵. 6 단위 테스트.
- audit→slack first live (workflow_dispatch run `26402360291`, 2026-05-25 13:14 UTC):
  - 본문: `🎨 일일 DS 컴플라이언스 audit — 2026-05-25 · 기준: 일일 전체 audit (delta 아님) · 전체 detached style: 1295건 (색상 72·타이포 1223) · 미등록 top-level frame: 0건 · 상위 위반 화면 top-5: 1. Pesse Apple-inspired — 3 screens(592건) 2. Phone · Home — Balance(145건) 3. Phone · Send Money(108건) 4. Phone · Cards — Select Card(98건) 5. test1(70건) · 외 6개 화면`
  - Issue #133 링크 + workflow URL 포함.
  - 의미: baseline 흡수돼 delta로는 안 보이던 1295건이 매일 슬랙 채널에 surface.
- 이전 세션 핵심 merged: #80 baseline-promote prod flip, #81 DS preview exclude (2:2/79:306), #82 audit refresh, #86 Korean reasons, #67 baseline-promote dry-run, #74 mapping cleanup, #63 manifest auto-merge, #28/#45 designer-bot App token, #33 Korean labels + cascade, #36 rename.
- stale manual-edit PR (정리 대기): #20, #40, #64, #71. 본문 path가 옛 `uno-home/` prefix.

### 단계 2 감지 매트릭스 (전체, 2026-05-25 기준)

| 감지 종류 | class | 트리거 | 자동 patch | 디자이너 검토 |
|---|---|---|---|---|
| 텍스트 변경 (marker 있음) | `text` → `text-change` | 매핑된 텍스트 노드 hash 변경 | ✅ Tier 1 marker patch | (auto-apply) |
| 속성/컴포넌트 props | `component-props` → `props-change` | 매핑된 노드 props hash 변경 | ✅ (mapping 허용 시) | (auto-apply) |
| 토큰 | `token` | tokensHash 변경 | ✅ | (auto-apply) |
| 구조 변경 | `structure` | 노드 추가/삭제/boundingBox null toggle | ❌ | ✅ Issue |
| 레이아웃 | `layout` | boundingBox 좌표/크기 변경 | ❌ | ✅ Issue |
| **새 프레임 추가** | `new-frame` | registered frame 내부 descendant frame 추가 + **!beforeNode 분기 신규 frame 자체도 포함 (PR #131)** | ❌ | ✅ Issue |
| **DS 토큰 미반영 (타이포/색상/효과)** | `detached-style` | Figma 변수/스타일 해제. **신규 frame 첫 cycle에서도 잡힘 (PR #131)** | ❌ | ✅ Issue + 매일 절대량 슬랙 (PR #132) |
| 이미지 변경 | `image-change` | image fill의 ref hash 변경. **신규 frame도 포함 (PR #131)** | ❌ | ✅ Issue |

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

## 2. 우선순위 1 — Phase 2 (PR-B): figma-pipeline 슬랙 본문 강화 + cap

### 배경

검출 결손 3종은 모두 해소됐다(PR #131/#132). 남은 결손은 **figma-pipeline의 슬랙 알림 본문이 빈약**한 것:

- `post-run-actions.ts:286 buildLocalizedSummary()`는 5개 compliance bucket(text-change/props-change/image-change/detached-style/new-frame)만 라인으로 출력
- `structure/token/layout/asset` 같은 raw class는 카테고리 라인에서 누락 → 사용자가 8건짜리 알림에서 "전체: 8건"만 보고 무슨 변경인지 모르는 케이스 (`cs-2026-05-25T11-44-34`)

### 작업 내용

1. `post-run-actions.ts:186-223 categoryCounts()`/`buildLocalizedSummary()` 확장:
   - raw class별 라인 추가 (`🧱 구조 변경: 8건 (추가 5·삭제 2·표시토글 1)`, `🎨 디자인 토큰 변경: N건`, `📐 레이아웃 변경: N건`, `📦 에셋 변경: N건`)
   - structure 종류 breakdown — `diff-snapshot.ts`의 reason 문자열로 추가/삭제/toggle 추론하거나 raw class에 sub-kind 부여
   - 영향 화면 top-3 inline 라인 (`• 영향 화면: Phone · Cards 외 7개`)
2. cap 정책:
   - 카테고리당 N건 이상이면 `(외 N건은 viewer 참조)` 추가
   - 슬랙 본문 길이 한도 — `truncateBody` 비슷한 가드
3. `lib/category-labels.ts`에 raw class 라벨도 노출(이미 `RAW_CLASS_LABEL_KO` 있음 — `category-labels.ts:30`).
4. 단위 테스트 — fixture로 `categoryCounts`/`buildLocalizedSummary`가 raw class도 정확히 집계하는지.

### 완료 조건

- ✅ cs-2026-05-25T11-44-34 같은 8건 알림이 다음부터 카테고리별로 풀어진 본문으로 옴.
- ✅ structure 알림에 추가/삭제 구분이 들어감.
- ✅ 영향 화면 이름 top-3 inline 노출.
- ✅ 50+ 건 케이스에 슬랙 본문 cap 적용.
- ✅ 기존 5개 compliance bucket 라인 회귀 없음.

### Codex 교차 검증 권고 (PR-B 진행 전)

- 변경 전 design draft를 cmux 워크스페이스의 Codex 세션에 전달 → 카테고리 라인 디자인 + cap 정책 일관성 검토
- 변경 후 final review로 회귀 위험(특히 categoryCounts 분기) 재확인

### 후순위 — 운영 정리

- **audit Issue dedup** — 직전 audit Issue와 detached/unregistered 카운트가 동일하면 새 Issue 생성 skip 또는 댓글 갱신. Issue #122/#133 같은 매일-close-and-create 패턴 노이즈 감소.
- **stale manual-edit PR 정리** — #20, #40, #64, #71. 본문 path가 옛 `uno-home/` prefix.
- **baseline 디렉토리 자동 prune** — 최근 N개만 유지하는 cleanup. promote production live 이후 누적 중.
- **Phase 3.1 audit trend** — `audit-state.json`에 prev `totalDetachedStyles` 저장 → 슬랙 본문에 `▲N vs 어제` 추가.
- **mapping cleanup** — `test1` (auto_test1_35_244) 같은 테스트 frame 정리.

---

## 3. 우선순위 2 — Phase C 안전망 (장기)

검출/알림 시스템이 안정화됐으니 다음은 머지 안전망.

### 목표
- visual diff (Playwright pixel diff) — 변경 화면 실제 렌더 vs baseline image
- branch protection rule — CODEOWNERS review + visual-diff CI 강제
- post-merge baseline auto-promote — PR에 baseline 갱신 commit 포함 또는 follow-up PR
- e2e fixture test + 롤백 시나리오 문서화

---

## 5. 끼워넣기 옵션 — Task 5 Cloudflare Worker (단계 2 즉시 트리거)

🔵 **adopter 옵션 (이 repo 운영자는 미사용)**. 다른 팀이 fork 후 즉시 반응을 원하면 셋업하라고 안내. 운영자 자신은 2시간 cron으로 충분히 운영하기로 결정 (2026-05-26).

- 필요: Cloudflare 계정, `wrangler` CLI, GitHub fine-grained PAT 또는 repository dispatch 권한, Figma webhook passcode/signature 검증.
- 목표: Figma 편집 → Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → `figma-pipeline.yml` 즉시 실행.
- 부수 옵션: 같은 Worker에 `/slack` 엔드포인트 추가하면 Slack slash command 트리거 가능 (Slack Workflow Builder 대체).
- 설계 문서는 `task-5-webhook-proxy.md`에 그대로 보존 — adopter가 그대로 따라 셋업 가능.

---

## 6. ~~Task 6 Resend 이메일~~ ⏭ SKIPPED

- Slack 알림 두 채널 (notifySlack webhook + GitHub 공식 Slack 앱)이 디자이너/PM에 도달하고 있어 이메일 채널 불필요.
- 코드 정리: `post-run-actions.ts`의 RESEND placeholder 제거 + `figma-pipeline.yml`의 RESEND env 제거 완료.
- 미래에 이메일이 필요해지면 [`task-6-email-resend.md`](./project-plan/phase-6/task-6-email-resend.md) 설계 그대로 부활 가능.

---

## 7. PR #131 완료 기록 (2026-05-25 13:03 UTC)

**제목**: Detect compliance violations on newly added frames (`!beforeNode` branch)

`scripts/pipeline/lib/diff-snapshot.ts:129-140`의 `!beforeNode` 분기가 `classes:['structure']`로 short-circuit 되면서 신규 frame이 가져온 detached-style/new-frame/image-change 위반이 첫 cycle에 누락되던 결손 해결. `diffCompliance(undefined, afterNode)`를 wire-up.

변경 파일:
- `scripts/pipeline/lib/diff-snapshot.ts` (+29 -4)
- `scripts/pipeline/lib/diff-snapshot.test.ts` (+134, T1~T4)
- `scripts/pipeline/lib/classify-diff.test.ts` (+74, T5)

검증: diff-snapshot 17/17, classify-diff 6/6, build clean, lint clean. Codex 교차 검증 통과 (pre-impl + post-impl).

## 8. PR #132 완료 기록 (2026-05-25 13:14 UTC)

**제목**: Send daily figma-audit summary to Slack

baseline에 흡수돼 delta로는 안 보이던 절대량 DS 미사용(1295건)을 매일 슬랙으로 push. issue #122에만 있던 정보를 디자이너가 실제 보는 채널로 가져옴.

추가 파일:
- `scripts/pipeline/lib/webhook.ts` — `postWebhook` 추출 (post-run-actions.ts와 공유)
- `scripts/pipeline/lib/audit-slack.ts` — 순수 포매터
- `scripts/pipeline/lib/audit-slack.test.ts` — 6 cases
- `scripts/pipeline/audit-notify.ts` — 엔트리, `hasViolations=false`이면 침묵

수정 파일:
- `scripts/pipeline/post-run-actions.ts` — postWebhook 인라인 → lib/webhook.ts import
- `.github/workflows/figma-audit.yml` — audit Issue URL `$GITHUB_OUTPUT` 캡쳐 + `Notify Slack` step
- `package.json` — `figma:audit:notify`, `figma:test:audit-slack`

첫 live run: `26402360291` (2026-05-25 13:14 UTC). 슬랙 본문 1295건 + top-5 화면 + Issue #133 링크 정상 도착.

Codex 교차 검증: pre-design Q1-Q5 결정 (분리/webhook 추출/issue URL 캡쳐/0건 침묵/top-N=5), post-impl OK + "기준: 일일 전체 audit (delta 아님)" 라인 권고 반영.

---

## 9. task-3 완료 기록 (2026-05-20 20:20 KST)

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
