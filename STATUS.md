# 운영 상태 (Operations Status)

> 최신 갱신: 2026-05-27
> 이 문서는 옛 `plan.md` + `TODO.md` + `handoff.md` 3개 파일을 통합한 **현재 운영 상태의 단일 source of truth**입니다. 옛 파일들은 정리 세션(이 커밋 직전 PR)에서 삭제됐고, 히스토리는 `git log -- plan.md` 등으로 조회 가능합니다.

---

## 1. 한 줄 요약

`design-review-bot` (구 `uno-home`)은 Figma → 코드 디자인 변경을 자동 감지/분류/알림하는 GitHub Actions 봇입니다. **Phase 6 (이 repo 실서비스화)는 100% 완료** — 검출 시스템 + UX + 운영 정리 모두 라이브. Phase 7 (다른 팀 fork 가능 도구로 추출)는 미시작.

## 2. 현재 상태 매트릭스

### 워크플로 / 컴포넌트

| 컴포넌트 | 상태 | 비고 |
|---|:-:|---|
| `figma-audit.yml` (daily 09:00 KST) | ✅ live | 절대량 + 새 화면 후보 + audit Issue + Slack |
| `figma-pipeline.yml` (2시간 cron + cascade) | ✅ live | snapshot/diff/classify + cs report + viewer + Slack |
| `designer-approval.yml` (label 트리거) | ✅ live | designer-approved label 시 baseline-promote + manifest PR |
| `pr-checks.yml` | ✅ live | validate (build/lint/test) |
| Auto-register PR (2-sighting) | ✅ live | 새 top-level frame이 2회 감지되면 자동 mapping PR |
| Baseline-promote production | ✅ live | 디자이너 승인 시 baseline 자동 갱신 + auto-merge |
| Slack 통합 알림 (figma-pipeline) | ✅ live | PR-B 포맷 (raw class 라인 + 영향 화면 top-3 + cap) |
| Slack daily audit 알림 | ✅ live | 절대량 + top-5 위반 + 추세 (▲N vs 직전 audit) |
| audit Issue dedup | ✅ live | 카운트 동일 시 heartbeat comment, 다르면 새 Issue |

### Phase 진척

```
Phase 1-5 (Apple DS / 검출 인프라):  ████████████████████  100%  (archive)
Phase 6 (실서비스화):                ████████████████████  100%
Phase 7 (다른 팀 추출):              ░░░░░░░░░░░░░░░░░░░░    0%  (미시작)
```

Phase 7 진입 조건 (Codex 권고):
- [x] Phase 6 종료
- [ ] 2주 안정 운영 (2026-06-09 까지)
- [ ] 디자이너 1명·개발자 1명이 사이클 1회 이상 경험
- [ ] 영역 침범(자동 PR이 사람 코드 덮어쓰기 등) 무발생 확인

## 3. 활성 리소스

### GitHub

| 항목 | 값 |
|---|---|
| Repo | `jhlee9815/design-review-bot` (private) |
| Default branch | `main` |
| 활성 GitHub App | `designer-bot` (자동 PR 생성용) |
| Required secrets | `FIGMA_TOKEN`, `AUDIT_APP_ID`, `AUDIT_APP_PRIVATE_KEY`, `SLACK_WEBHOOK_URL` |
| Required variables | `FIGMA_FILE_KEY`, `FIGMA_CONFIG_DIR` (선택) |
| Pages source | GitHub Actions (designer review viewer) |

### Figma

| 항목 | 값 |
|---|---|
| 파일 | `9cevQvPHlQ5vZv5Pz3QaLL` (Pesse Apple Demo) |
| 매핑 | `config/figma-mapping.yaml` (8 entries, DS preview 2:2 / 79:306 제외) |
| 활성 baseline | `.automation/baseline/2026-05-25T12-15-21.json` (PR #130 promote) |

### 운영 정리 (이번 세션)

| PR | 내용 | 머지 |
|---|---|:-:|
| [#135](https://github.com/jhlee9815/design-review-bot/pull/135) | PR-B Slack 본문 강화 (raw class + top-3 + cap) | ✅ |
| [#136](https://github.com/jhlee9815/design-review-bot/pull/136) | README 보강 (workflow 차이, PR-B 포맷, Phase 7 한계, 트러블슈팅) | ✅ |
| [#137](https://github.com/jhlee9815/design-review-bot/pull/137) | baseline prune (구 schema 4개 ~7.3MB) | ✅ |
| [#138](https://github.com/jhlee9815/design-review-bot/pull/138) | audit Issue dedup (카운트 동일 시 reuse) | ✅ |
| [#139](https://github.com/jhlee9815/design-review-bot/pull/139) | audit trend (▲N vs 직전 audit) | ✅ |
| [#140](https://github.com/jhlee9815/design-review-bot/pull/140) | task-5 webhook을 adopter 옵션으로 표기 | ✅ |
| stale PR 정리 | #20, #40, #64, #71, #129 close + 원격 branch 삭제 | ✅ |

### viewer/알림 정보량 강화 (2026-05-27)

디자이너+개발자가 viewer/Slack만 보고 변경 detail을 파악할 수 있도록 표현 layer를 확장. snapshot/diff schema 변경 없이 기존 데이터(`DiffChange.texts[]`, `compliance.newDetachedStyles[]` 등)를 풀어준 작업.

| PR | 내용 | 머지 |
|---|---|:-:|
| [#168](https://github.com/jhlee9815/design-review-bot/pull/168) | viewer 텍스트 leaf diff (`"$25M" → "$23M"`) + baseline 이미지 갭 자동 fill (auto-register fetch + promote 복사) + 친절한 placeholder | ✅ |
| [#172](https://github.com/jhlee9815/design-review-bot/pull/172) | viewer "준수 위반 상세" 블록 — detached color swatch+hex, typography raw 값, new frame, image change 각각 nodePath + Figma 딥링크 row. `<details>` collapsed, 총 violation ≤ 3이면 auto-open | ✅ |

## 4. 디자이너 워크플로 (5단계)

```
Figma 편집 → 스케쥴 diff → Slack 알림 + 디자이너 검토 → 개발 변경 → 개발자 머지
```

| # | 단계 | 누가 | 도구 |
|:-:|---|---|---|
| 1 | Figma 편집 | 디자이너 | Figma |
| 2 | 스케쥴 diff (2h cron) | 자동 | `figma-pipeline.yml` |
| 3 | Slack 알림 + 검토 | 자동 + 디자이너 | Slack 채널 + GitHub Pages viewer |
| 4 | 개발 코드 반영 | designer-bot App 또는 디자이너 수동 | auto-apply Draft PR / manual edit |
| 5 | 개발자 머지 | 개발자 (또는 auto-merge) | GitHub |

자세한 적용 가이드는 [`README.md`](./README.md) §"빠르게 보는 결과" + §"자기 프로젝트에 설치하기".

## 5. 다음 권장 작업 (우선순위)

| 우선도 | 작업 | 예상 | 비고 |
|:-:|---|---|---|
| 🟢 LOW | 운영 관찰 (~2주) | passive | Codex 권고 Phase 7 진입 조건. viewer/Slack 정보량 강화 (#168/#172/현재 PR) 후 실제 사용자 피드백 누적 중 |
| 🟡 MED | viewer 이미지 thumbnail (leaf paint별 before/after) | 2-3h | Codex consult에서 PR2로 deferred. 디자이너가 가장 원할 다음 단계 |
| 🟡 MED | 사용자 정리: 옛 phase1-7 / project-plan/archive 등 미사용 문서 삭제 | 1h | 다음 세션 검토 |
| 🟡 MED | 스킬 경로 수정 (`apple-design-system/SKILL.md:31` 등 stale path) | 30분 | 정리 시 함께 |
| 🔵 OPT | Phase 7 진입 — 다른 팀 fork 가능 도구로 추출 | 1주+ | 2주 관찰 후 |
| 🔵 OPT | task-5 Cloudflare Worker webhook | 1-2h | 운영자 미사용, adopter 옵션 |
| 🔵 OPT | PR-C: structure schema 확장 (subKind 필드) | 2-3h | 사용자 가치 zero, deferred |

## 6. 운영 체크 명령어

```bash
# 헬스 체크 (24h 워크플로 상태, open Issue/PR, 이상 신호)
npm run figma:health

# 매핑 정합성
npm run figma:preflight

# 파이프라인 수동 실행
gh workflow run figma-pipeline.yml
gh workflow run figma-audit.yml
gh run watch

# 오픈 자원 확인
gh pr list --label designer-bot
gh issue list --label designer-review
gh issue list --label audit
```

자세한 트러블슈팅은 [`README.md`](./README.md) §"트러블슈팅".

## 7. 한계 / 다른 프로젝트 적용 시 주의

Phase 6 시점의 9가지 차단점 중 4개는 해소(env override), 나머지 5개(②mapping ④마커 ⑥viewport ⑧plist ⑨package)는 Phase 7 작업 범위.

전체 한계 + 한계 풀이 + adopter 시나리오 표는 [`README.md`](./README.md) §"어디까지 가능한가" + §"다른 프로젝트에 적용할 때의 한계 (Phase 7 미해결 차단점)".

## 8. 산출물 인덱스 (활성)

### 코드

| 종류 | 경로 |
|---|---|
| 파이프라인 코어 | `scripts/pipeline/*.ts` (8 stages + Task 8 compliance) |
| Slack 본문 formatter | `scripts/pipeline/lib/slack-summary.ts` (PR-B) |
| Audit Issue decision | `scripts/pipeline/lib/audit-issue-decision.ts` (PR #138) |
| Audit trend formatter | `scripts/pipeline/lib/audit-slack.ts` `formatTrendLine` (PR #139) |
| Audit state (sighting + trend) | `scripts/pipeline/lib/audit-state.ts` |
| Post-run 라우팅 (PR + Issue + Slack) | `scripts/pipeline/post-run-actions.ts` |
| Audit Issue CLI | `scripts/pipeline/audit-issue.ts` |
| Audit Slack notify | `scripts/pipeline/audit-notify.ts` |
| Health check | `scripts/pipeline/health-check.ts` (`npm run figma:health`) |

### Figma / 매핑 / state

| 종류 | 경로 |
|---|---|
| 매핑 | `config/figma-mapping.yaml` |
| 활성 baseline | `.automation/baseline/2026-05-25T12-15-21.json` |
| Audit state | `.automation/audit-state.json` (GitHub Actions cache) |
| Auto-register candidates | `.automation/audit-candidates.json` |
| cs manifests | `.automation/cs/*.json` (git-tracked) |

### 워크플로

| 종류 | 경로 |
|---|---|
| Audit daily | `.github/workflows/figma-audit.yml` |
| Pipeline 2h cron + cascade | `.github/workflows/figma-pipeline.yml` |
| Designer approval label trigger | `.github/workflows/designer-approval.yml` |
| PR checks | `.github/workflows/pr-checks.yml` |
| Pages publish | `.github/workflows/pages.yml` |

### 메타 문서

| 종류 | 경로 |
|---|---|
| 사용/설치 가이드 | [`README.md`](./README.md) |
| 운영 상태 (이 문서) | `STATUS.md` |
| DS 스펙 | [`design-system.md`](./design-system.md) |
| Token 데이터 | `tokens.json` |
| Adopter용 webhook 설계 | [`project-plan/phase-6/task-5-webhook-proxy.md`](./project-plan/phase-6/task-5-webhook-proxy.md) |
| Phase 7 (미래) | [`project-plan/phase-7/phase-plan-7.md`](./project-plan/phase-7/phase-plan-7.md) |

## 9. 히스토리 / 옛 문서

옛 구현 기록 70+ 개 파일은 정리 세션에서 삭제됐습니다. 필요시 git log로 복구 가능:

```bash
git log --diff-filter=D --summary -- "plan.md"
git log --all --oneline -- phase1 phase2 phase3 phase4 phase5
```

git에 남아있는 메타 문서:
- `STATUS.md` (이 문서) — 운영 상태
- `README.md` — 사용/설치 가이드
- `design-system.md` — DS 스펙 (uno SKILL 참조)
- `phase6/phase6-2.md` — token sync 매핑 (uno SKILL + src/index.css 참조)
- `phase7/{phase7,phase7-1,phase7-2}.md` — 컴포넌트 사양 (uno SKILL 참조)
- `project-plan/archive/phase-2/{apple-tokens.json, source-summary.md}` — apple SKILL 참조
- `project-plan/phase-6/task-5-webhook-proxy.md` — adopter용 webhook 레시피 (README 참조)
- `project-plan/phase-7/phase-plan-7.md` — 미래 Phase 7 설계 문서
- `design-systems/apple/{checklist-example,source-index,token-mapping}.md` — Apple DS 참고
