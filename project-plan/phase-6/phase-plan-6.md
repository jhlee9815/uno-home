# Phase 6 — Phase A: 이 repo를 실서비스로 (Extraction-Friendly)

> 시작: 2026-05-20
> 목표 완료: 2026-06-03 (2주)
> 최신 갱신: 2026-05-21 16:55 KST — 세션 종료 정리. schema-compatible baseline `.automation/baseline/2026-05-21T07-43-40.json`이 `614dfc8`로 main에 push됨. Phase B live 검증은 artifact 다운로드 성공 후 apply 단계까지 진입했고, 다음 병목은 repo Actions workflow 권한(`default_workflow_permissions=read`, PR 생성 허용 false).
> 의사결정 근거: Codex consult (`session 019e4407-9f23`) 진입 검증, Codex review (`session 019e4514-e802`) task-3 evidence 검증 PASS.
> 자세는: **설계-추출-용이** — 단일 repo로 동작하지만, Phase 7(템플릿 추출)이 싼 형태

## 6-0. 한 줄 요약

> Pesse Figma → uno-home 코드 자동 반영을 **24/7 동작하는 GitHub Actions 서비스**로 만든다. Figma 편집 → 즉시 감지 → Slack/이메일 알림 + auto-apply는 Draft PR + report-only는 Issue로 라우팅 + CODEOWNERS로 영역 침범 차단.

## 6-1. 입력 조건 (Phase 5 끝난 상태)

- ✅ 파이프라인 8단계 동작 확인 (snapshot → diff → classify → apply → verify → report → promote)
- ✅ Pesse 3개 화면 + 활성 mapping 5건 (`config/figma-mapping.yaml`)
- ✅ 마커 1건 부착 (`pesse.send.cta` → node `10:62`)
- ✅ 데모 사이클 1회 완주 (baseline → Figma 편집 → cs 리포트 생성)
- ✅ GitHub remote `jhlee9815/uno-home` 연결 및 `main` push 완료

## 6-2. 완료 정의 (Done means)

- [ ] GitHub remote에 push되고 main 브랜치 보호 룰 적용됨
- [ ] `.github/workflows/figma-pipeline.yml` cron 트리거가 2시간마다 동작
- [ ] Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → 워크플로 실행 동작
- [ ] auto-apply 변경 시 Draft PR이 `designer-bot` 라벨로 자동 생성 + CODEOWNERS가 dev 리뷰 강제
- [ ] report-only 변경 시 Issue가 `designer-review` 라벨로 자동 등록
- [x] Slack/Discord webhook 알림 (Resend 이메일은 task-6 SKIPPED — Slack 도달로 충분)
- [x] Codex가 발견한 `promote-dev.ts` 스모크 키 버그 수정
- [x] **extraction-friendly 결정 4건 적용**: 6-4 참조

## 6-3. 단계별 작업 (Task 인덱스)

| # | 작업 | 상태 | 세부 문서 | 예상 시간 | 실 소요 |
|:-:|---|:-:|---|---|---|
| 1 | GitHub remote init + 초기 push | ✅ | [`task-1-github-init.md`](./task-1-github-init.md) | 30분 | 30분 |
| 2 | `.github/workflows/figma-pipeline.yml` 작성 | ✅ | [`task-2-actions-workflow.md`](./task-2-actions-workflow.md) | 1시간 | 45분 |
| 3 | `scripts/pipeline/post-run-actions.ts` 라우팅 스크립트 | ✅ V1~V4 실검증 통과 (V5 task-4 이후) | [`task-3-post-run-actions.md`](./task-3-post-run-actions.md) | 2시간 | ~2시간 (claude 초안 + codex 보강 + 실검증) |
| 4 | CODEOWNERS + PR/Issue 거버넌스 룰 | ✅ (branch protection은 task-5 후) | [`task-4-codeowners-governance.md`](./task-4-codeowners-governance.md) | 30분 | 25분 |
| 5 | Cloudflare Worker Figma webhook 프록시 | ⏳ | [`task-5-webhook-proxy.md`](./task-5-webhook-proxy.md) | 1~2시간 | — |
| 6 | Resend 이메일 통합 | ⏭ SKIPPED (Slack 알림 + GitHub 공식 Slack 앱으로 충분) | [`task-6-email-resend.md`](./task-6-email-resend.md) | 1시간 | — |
| 7 | `promote-dev.ts` 스모크 키 버그 수정 + env override | ✅ | [`task-7-bugfixes.md`](./task-7-bugfixes.md) | 30분 | 20분 |
| 8 | DS Compliance Detection Core (detached styles / image / new frames) | ✅ Stage 6 검증 + PR #9 merged (`6d4cd94`) | [`task-8-ds-compliance-detection.md`](./task-8-ds-compliance-detection.md) | 7-9시간 | 2.5시간+ |
| 9 | Report UX + Labels (task-8 후속) | ↘ Task 10에 대부분 흡수, label/summary 보강만 선택 | [`task-9-report-ux-labels.md`](./task-9-report-ux-labels.md) | 2-3시간 | — |
| 10 | Designer Review → Auto-Edit → Dev Merge Workflow | 🟠 Phase A live 완료. Phase B 코드 merged + artifact handoff fix live download 확인. PR 생성 권한 fix 후 재검증 대기. Phase C 미시작. | [`task-10-designer-workflow-design.md`](./task-10-designer-workflow-design.md) | 15.5-22.5시간 | A+B: ~11h+ |

**의존성**: 1 → 2 → 3 → 4 (병렬 가능: 5, 6, 7은 2 완료 후 순서 무관). 8은 완료. 9의 report/label 범위는 10 Phase A에 대부분 흡수됐으므로 필요 시 label/Slack summary 보강만 분리한다.

### 진행 로그
- 2026-05-20 16:38 KST — task-1 완료. repo `jhlee9815/uno-home` (private) 생성, FIGMA_TOKEN secret 등록, branch protection은 task-4로 보류.
- 2026-05-20 16:47 KST — task-2 완료. `.github/workflows/figma-pipeline.yml` 동작 확인 (run `26148882072`, 37s).
  - 발견 이슈 1: CI에 baseline 없음 → `.automation/baseline/` git 추적으로 전환
  - 발견 이슈 2: ANSI 색상 escape가 grep에 잡혀 multiline `change_count` → `sed`로 ANSI strip + `PIPESTATUS[0]`로 exit 캡처
  - 부수 warning: Node.js 20 actions 2026-06-02부터 deprecated → task-7에서 Node 24 강제 env로 선제 대응

- 2026-05-20 16:55 KST — Claude가 task-3을 진행하다가 토큰 소진으로 중단. 현재 남은 변경은 `package.json`, `package-lock.json`, 신규 `scripts/pipeline/post-run-actions.ts`. Slack webhook은 아직 없으므로 코드에서는 env 미설정 시 skip하는 방향으로 결정됨. 이 변경은 task-3 완료 전까지 Codex가 덮어쓰지 않는다.
- 2026-05-20 16:58 KST — Codex가 task-7 완료. `promote-dev.ts`, `verify.ts`, `config-loader.ts`, `.github/workflows/figma-pipeline.yml`에 extraction-friendly env override 적용. `npm run build`, `npm run lint`, `npm run figma:preflight`, env override preflight 통과.
- 2026-05-20 17:02 KST — Codex가 Claude의 `post-run-actions.ts`를 최소 보강: `DRY_RUN=1`일 때 GitHub search/create API를 호출하지 않도록 수정하고 `cs-2026-05-20T05-48-54`로 dry-run 통과 확인. 실제 GitHub Issue/PR 생성 검증은 task-3 완료 검증으로 남김.
- 2026-05-20 20:20 KST — Claude가 task-3을 이어서 V1~V4 실검증 완료. 코덱스 review 2회(`session 019e4514-e802`) 사이클로 doc 정합성과 evidence 둘 다 PASS. **task-3 ✅**. 세부: [`task-3-post-run-actions.md`](./task-3-post-run-actions.md) "검증 결과" 섹션. 다음은 task-4.
- 2026-05-20 20:45 KST — task-4 완료: `.github/CODEOWNERS`(단일 owner + Phase 7 분리 TODO), `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/designer-review.md`, `labels.yml` 추가. task-3 자동 생성 라벨 4개 색상/설명 표준화 (GitHub API PATCH ×4). branch protection rule은 외부 webhook(task-5) 이후로 분리. 세부: [`task-4-codeowners-governance.md`](./task-4-codeowners-governance.md) "완료 기록" 섹션.
- 2026-05-20 21:05 KST — Slack 통합 문서 추가 ([`slack-integration.md`](./slack-integration.md)). 첫 자연 트리거(workflow_dispatch run `26161348247`) → Issue [#3](https://github.com/jhlee9815/uno-home/issues/3) 생성 + Slack 채널 자동 알림. task-3 V5(워크플로 통합) 통과 evidence 확보.
- 2026-05-20 22:00 KST — task-8 (DS Compliance Detection Core) + task-9 (Report UX + Labels) 설계 확정. Codex 1차 검증 GO. task-8: deep traversal extraction + detached-style/new-frame/image-change subcategory + report parent grouping. 7-9시간 견적. task-9는 task-8 schema 안정화 후 진입. 세부: [`task-8-ds-compliance-detection.md`](./task-8-ds-compliance-detection.md), [`task-9-report-ux-labels.md`](./task-9-report-ux-labels.md).
- 2026-05-20 22:26 KST — task-8 Stage 0 완료. Figma Nodes API 실응답에서 `boundVariables` 142건, styleId 0건, `imageRef` 10건, `INSTANCE_SWAP` 0건 확인. Stage 1 schema contract 진행 가능. 상세: [`task-8-stage0-field-summary.md`](./task-8-stage0-field-summary.md).
- 2026-05-20 22:34 KST — task-8 Stage 1 완료. `scripts/pipeline/lib/compliance-types.ts`와 [`task-8-schema-contract.md`](./task-8-schema-contract.md) 추가. 다음은 Stage 2 deep traversal extractor.
- 2026-05-21 10:33 KST — task-8 Stage 2-5 local 구현/검증 완료. `snapshot-node.ts` deep traversal extractor, `diffCompliance`, classify `subcategories`, cs report compliance sections, local pending viewer 추가. full figma test loop + `npm run lint` + `npm run build` PASS.
- 2026-05-21 10:43 KST — task-8 Stage 6 실 Figma 검증 완료. 임시 probe로 detached-style/new-frame/image-change가 `cs-2026-05-21T01-42-28` report에 반영됨. 기존 old-schema baseline flood 이슈 발견 후 `diffCompliance()` skip guard 추가. probe cleanup 완료. PR #9: https://github.com/jhlee9815/uno-home/pull/9
- 2026-05-21 10:46 KST — PR #9 merged to main (`6d4cd94`). Post-merge local `npm run lint` / `npm run build` PASS.
- 2026-05-21 11:15 KST — task-10 Phase A 1차 구현 진행: cs manifest, baseline/snapshot image helpers, viewer generator, designer approval label workflow, pipeline viewer publish + manifest persist step 추가. 로컬 신규 tests, full figma test loop, lint, build PASS.
- 2026-05-21 16:15 KST — task-10 live 정리: PR #10 merged, #16 baseline PNG seed, #17/#18 Phase B auto-edit PR flow merged. `figma-pipeline` run `26211009015`, Pages run `26211035500`, `designer-approval` run `26211056345` success. Issue #19 `designer-approved` → `.automation/cs/cs-2026-05-21T07-07-04.json` state `designer-approved`. 단, approval run에서 classified diff/snapshot artifacts missing으로 auto-edit PR 생성은 skip됨.
- 2026-05-21 16:45 KST — artifact handoff fix 구현: `designer-approval.yml`에 `actions: read`, manifest `runId` 기반 artifact prepare/download step, workflow contract test(`figma:test:workflow-artifacts`) 추가.
- 2026-05-21 16:55 KST — live 검증 1-2 완료: #19 `designer-approved` 라벨 재적용 → run `26212122539`; `Download originating pipeline artifacts` step이 `figma-pipeline-26211009015`를 성공적으로 다운로드. Apply 단계 진입 후 `GitHub Actions is not permitted to create or approve pull requests`로 PR 생성 실패. 원격 branch `designer-approved/cs-2026-05-21T07-07-04`는 push됨, open PR 없음. repo 권한 확인 결과 `default_workflow_permissions=read`, `can_approve_pull_request_reviews=false`.
- 2026-05-21 16:55 KST — schema-compatible baseline refresh를 main에 push: `614dfc8 Seed a schema-compatible Figma baseline`. 다음 scheduled run부터 기존 등록 node의 `detached-style` / `new-frame` / `image-change`가 baseline 이후 증분으로 감지 가능.


- 2026-05-21 23:28 KST — audit auto-register 구현 PR #23 merge 완료: `bcb7e98 feat(audit): two-sighting auto-register + daily cron (#23)`. `figma-audit`는 daily cron, audit-state cache, 2-sighting candidates, `figma:audit:register`, auto-register PR creation, and explicit `pr-checks` dispatch를 포함한다.
- 2026-05-21 23:28 KST — live verify: `figma-audit` run `26232066749` success 후 run `26232107808` success가 PR #25 `[auto-register] 2 frame(s) — 2026-05-21`를 생성. PR diff는 `config/figma-mapping.yaml`에 `auto_test1_35_244`와 `auto_test2_35_382`를 추가한다. `pr-checks` dispatch run `26232141435` success.
- 2026-05-21 23:28 KST — stopped point: Claude session limit. PR #25 body에서 두 번째 frame name이 blank로 표시되고, PR `statusCheckRollup`은 empty라 required check association 확인 필요. 자세한 resume 문서: [`audit-auto-register-handoff-2026-05-21.md`](./audit-auto-register-handoff-2026-05-21.md).

## 6-4. Extraction-Friendly 설계 결정 (Phase 7 비용 선납)

Codex가 지적한 9가지 재사용 차단점 중, Phase 6 작업 중에 어차피 손대는 4개는 **처음부터 일반화 가능한 형태로** 작성한다. 나머지 5개는 Phase 7에서.

| Codex 차단점 | Phase 6에서 다루는가 | 일반화 방식 |
|---|:-:|---|
| ① `config/figma.yaml` fileKey 하드코딩 | ✅ 완료 | `FIGMA_FILE_KEY` env var 우선, yaml fallback. `config-loader.ts` 수정. |
| ② mapping 프로젝트별 | ❌ | Phase 7 (마이그레이션 가이드 작성) |
| ③ config-loader `../../../config` 상대경로 | ✅ 완료 | `FIGMA_CONFIG_DIR` env var 우선, fallback to default. |
| ④ apply 마커 형식 | ❌ | Phase 7 (변환 도구) |
| ⑤ verify `npm run build/lint` 하드코딩 | ✅ 완료 | `FIGMA_VERIFY_BUILD_CMD` / `FIGMA_VERIFY_LINT_CMD` env var. 미설정 시 default. |
| ⑥ viewport 390x844 | ❌ | Phase 7 |
| ⑦ promote-dev 포트/키 하드코딩 | ✅ 완료 | `FIGMA_PROMOTE_PORT`, `FIGMA_SMOKE_KEYS` env var. 기본 smoke key는 Pesse 3개 화면. |
| ⑧ launchd plist 절대경로 | ❌ | Phase 6에서 plist 안 씀 (GitHub Actions로 대체) |
| ⑨ package.json `pesse-apple` | ❌ | Phase 7 (CLI 패키지 분리 시) |

**핵심 원칙**: env var 우선, 미설정 시 현재 동작 그대로. 후방 호환성 깨지지 않음.

## 6-5. 영역 침범 방지 (디자이너 ↔ 개발자 경계)

Codex 검증 결과 user concern 재확인 — 자동 PR이 디자이너 영역 침범으로 보일 수 있음. 대응:

```
[변경 입력] (디자이너 영역)
  ↓
[1겹] figma:text / figma:prop 마커 화이트리스트 — 마커 없는 노드는 자동으로 report-only
  ↓
[2겹] allowedClasses 매핑 — text/prop는 OK, layout/structure는 차단
  ↓
[3겹] PR은 항상 Draft + 라벨 `designer-bot` + CODEOWNERS로 dev 리뷰 강제
  ↓
[4겹] 채널 분리 — auto-apply → PR (개발자 결정 필요), report-only → Issue (참고용)
  ↓
[출력] (개발자 영역)
```

세부는 [`task-4-codeowners-governance.md`](./task-4-codeowners-governance.md).

## 6-6. 검증 방법

각 task 종료 시:

```bash
npm run figma:preflight    # mapping 정합성
npm run build              # vite build PASS
npm run lint               # eslint 0 errors
npm run figma:run          # 파이프라인 전체 동작
```

Phase 6 전체 종료 시 추가:

```bash
# Actions 동작 확인
gh workflow run figma-pipeline.yml
gh run watch

# Webhook 동작 확인 — Figma에서 텍스트 변경 후 5분 내 PR/Issue 생성 확인
gh pr list --label designer-bot
gh issue list --label designer-review

# Slack 수신 확인 — 수동 (notifySlack webhook + GitHub 공식 앱)
```

## 6-7. 리스크 / 한계

| # | 리스크 | 완화책 |
|:-:|---|---|
| 1 | Figma webhook signature 검증 누락 시 누가 trigger 가능 | task-5에서 `X-Figma-Signature` 검증 필수 |
| 2 | GitHub Actions cron 정확도 ±15분 | webhook 주 + cron 보조 이중화 |
| 3 | FIGMA_TOKEN GitHub Secrets 유출 | GitHub OIDC 검토는 Phase 7 |
| 4 | 자동 PR 누적 (디자이너 빈번 편집) | task-3에서 동일 노드 변경은 PR 업데이트(branch reuse), 새 PR 만들지 않음 |
| 5 | 발표 후 검증 없이 다른 팀 권유 위험 | "내부 데모" 표현 유지, Phase 7 완료 전엔 "공유 가능"이라 말하지 않음 |

## 6-8. Phase 6 종료 조건 = Phase 7 시작 조건

Phase 7로 넘어가려면:
- [ ] Phase 6 완료 정의 7개 항목 전부 ✅
- [ ] 2주 이상 실 운영 (안정성 검증)
- [ ] 디자이너 1명, 개발자 1명이 실제로 사용해 봄 (피드백 1라운드)
- [ ] 영역 침범 우려가 실제로 발생하지 않았는지 사후 확인

위 조건이 안 충족되면 Phase 7는 미루고 Phase 6 안정화에 집중.

## 6-8-A. 운영 관찰 참고 (2026-05-20 ~ 05-23 기록)

task-3/4가 첫 자연 트리거로 동작 확인됨 (V5 통과). 이 섹션은 원래 task-5 진입 전 cron 자연 실행 관찰용으로 작성됐으며, Task 8 merge 이후에도 운영 상태 확인 루틴으로 유지한다.

### 관찰 목적
- cron이 매 2시간마다 정상 실행되는지
- figma 파일 변경 누적이 알림 폭주로 이어지지 않는지
- post-run-actions의 report-only/auto-apply 분기가 일관되게 동작하는지
- Slack 알림이 누락 없이 채널에 도달하는지

### 노트북 꺼져 있어도 OK
cron은 GitHub 클라우드 서버 (`ubuntu-latest`)에서 GitHub Actions가 직접 돌립니다. 사용자 노트북과 무관:
- 매 2시간마다 자동 실행
- 결과는 Slack에 자동 알림 (어디서든 받음)
- 노트북은 결과를 **볼 때만** 필요

### 매일 1초 routine
노트북 켜면 한 번:
```bash
cd /Users/juhee/Work/Test/design-test/uno-home
npm run figma:health
```

출력 해석:
| 줄 | 의미 |
|---|---|
| `Runs N (schedule/manual/dispatch)` | 지난 24h 워크플로 실행 횟수와 트리거 종류. cron은 schedule, 핀에서 누른 건 manual, 외부 webhook은 dispatch (task-5 후) |
| `Conclusion ✅ N ❌ N` | success / failure 수. failure ≥ 1이면 GitHub Actions 페이지 확인 권장 |
| `Avg duration` | 정상은 30-60초. 90초 넘기 시작하면 figma API 응답 지연 의심 |
| `Latest run` / `Earliest run` | 최근 실행 시각 + 결과 |
| `Open issues N` | 미처리 designer-review Issue. 디자이너 검토 후 close 필요 |
| `Open PRs N` | 미머지 designer-bot PR. dev 리뷰 후 머지/close |
| `Anomalies ✅ none detected` | 정상. 매일 이거 한 줄만 확인하면 끝 |

옵션 환경변수:
- `WINDOW_HOURS=72 npm run figma:health` — 72시간 윈도우
- `STALE_HOURS=24 npm run figma:health` — 24h 안 변동 Issue/PR을 stale로 표시

### 이상 신호 + 즉시 대응
| 신호 | 의미 | 대응 |
|---|---|---|
| `Anomalies ⚠️ 2 consecutive failures` | 연속 실패 (success/cancelled/skipped 없이 failure 2회+) | failure URL 클릭 → 로그 확인 → 원인 fix |
| `Anomalies ⚠️ Issue #N unchanged for 48h` | Issue가 48h 방치 | 디자이너 검토 권유 또는 close |
| `Anomalies ⚠️ PR #N unchanged for 48h` | PR 48h 방치 | dev 리뷰 + 머지/close |
| (헬퍼 외) 같은 노드 변경에 대한 Issue가 매 cron마다 새로 누적 | snapshot 비결정성. cs id가 매번 달라서 dedupe 무력. | classify-diff/snapshot 안정성 fix 필요 |
| (헬퍼 외) figma 안 만졌는데 변경 N건이 계속 잡힘 | baseline과 head 사이 환경 차이 (CI vs local Figma API 응답 결정성) | snapshot 결정성 보강 |

### 정상 신호
- cron 12회/일 (24h ÷ 2h) 중 대부분이 변경 0건 → post-run skip → silent
- 가끔 변경 잡히면 Issue 1건 + Slack 알림 1건
- workflow 평균 30-60초
- `Anomalies ✅ none detected`

## 6-8-B. Figma 추적 메커니즘 — 운영자가 알아야 할 것

### 추적 대상은 단 1개 파일
- **fileKey**: `9cevQvPHlQ5vZv5Pz3QaLL` (config/figma.yaml + `FIGMA_FILE_KEY` env override)
- 다른 figma 파일은 무시
- 파일 안에서도 `config/figma-mapping.yaml`에 명시적으로 등록된 노드 ID만 fetch

### 등록 노드 (현재)
| key | nodeId | 추적 의미 |
|---|---|---|
| `figma_appleInspiredDesignSystemGeneratedPreview_2_2` | `2:2` | Codex 이전 preview frame (report-only) |
| `figma_pesseAppleInspired3Screens_7_2` | `7:2` | Pesse 3 screens 래퍼 (report-only) |
| `pesse_home` | `7:3` | Pesse Home (report-only) |
| `pesse_cards` | `7:4` | Pesse Cards (report-only) |
| `pesse_send` | `7:5` | Pesse Send (report-only) — 자손 노드 `10:62`에 `pesse.send.cta` 마커 부착 → **auto-apply 후보** |

`pesse.send.cta` 한 개만 auto-apply (PR 경로). 나머지는 변경 감지 시 report-only Issue.

### 새 프레임 만들면 잡히나
Figma API call이 명시적 노드 ID 리스트에만 들어가므로 **위치에 따라 다름**:

| 새 프레임 위치 | 결과 |
|---|---|
| 위 등록 화면(`2:2` / `7:2` / `7:3` / `7:4` / `7:5`) **안에** | ✅ Task 8 이후 `new-frame` compliance signal + report-only Issue 생성 |
| 같은 figma 파일이지만 등록 안 된 위치 (다른 페이지 / 페이지 루트 옆) | ❌ 무시 |
| 다른 figma 파일 | ❌ 무시 |

**확실히 추적하려면** `config/figma-mapping.yaml`에 entry 추가:
```yaml
my_new_frame:
  figmaNodeId: "X:Y"
  figmaNodeName: ...
  code: ../src/screens/MyNewFrame.tsx   # 또는 추적-only면 FigmaFrameTracking.ts
  targetType: screen
  automation:
    apply: report-only
    allowedClasses: [text, layout, structure]
```
+ 그 코드 파일이 실제 존재해야 `npm run figma:preflight` 통과.

### 새 프레임 감지 빠른 검증
1. Figma 파일 열기 — Pesse Home 화면:
   `https://www.figma.com/design/9cevQvPHlQ5vZv5Pz3QaLL/Untitled?node-id=7-3`
2. 화면 안에 빈 프레임 또는 텍스트 한 줄 추가 (F 또는 T 키)
3. Figma 자동 저장
4. 다음 cron (최대 2h) 또는 채널 핀 링크에서 수동 트리거
5. 노트북에서 `npm run figma:health` — Open issues 1 증가 + Slack 알림

✅ **baseline / schema 상태**: schema-compatible baseline `.automation/baseline/2026-05-21T07-43-40.json`을 2026-05-21 16:44 KST에 시드했다. 다음 scheduled run부터 기존 등록 node도 `detached-style` / `new-frame` / `image-change`가 baseline 이후 증분으로 정상 누적된다. 감지 범위는 등록된 tracked root 내부로 제한된다. 테스트용 프레임은 1-2시간 안에 삭제 후 다시 트리거해 정리한다.

### Auto-apply 트리거 (PR 경로) 직접 시연
1. Figma에서 Pesse Send CTA 노드로 점프:
   `https://www.figma.com/design/9cevQvPHlQ5vZv5Pz3QaLL/Untitled?node-id=10-62`
2. CTA 텍스트 한 단어 변경 (예: "보내기" → "전송하기")
3. Figma 자동 저장
4. 다음 cron 또는 수동 트리거
5. 결과: Draft PR 1건 + `designer-bot`/`auto-apply` 라벨 + Slack 알림. task-3 doc V3.5 갭(`pulls.update` on existing PR)도 자연 발동됨.

원복: figma에서 텍스트 원복 + 만들어진 PR close + 브랜치 삭제.

## 6-8-C. 다음 세션 진입 가이드

```bash
cd /Users/juhee/Work/Test/design-test/uno-home
git pull --ff-only
npm run figma:health
npm run figma:preflight
```

권장 선택:
- **최우선: Actions workflow 권한 fix** — repo Settings → Actions → General에서 `Read and write permissions` + `Allow GitHub Actions to create and approve pull requests`를 켠다.
- **이후: Phase B live 재검증** — #19 또는 신규 `cs-*` 승인 라벨로 marker hit PR 또는 manual-edit fallback PR이 열리고 manifest가 `pr-open`으로 전이되는지 확인한다.
- **이후: Phase C** — visual diff, branch protection, baseline promote, e2e/rollback.
- **task-5** — 2h cron 지연이 실제 운영 병목일 때 끼워넣는다.
- **task-6** — ⏭ SKIPPED. Slack 알림(`notifySlack` webhook) + GitHub 공식 Slack 앱이 이미 디자이너/PM에 도달하고 있어 이메일 채널 불필요.

`Anomalies ⚠️` 가 있으면:
- 즉시 fix → 안정화 → 그 다음 Phase B 재검증 또는 Phase C

### task-5 진입 사전 준비 (관찰 기간 동안 사용자가 준비)
- [ ] Cloudflare 계정 생성 (무료) → workers.cloudflare.com
- [ ] `npm install -g wrangler` + `wrangler login`
- [ ] Figma 파일 페이지에서 webhook passcode 후보 결정 (랜덤 문자열)
- [ ] (선택) GitHub fine-grained PAT 발급 — scope: `Actions:write` for `jhlee9815/uno-home` (Worker가 `repository_dispatch` 호출용)


## 6-9. 현재 handoff / 다음 액션

2026-05-21 23:28 KST 기준:

- task-1/2/3/4/7/8 **완료** ✅. Task 8은 PR #9로 main에 merge됨 (`6d4cd94`).
- Task 10 Phase A **live 완료** ✅: PR #10 merged, GitHub Pages built, viewer URL이 Issue에 붙고, `designer-approved` label이 manifest state transition까지 기록됨.
- Task 10 Phase B **코드 merge 완료 / artifact handoff fix live download 확인 / PR 생성 재검증 대기** 🟠: PR #17/#18로 yml stash isolation, decisionFilter, apply runner, GitHub PR helper, manual-edit fallback이 main에 들어갔다. label workflow가 manifest `runId`로 원본 pipeline artifact를 다운로드하는 것은 run `26212122539`에서 확인됐다.
- Audit auto-register **code merged / generated PR follow-up pending** 🟠: PR #23 merged to main (`bcb7e98`). Live audit run `26232107808` created PR #25; validation dispatch `26232141435` passed, but body/check association needs follow-up.
- Latest evidence:
  - `figma-pipeline` run `26211009015` success
  - Pages run `26211035500` success
  - `designer-approval` run `26211056345` success
  - Issue #19: `cs-2026-05-21T07-07-04`, labels `designer-review`, `report-only`, `designer-approved`
  - Manifest: `.automation/cs/cs-2026-05-21T07-07-04.json` state `designer-approved`, viewer URL recorded
  - Actions permission: `default_workflow_permissions=read`, `can_approve_pull_request_reviews=false`
  - Baseline: `.automation/baseline/2026-05-21T07-43-40.json` pushed in `614dfc8`
  - Audit auto-register: PR #23 merged (`bcb7e98`), PR #25 open, `figma-audit` runs `26232066749` / `26232107808`, validation dispatch `26232141435` success

### 다음 작업 선택 (2026-05-21 갱신)

전체 목표 (Figma 편집 → diff 감지 → Slack 알림 → 디자이너 확인 → 개발 변경 → 개발자 머지) 가중 진척 ≈ **86%**. 잔여 가치는 PR #25 body/check association 정리와 merge, 그 다음 Phase B PR 생성 재검증 + 단계 5 안전망에 집중.

**권장 순서: PR #25 follow-up/merge → B1 재검증 → C → (필요시) task-5**

1. **Audit auto-register PR #25 follow-up** — 🔴 PR body second name blank + `statusCheckRollup` empty 조사 후 #25 merge. Resume: [`audit-auto-register-handoff-2026-05-21.md`](./audit-auto-register-handoff-2026-05-21.md).
2. **B1-1. Approval workflow 재실행** — ✅ #19 `designer-approved` 라벨 재적용으로 run `26212122539` 실행.
3. **B1-2. Artifact download 확인** — ✅ `Download originating pipeline artifacts`가 `figma-pipeline-26211009015`를 성공적으로 다운로드.
4. **B1-3. Missing artifact 에러 제거 확인** — 🟡 artifact download 후 apply 단계 진입. 이전 missing artifact 에러 대신 PR 권한 에러가 발생.
5. **Actions workflow 권한 수정** — 🔴 repo 현재값 `default_workflow_permissions=read`, `can_approve_pull_request_reviews=false`. Settings → Actions → General에서 `Read and write permissions` + `Allow GitHub Actions to create and approve pull requests`로 변경 필요.
6. **B1-4. PR 생성 확인** — 🟠 권한 수정 후 #19 라벨 재적용. 직전 run은 `GitHub Actions is not permitted to create or approve pull requests`로 실패했고 branch `designer-approved/cs-2026-05-21T07-07-04`만 push됨.
7. **B1-5. Manifest transition 확인** — ⏳ PR 생성 성공 후 `pr-open` 확인 필요.
8. **C. Task 10 Phase C (Stage 5+7)** — visual diff + branch protection + baseline promote + e2e/rollback. 4-6h.
9. **(끼워넣기) task-5 Cloudflare Worker** — 단계 2 (2h cron 대기) 해소. 디자이너가 2h 대기에 답답해할 때 1-2h.
10. ~~**task-6 Resend**~~ — ⏭ SKIPPED (Slack로 충분, 2026-05-21).
11. ~~**Task 9**~~ — Task 10에 흡수됨. label/Slack summary 보강만 필요 시 분리.

검증 증거 (최신):

```bash
# Task 8 implementation branch / PR #9 before merge
for t in diff classify report-only designer-review snapshot api token-css apply-token apply-code apply-report verify-report visual-diff promote-gate marker-candidates; do npm run figma:test:$t; done  # PASS
npm run lint   # PASS
npm run build  # PASS
# Stage 6 real Figma probe: cs-2026-05-21T01-42-28, reportOnly=2, compliance sections present, probeCount=0

# Task 10 live evidence
# PR #10/#16/#17/#18/#23 merged; latest main bcb7e98
# figma-pipeline 26211009015 success; pages 26211035500 success; designer-approval 26211056345 success
# designer-approval 26212122539: artifact download succeeded, apply reached PR creation, blocked by repo Actions PR permission.
# audit auto-register: figma-audit 26232066749 + 26232107808 success; PR #25 open; pr-checks dispatch 26232141435 success.
```

## 6-10. 참고

- 상위 마스터: [`../../plan.md`](../../plan.md)
- 이전 작업 요약: [`../archive/README.md`](../archive/README.md)
- 다음 단계 계획: [`../phase-7/phase-plan-7.md`](../phase-7/phase-plan-7.md)
- Codex 검증 세션: `019e4407-9f23-7190-b963-60fd7ba11d4b` (`.context/codex-session-id`)
