# Phase 6 — Phase A: 이 repo를 실서비스로 (Extraction-Friendly)

> 시작: 2026-05-20
> 목표 완료: 2026-06-03 (2주)
> 최신 갱신: 2026-05-20 20:45 KST — task-4 CODEOWNERS/PR 템플릿/라벨 표준화 완료. 다음 task-5.
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
- [ ] Slack/Discord webhook 알림 + Resend 이메일 동시 발송
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
| 6 | Resend 이메일 통합 | ⏳ | [`task-6-email-resend.md`](./task-6-email-resend.md) | 1시간 | — |
| 7 | `promote-dev.ts` 스모크 키 버그 수정 + env override | ✅ | [`task-7-bugfixes.md`](./task-7-bugfixes.md) | 30분 | 20분 |

**의존성**: 1 → 2 → 3 → 4 (병렬 가능: 5, 6, 7은 2 완료 후 순서 무관)

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

# Slack/Email 수신 확인 — 수동
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


## 6-9. 현재 handoff / 다음 액션

2026-05-20 20:45 KST 기준:

- task-1/2/3/4/7 **완료** ✅. task-3 V1~V4 실검증 + task-4 거버넌스 파일/라벨 표준화 통과.
- 다음 우선순위: **task-5 Cloudflare Worker Figma webhook 프록시**. Cloudflare 계정 + wrangler login 필요.
- 그 뒤: task-6 (Resend 이메일).
- task-5와 함께 처리할 부수 항목: (a) branch protection rule `require_code_owner_reviews:true` 활성화, (b) `/slack` 엔드포인트로 GitHub workflow trigger 가능하게 (사용자 옵션 — 현 단계는 Slack 공식 GitHub 앱으로 대체 가능).

검증 증거 (최신 — uncommitted 상태 그대로):

```bash
npm run build        # PASS (vite 149ms)
npm run lint         # PASS
npm run figma:preflight  # PASS (5/5 bindings)
npx tsc --noEmit     # PASS
DRY_RUN=1 GITHUB_REPOSITORY=jhlee9815/uno-home GITHUB_TOKEN=dummy npx tsx scripts/pipeline/post-run-actions.ts cs-2026-05-20T05-48-54  # PASS (auto-apply=0, report-only=4)
# 실검증 (worktree 격리, 토큰 env-only)
GITHUB_TOKEN=<keychain> GITHUB_REPOSITORY=jhlee9815/uno-home npx tsx scripts/pipeline/post-run-actions.ts cs-2026-05-20T05-48-54   # V1 → Issue #1
# 동일 명령 재실행 → V2 dedupe
# 격리 worktree + fixture + dirty file → V3 → PR #2
# 동일 명령 재실행 → V4 no-op skip
```

검증 후 Issue #1 closed (`[verified]` prefix), PR #2 closed, 원격 브랜치 `designer-bot/cs-fixture-2026-05-20T11-15` deleted. main repo dirty 상태는 V3 전과 동일.

## 6-10. 참고

- 상위 마스터: [`../../plan.md`](../../plan.md)
- 이전 작업 요약: [`../archive/README.md`](../archive/README.md)
- 다음 단계 계획: [`../phase-7/phase-plan-7.md`](../phase-7/phase-plan-7.md)
- Codex 검증 세션: `019e4407-9f23-7190-b963-60fd7ba11d4b` (`.context/codex-session-id`)
