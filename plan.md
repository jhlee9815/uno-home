# UNO HOME × Apple-inspired Design System 실험 계획

> 작성일: 2026-05-20
> 최신 갱신: 2026-05-25 22:30 KST (검출 결손 3종 해소: PR #131 신규 frame compliance + PR #132 audit→slack live. 다음: Phase 2 PR-B 슬랙 본문 강화.)
> 프로젝트 위치: `/Users/juhee/Work/Test/design-test/uno-home`
> 외부 디자인 시스템 입력: `/Users/juhee/Work/Test/awesome-design-md/design-md/apple`

## 0. 한눈에 보는 현 상태

| 트랙 | 상태 | 위치 |
|---|:-:|---|
| Phase 1~5 (Apple DS 메인 트랙) | ✅ 완료 | `project-plan/archive/` |
| 보완 작업 (Claude–Codex 합의) | ✅ 완료 (5/5) | `project-plan/archive/supplementary-2026-05-20/` |
| Pesse 라이브 데모 트랙 | ✅ 완료 (7/7 + 확장 3건) | `project-plan/archive/pesse-demo/` |
| **데모 검증 사이클** | **✅ 완료 (2026-05-20)** | `.automation/demo-compare/` |
| **Phase 6 — Phase A 실서비스화** | **🚧 검출 시스템 완성, UX 강화 단계** | `project-plan/phase-6/` |
| **Phase 7 — Phase B 재사용 추출** | **⏳ Phase 6 종료 후** | `project-plan/phase-7/` |

**검출 시스템 완성도 (2026-05-25)**:
- ✅ pipeline delta: text / component-props / token / layout / structure
- ✅ pipeline compliance delta: detached-style / new-frame / image-change (등록 frame 내부)
- ✅ **신규 frame 첫 cycle compliance**: PR #131로 `!beforeNode` 분기 보강
- ✅ audit absolute count: detached-style 절대량 + top violator (figma-audit daily)
- ✅ **audit absolute slack 알림**: PR #132 (매일 09:00 KST)
- ✅ designer-approval workflow: manifest 전이 + baseline-promote production + PR auto-merge

**현재 액션**: Phase 2 (PR-B) — `post-run-actions.ts buildLocalizedSummary()`에 raw class 라인 추가 + 영향 화면 top-3 + cap 정책. 본문이 viewer 없이도 80% 이해 가능한 수준으로.
**보류 항목**: 다른 팀 공유는 Phase 7 완료 전까지 금지 (Codex 권고).

---

## 1. 프로젝트 목표 (장기)

1. ✅ Markdown 디자인 시스템(`DESIGN.md`)을 토큰/컴포넌트 규칙으로 코드화 가능한가?
2. ✅ 정리된 외부 DS를 기존 React/Vite 프로젝트의 토큰/컴포넌트에 안전 연결 가능한가?
3. ✅ Figma `snapshot → diff → classify → report` 파이프라인과 충돌 없이 "개발 전달 체크리스트" 생성 가능한가?
4. ✅ 발표에서 과장 없이 "변경 감지/분류/전달 자동화 실험"으로 설명 가능한가?
5. ⏳ **(신규)** 이 파이프라인을 24/7 동작하는 GitHub Actions 서비스로 만들 수 있는가? **→ Phase 6**
6. ⏳ **(신규)** 다른 팀이 fork해서 자기 프로젝트에 적용 가능한 재사용 도구로 추출 가능한가? **→ Phase 7**

목표 1~4는 archive 트랙에서 완료. 5~6은 Codex 검증 후 신규 채택.

---

## 2. 핵심 원칙 (현재까지)

- **교체가 아니라 분리 실험**: 기존 UNO 자동화는 백업 보존.
- **Apple DS는 비공식 Apple DS**: "Apple-inspired only · Not affiliated" 디스클레이머 유지.
- **작은 end-to-end 우선**: 대표 단위 2~3개로 검증.
- **report-only는 안전장치**: 자동 불가 항목은 사람 검토 체크리스트로.
- **(신규)** **다른 팀 공유 전 검증 필수**: Phase 6 완료 + 2주 안정 운영 후 Phase 7. Codex 권고.

---

## 3. 단계 인덱스 (메인 로드맵)

| 단계 | 위치 | 상태 |
|---|---|:-:|
| Phase 1~5 (Apple-inspired DS) | [`project-plan/archive/`](./project-plan/archive/README.md) | ✅ |
| Phase 6 — 이 repo 실서비스화 (extraction-friendly) | [`project-plan/phase-6/`](./project-plan/phase-6/phase-plan-6.md) | 🚧 |
| Phase 7 — 재사용 GitHub 템플릿 + CLI 추출 | [`project-plan/phase-7/`](./project-plan/phase-7/phase-plan-7.md) | ⏳ 대기 (`plan-7.md` quick handoff 추가) |

---

## 4. Phase 6 작업 인덱스 (지금 진행할 것)

| # | 작업 | 상태 | 세부 |
|:-:|---|:-:|---|
| 1 | GitHub Remote init + 초기 push | ✅ | [`task-1-github-init.md`](./project-plan/phase-6/task-1-github-init.md) |
| 2 | `.github/workflows/figma-pipeline.yml` 작성 | ✅ | [`task-2-actions-workflow.md`](./project-plan/phase-6/task-2-actions-workflow.md) |
| 3 | `post-run-actions.ts` 라우팅 스크립트 (PR/Issue/Slack) | ✅ V1~V4 실검증 통과 (V5 task-4 이후) | [`task-3-post-run-actions.md`](./project-plan/phase-6/task-3-post-run-actions.md) |
| 4 | CODEOWNERS + PR/Issue 거버넌스 | ✅ (branch protection은 task-5 후) | [`task-4-codeowners-governance.md`](./project-plan/phase-6/task-4-codeowners-governance.md) |
| 5 | Cloudflare Worker Figma webhook 프록시 | 🔵 옵션 (adopter용, repo 운영자는 미사용) | [`task-5-webhook-proxy.md`](./project-plan/phase-6/task-5-webhook-proxy.md) |
| 6 | Resend 이메일 통합 | ⏭ SKIPPED (Slack로 대체, 2026-05-21) | [`task-6-email-resend.md`](./project-plan/phase-6/task-6-email-resend.md) |
| 7 | Codex 발견 버그 수정 + env var 추출 + Node 24 강제 | ✅ | [`task-7-bugfixes.md`](./project-plan/phase-6/task-7-bugfixes.md) |
| 8 | DS Compliance Detection Core (detached / image / new frames) + audit auto-register | ✅ PR #9 merged (`6d4cd94`), PR #23 merged (`bcb7e98`), PR #25 follow-up 필요 | [`task-8-ds-compliance-detection.md`](./project-plan/phase-6/task-8-ds-compliance-detection.md) |
| 9 | Report UX + Labels (task-8 후속) | ↘ Task 10에 대부분 흡수, label/summary 보강만 선택 | [`task-9-report-ux-labels.md`](./project-plan/phase-6/task-9-report-ux-labels.md) |
| 10 | Designer Review → Auto-Edit → Dev Merge Workflow | 🟠 Phase A live 완료, Phase B artifact download 검증 완료. PR 생성/manifest `pr-open` 재검증 대기. Phase C 미시작. | [`task-10-designer-workflow-design.md`](./project-plan/phase-6/task-10-designer-workflow-design.md) |

현재 task-1/2/3/4/7/8 ✅, task-6 ⏭ SKIPPED, task-5 🔵 adopter 옵션 (운영자 미사용), audit auto-register code ✅. 잔여 핵심은 PR #25 후속 확인/merge → task-10 Phase B PR 생성 재검증 → Phase C.

### 2026-05-20 16:58 KST — Codex 병렬 진행 기록

- Claude는 task-3 도중 토큰 소진으로 중단했다. 남은 uncommitted 변경: `package.json`, `package-lock.json`, `scripts/pipeline/post-run-actions.ts`.
- Codex는 task-3 dry-run 안전성을 보강했고 `cs-2026-05-20T05-48-54`로 외부 호출 없는 dry-run PASS를 확인했다.
- task-7 변경: `promote-dev.ts`, `verify.ts`, `config-loader.ts`, `.github/workflows/figma-pipeline.yml`.
- 검증: `npm run build`, `npm run lint`, `npm run figma:preflight`, env override preflight, `npx tsc --noEmit`, post-run dry-run 모두 PASS.
- `project-plan/phase-7/plan-7.md`는 빠른 진입 문서로 생성했고, 실제 source of truth는 `phase-plan-7.md`로 유지한다.

### 2026-05-20 20:20 KST — task-3 ✅ 실검증 완료

- Claude가 task-3을 이어서 V1~V4 실 GitHub API 검증 완료. Codex 2회 review (`session 019e4514-e802`) 둘 다 PASS.
- V1: Issue `#1` 신규 생성 (report-only 4건, 라벨 `designer-review`+`report-only`).
- V2: 동일 csId 재실행 → `existing open issue found: #1 — updating body` (dedupe).
- V3: 격리 worktree에서 fixture로 Draft PR `#2` 생성 (라벨 `designer-bot`+`auto-apply`).
- V4: 같은 worktree clean 상태로 재실행 → "apply is no-op" skip.
- Cleanup: Issue closed (`[verified]` prefix), PR closed, 원격 브랜치 삭제, worktree 제거. main repo dirty 변경 영향 없음.
- 토큰은 macOS keychain에서 env-only 주입, 파일/로그/커밋 어디에도 노출 없음.
- Not-tested (의도된 갭, task-3 비차단): PR body update on existing PR. task-4 이후 자연 cs 발생 시 재확인.

### 2026-05-20 20:45 KST — task-4 ✅ 거버넌스/라벨 표준화

- 사용자 결정: 단일 owner `jhlee9815` 출발 + Phase 7에서 영역 분리 재검토.
- 새 파일 4개: `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/designer-review.md`, `.github/labels.yml`.
- 라벨 색상/설명 표준화: GitHub API PATCH ×4 (`designer-bot` #ff8c00, `auto-apply` #0e8a16, `designer-review` #1d76db, `report-only` #fbca04). HTTP 200 ×4.
- Branch protection rule(`require_code_owner_reviews:true`) 적용은 task-5 이후로 분리 (외부 webhook 들어올 때 의미).
- Slack 알림: GitHub 공식 Slack 앱 + repo 구독으로 즉시 가능. 수동 트리거는 GitHub Actions UI에서 (공식 앱은 workflow_dispatch 미지원 — 정정). 슬래시 커맨드형 트리거는 Slack Workflow Builder 또는 Cloudflare Worker(task-5) 옵션. 세부: [`project-plan/phase-6/slack-integration.md`](./project-plan/phase-6/slack-integration.md).

### 2026-05-20 21:05 KST — task-3 V5 자연 트리거 통과

- Slack에서 GitHub Actions 페이지 링크 클릭 → "Run workflow" → workflow_dispatch run `26161348247` (47s, success).
- post-run-actions 자동 실행 → cs 변경 4건 감지 → Issue [#3](https://github.com/jhlee9815/uno-home/issues/3) 신규 생성 (`designer-review`, `report-only` 라벨 자동 부착).
- 직전 cron 실행 (10:52, schedule)은 변경 0건이라 post-run skip — 분기도 정상.
- task-3 doc V5 row를 ✅ + evidence로 갱신. Phase 6 task-3/4 + Slack 통합 end-to-end 운영 검증 완료.

### 2026-05-20 21:30 KST — figma:health 헬퍼 + 운영 관찰 모드 진입

- `scripts/pipeline/health-check.ts` + `package.json` `figma:health` 스크립트 추가. `npm run figma:health` 한 줄로 24h workflow 상태 / open Issue·PR / 이상 신호 요약.
- 토큰: env GITHUB_TOKEN → macOS keychain(github.com) fallback. 파일/로그/커밋 어디에도 노출 없음.
- 코덱스 review 2회 사이클(견제: 토큰 module-load 시점 / consecutive-failure 로직) → PASS.
- phase-plan-6 §6-8-A/B/C 보강 — 매일 routine, figma:health 출력 해석, figma 추적 메커니즘 (어떤 파일/노드 잡히고 새 프레임 만들면 어떻게 되는지), 다음 세션 진입 가이드.
- 노트북 꺼도 cron 정상 동작 명시 (GitHub 서버에서 매 2h 자동 실행).
- 현재 모드: **운영 관찰 (~2026-05-23 권장)**. 이상 신호 없으면 task-5 진입. 운영 가이드: [`project-plan/phase-6/phase-plan-6.md`](./project-plan/phase-6/phase-plan-6.md) §6-8-A (매일 routine + figma:health 해석) · §6-8-B (figma 추적 메커니즘) · §6-8-C (다음 세션 진입). Slack 통합 별도: [`slack-integration.md`](./project-plan/phase-6/slack-integration.md).

### 2026-05-20 22:00 KST — task-8/9 설계 확정 (DS Compliance Detection)

- 사용자 요구 3종: ① detached styles (DS 토큰 안 쓰고 raw 색상/타이포로 작업) ② image/icon 교체 ③ 등록 화면 안 새 프레임 추가.
- 코덱스 1차 설계 검증 통과 (GO). 주요 조정: task-8(detection core) + task-9(report UX) 분리 / Stage 0 필수 게이트 / schema contract 단계 추가 / deep traversal extraction / stable key diff / 시간 5-6h→7-9h 보강.
- v1 범위 제한 명시: 등록 화면 밖 새 top-level frame은 별도 task / INSTANCE_SWAP / component path는 v2. 세부: [`task-8-ds-compliance-detection.md`](./project-plan/phase-6/task-8-ds-compliance-detection.md) · [`task-9-report-ux-labels.md`](./project-plan/phase-6/task-9-report-ux-labels.md).

### 활성 GitHub 리소스
- Repo: https://github.com/jhlee9815/uno-home (private)
- Latest successful run: https://github.com/jhlee9815/uno-home/actions/runs/26148882072
- Secrets: `FIGMA_TOKEN`

---

## 5. Phase 7 일정 (미래)

세부는 [`project-plan/phase-7/phase-plan-7.md`](./project-plan/phase-7/phase-plan-7.md).

진입 조건: Phase 6 완료 + 2주 안정 운영 + 디자이너/개발자 1명씩 사이클 경험 + 영역 침범 무발생.

---

## 6. 검증 방법 (단계 종료 공통)

```bash
npm run figma:preflight                              # mapping 정합성
npm run build                                        # vite build PASS
npm run lint                                         # eslint 0 errors
npm run figma:run                                    # 파이프라인 전체
npm run figma:claude-review                          # UNO 트랙 3-band 리포트
npm run figma:claude-review -- --source apple        # Apple 트랙 3-band 리포트
```

Phase 6에서 추가:
```bash
gh workflow run figma-pipeline.yml                   # Actions 수동 트리거
gh run watch                                         # 진행 보기
gh pr list --label designer-bot                      # 자동 PR 확인
gh issue list --label designer-review                # 자동 Issue 확인
```

---

## 7. 산출물 인덱스 (활성)

### 코드 (Phase 1~5 → 활성)
| 종류 | 경로 |
|---|---|
| Apple 토큰 JSON | `design-systems/apple/apple-tokens.json` |
| Apple 토큰 CSS | `design-systems/apple/apple-tokens.css` |
| 토큰 매핑/리스크 | `design-systems/apple/token-mapping.md` |
| Apple Skill | `.claude/skills/apple-design-system/SKILL.md` |
| UNO Skill | `.claude/skills/uno-design-system/SKILL.md` |
| Apple demo | `src/screens/AppleDemoScreen.tsx` + `Button.tsx` + `AppleCard.tsx` |
| Pesse 화면 | `src/screens/Pesse{Home,Cards,Send}Screen.tsx` |
| 파이프라인 코어 | `scripts/pipeline/*.ts` (8 stages + Task 8 compliance diff/classify/report) |
| Wrapper | `scripts/pipeline/claude-review.ts` |
| Post-run 라우팅 | `scripts/pipeline/post-run-actions.ts` (task-3) |
| 운영 모니터링 | `scripts/pipeline/health-check.ts` — `npm run figma:health` |
| Task 10 Phase A | `scripts/pipeline/images-bootstrap.ts`, `viewer-gen.ts`, `designer-approval.ts`, `lib/{cs-manifest,figma-images,viewer-generator,designer-approval}.ts`, `.github/workflows/designer-approval.yml` |
| Task 8 compliance | `scripts/pipeline/lib/compliance-types.ts`, `snapshot-node.ts`, `diff-snapshot.ts`, `classify-diff.ts`, `designer-review.ts`, `scripts/ops/pending-review-viewer.ts` |
| 거버넌스 | `.github/CODEOWNERS`, `.github/labels.yml`, PR/Issue 템플릿 |

### Figma (활성)
| 종류 | 위치 |
|---|---|
| 파일 | `9cevQvPHlQ5vZv5Pz3QaLL` (Pesse Apple Demo) |
| 변수 | 43개 (17 색상 primitives + 17 semantic + 7 radii + 2 폰트) |
| 텍스트 스타일 | 16개 (`apple/display`, `apple/heading/*`, …) |
| Icon 셋 | 28 variants (node `22:129`) |
| 화면 | Home `7:3` · Cards `7:4` · Send `7:5` |
| 활성 마커 | `pesse.send.cta` → node `10:62` |

### 파이프라인 상태 (활성)
| 종류 | 위치 |
|---|---|
| 활성 baseline | `.automation/baseline/2026-05-20T02-09-13.json` (Task 8 이전 schema; compliance diff skip guard 적용) |
| 활성 매핑 | `config/figma-mapping.yaml` (5 entries) |
| UNO 백업 | `.automation/backups/figma-mapping.2026-05-20T02-07-19-249Z.yaml` |
| 데모 비교 페이지 | `.automation/demo-compare/compare.html` |

### 메타 문서
| 종류 | 경로 |
|---|---|
| 이 파일 | `plan.md` |
| Phase 1~5 아카이브 | `project-plan/archive/README.md` |
| Phase 6 계획 | `project-plan/phase-6/phase-plan-6.md` |
| Phase 7 계획 | `project-plan/phase-7/phase-plan-7.md` |
| 다음 세션 진입 가이드 | `TODO.md` |
| 디자이너 핸드오프 | `handoff.md` |
| 운영 가이드 | `README.md` |

---

## 8. 한계 (정직 공개 — 발표/공유 시 반드시 인정)

### Phase 5까지 인정한 5개 (그대로 유효)

1. **자동 적용 범위는 좁다** — token / `figma:text` / `figma:prop` marker가 있는 안전 후보에만. 전체 변경의 ~5%.
2. **Visual diff는 routed screens만** — 등록 frame 중 일부만.
3. **레이아웃/구조 자동 적용은 영구 보류** — 안전상 의도.
4. **Claude 분석은 deterministic encoding** — LLM-augmented 자연어 요약은 후속.
5. **Pesse auto-apply는 CTA 1건만** — 마커 부착된 것만 작동.

### Phase 6/7 진입으로 추가되는 한계 (정직 표기)

6. **재사용 불가** — Phase 6 완료 시점에도 이 repo 전용. "다른 팀이 fork해서 사용"은 Phase 7 완료 전까지 불가능. (Codex consult 2026-05-20 검증)
7. **9가지 차단점 중 5개는 Phase 7에서 해소** — Phase 6는 extraction-friendly 설계로 ①③⑤⑦만 선제 처리, 나머지(②매핑/④마커/⑥viewport/⑧plist/⑨package)는 Phase 7.

---

## 9. Codex Consult 검증 요약 (2026-05-20)

Phase 6/7 진입 전 외부 검증 결과:

- 세션 ID: `019e4407-9f23-7190-b963-60fd7ba11d4b`
- 검증 질문: "GitHub Actions + webhook 계획이 재사용 가능한 서비스/스킬을 만드는가?"
- 결론: **No.** 이 repo의 productization일 뿐, 재사용은 Phase 7 별도 작업 필요.
- 권고: **이 repo 데모를 먼저 완성하라**. "다른 사람도 쓸 수 있다"고 팔지 말 것.
- 부수 발견 (코드 결함): `promote-dev.ts:25-26`의 스모크 키 `home/family`가 현재 활성 Pesse 매핑과 불일치. → [`task-7-bugfixes.md`](./project-plan/phase-6/task-7-bugfixes.md)에서 수정.

---

## 10. 사용자가 직접 할 일 (현 시점)

### 즉시 (Phase 6 시작 전 한 번)
- [x] task-1 GitHub Secrets 등록 (FIGMA_TOKEN)
- [x] CODEOWNERS에 들어갈 GitHub username 결정 — `jhlee9815` 단일 (task-4 완료)
- [ ] Task 10 Phase A 진행 시 GitHub Pages/private Pages 사용 여부 결정
- [ ] Task 10 Phase A 진행 시 `.automation/images/baseline/` PNG git tracking/storage threshold 결정
- [ ] Cloudflare 계정 + wrangler 설치 (task-5 직전)
- [x] Slack webhook URL 생성 — `SLACK_WEBHOOK_URL` secret 등록 완료. notifySlack + GitHub 공식 Slack 앱 둘 다 동작.

### Phase 6 진행 중
- 각 task별 세부 문서 따라 실행
- 완료 시 plan.md "상태" 컬럼 업데이트

### Phase 6 종료 후 (2주 안정 운영)
- 디자이너 1명, 개발자 1명에게 사이클 사용 요청 + 피드백 수집
- 영역 침범 우려 사후 점검
- 검증 통과 시 Phase 7 진입

---

## 11. 다음 액션 우선순위 참고 (Phase 6 외 후순위)

| 우선도 | 작업 | 예상 |
|:-:|---|---|
| Low | `--use-claude` 옵션 실제 구현 (Anthropic SDK) | 1~2h |
| Low | Pesse Home/Cards에도 `figma:text` 마커 추가 | 30분 |
| Low | Pesse 토큰 자동 반영 (Figma variables → `apple-tokens.css`) | 1~2h |
| Low | minimal-test에 동일 wrapper 이식 | 2h |
| Low | (Phase 8 후보) Hosted SaaS 검토 | TBD |


## 2026-05-21 10:50 KST — task-8 구현/검증/merge 완료

- Claude/Codex가 `feature/task-8-ds-compliance`에서 Stage 0-6 구현/검증 완료 후 PR #9를 merge. main: `6d4cd94`.
- 핵심: Figma 자손 트리에서 detached style / descendant frame / imageRef를 수집하고, stable-key diff + classify report-only + cs report compliance sections로 연결.
- 검증: full figma test loop, `npm run lint`, `npm run build`, Stage 6 real Figma probe PASS.
- rollout 보강: 기존 approved baseline이 Task 8 이전 schema일 때 기존 node compliance diff를 skip해 false-positive flood 방지.
- 상세 결과: [`project-plan/phase-6/task-8-ds-compliance-detection.md`](./project-plan/phase-6/task-8-ds-compliance-detection.md) §8-13.
- 후속: Task 10 Phase A는 완료, Phase B artifact download는 검증 완료. audit auto-register PR #23도 main에 merge됨. 다음 권장은 PR #25 body/check follow-up 후 merge. 운영 지연 단축이 우선이면 이후 task-5.
