# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-21 13:45 KST (Task 10 Phase A 코드 100% + race patch + task-6 SKIPPED. 다음: PR #10 merge → 라이브 검증 → Phase B)

---

## 0. 현재 상태 (30초 요약)

전체 목표 `Figma 편집 → diff (텍스트/속성 + 새 프레임 + DS 미반영 감지) → Slack 알림 → 디자이너 확인 → 개발 변경 → 개발자 머지`의 5단계 진척:

| # | 단계 | 진척 | 비고 |
|:-:|---|:-:|---|
| 1 | Figma 편집 | 100% | 도구 외부 |
| 2 | 스케쥴 diff | 95% | cron 2h 동작. 감지 범위: (a) 텍스트/속성 변경 (b) 새 프레임 추가 (`new-frame`) (c) DS 미반영 — 타이포/색상 토큰 해제 (`detached-style`) (d) 이미지 변경 (`image-change`). task-8 ✅. task-5 webhook은 optional. |
| 3 | Slack 알림 + 디자이너 확인 | 70% | 알림 ✅, viewer/라벨 코드 ✅ (PR #10), Pages 미활성, 라이브 검증 0/3 |
| 4 | 개발 코드 변경 | 30% | Tier 1 marker patch만 자동. Phase B 필요 |
| 5 | 개발자 머지 | 50% | PR 생성 + 기본 CI 동작. Phase C 안전망 필요 |

**가중 진척 ≈ 65%.** 가장 큰 잔여 가치: 단계 3 마무리 + 단계 4 자동화 확장.

### 단계 2 감지 매트릭스 (task-8 구현, report-only 정책)

| 감지 종류 | class | 트리거 | 자동 patch | 디자이너 검토 필요 |
|---|---|---|---|---|
| 텍스트 변경 (marker 있음) | `text-change` | 매핑된 텍스트 노드 변경 | ✅ Tier 1 marker patch | (auto-apply) |
| 속성/스타일 변경 (매핑 외) | (다양) | 매핑 외 속성 변경 | ❌ | ✅ Issue |
| **새 프레임 추가** | `new-frame` | snapshot에 없던 frame 노드 추가 | ❌ | ✅ Issue |
| **DS 토큰 미반영 (타이포/색상)** | `detached-style` | Figma 변수/스타일 해제 (로컬 hex/font) | ❌ | ✅ Issue |
| 이미지 변경 | `image-change` | image fill의 ref hash 변경 | ❌ | ✅ Issue |

- **현재 브랜치**: `feature/task-10-phase-a`. PR #10 OPEN.
- **uncommitted (6 파일)**: race patch (2 workflow) + task-6 SKIPPED 정리 (4 파일).
- **다음 권장**: **PR #10 commit/push → Pages 활성화 → merge → 라이브 검증 → Phase B 진입**.
- **세부 권장 순서**: A (Phase A 마무리) → B (Phase B 자동화 확장) → C (Phase C 안전망) → (optional) task-5.

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

Task 8 code merge 직후 local 검증(`npm run lint`, `npm run build`)은 PASS. 문서만 수정한 세션에서는 최소 `git diff --check`를 추가로 확인한다.

---

## 2. 우선순위 1 — Phase A merge + 라이브 검증 (단계 3 완성)

코드는 PR #10에 100% 들어가 있음. uncommitted 6 파일은 race patch + task-6 SKIPPED 정리. 남은 일은 commit/push + 사용자 액션 + 라이브 검증.

### 2-A. 사용자 액션 (merge 전)
- [ ] **GitHub Pages 활성화** — repo Settings → Pages → Source `gh-pages`. private repo는 Pro/Team 플랜 필요. 안 되면 viewer publish step 실패 → fallback (Actions artifact zip) 결정.
- [ ] (선택) Slack Workflow Builder 셋업 — 채널에서 1클릭으로 figma-pipeline 수동 트리거. 알림은 이미 동작 중이라 optional.

### 2-B. commit + push + merge
- [ ] uncommitted 6 파일 commit (race patch + task-6 SKIPPED)
- [ ] push to `feature/task-10-phase-a`
- [ ] PR #10 review 확인 (Codex가 2차 SAFE_TO_MERGE 판정함) → merge

### 2-C. merge 후 라이브 검증 (3건)
- [ ] `npm run figma:images:bootstrap`를 실제 Figma 토큰 환경에서 1회 실행 → baseline PNG seed
- [ ] 첫 cron run에서 `dist-viewer/` gh-pages publish 성공 확인
- [ ] 디자이너가 Issue에 `designer-approved` 또는 `designer-rejected` 라벨 부착 → `designer-approval.yml` workflow가 manifest transition 수행 확인

세부 설계: [`project-plan/phase-6/task-10-designer-workflow-design.md`](./project-plan/phase-6/task-10-designer-workflow-design.md).

---

## 2-9. 우선순위 2 — Task 10 Phase B (단계 4 자동화 확장)

진입 조건: Phase A 라이브 검증 완료 + 운영 1-2주 안정 + Figma에 marker 충분히 추가됨.

### 목표
- Tier 1 marker-based text patch (기존, 변화 없음)
- **Tier 2 신규**: AST-driven component-props patch — code-adjacent marker 기반 (`// figma-prop: pesse_send.Variant -> variant` 주석 위 JSX attribute 자동 patch). ts-morph 의존성 추가.
- **Tier 3 fallback**: Tier 1/2 모두 실패 → PR description에 "수동 편집 필요" + 변경 사항 요약 + viewer URL 명시 (PR은 여전히 생성).

예상 3-4h. 세부: task-10-designer-workflow-design.md §10-6.

---

## 3. 우선순위 3 — Task 10 Phase C (단계 5 안전망)

진입 조건: Phase B 동작 확인 후.

### 목표
- visual diff (Playwright pixel diff) — 변경 화면 실제 렌더 vs baseline image
- branch protection rule — CODEOWNERS review + visual-diff CI 강제
- post-merge baseline auto-promote — PR에 baseline 갱신 commit 포함 (방법 A 권장)
- e2e fixture test + 롤백 시나리오 문서화

예상 4-6h. 세부: task-10-designer-workflow-design.md §10-7, §10-9.

---

## 4. 끼워넣기 옵션 — Task 5 Cloudflare Worker (단계 2 즉시 트리거)

디자이너가 "Figma 편집 후 2시간 기다리는 문제"에 답답해할 때 1-2h로 추가.

- 필요: Cloudflare 계정, `wrangler` CLI, GitHub fine-grained PAT 또는 repository dispatch 권한, Figma webhook passcode/signature 검증.
- 목표: Figma 편집 → Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → `figma-pipeline.yml` 즉시 실행.
- 부수 옵션: 같은 Worker에 `/slack` 엔드포인트 추가하면 Slack slash command 트리거 가능 (Slack Workflow Builder 대체).
- Task 5 후 branch protection rule `require_code_owner_reviews: true` 활성화.

문서: [`project-plan/phase-6/task-5-webhook-proxy.md`](./project-plan/phase-6/task-5-webhook-proxy.md), [`project-plan/phase-6/slack-integration.md`](./project-plan/phase-6/slack-integration.md).

---

## 3-1. ~~우선순위 3 — Task 6 Resend 이메일~~ ⏭ SKIPPED

- Slack 알림 두 채널 (notifySlack webhook + GitHub 공식 Slack 앱)이 디자이너/PM에 도달하고 있어 이메일 채널 불필요.
- 코드 정리: `post-run-actions.ts`의 RESEND placeholder 제거 + `figma-pipeline.yml`의 RESEND env 3줄 제거 (2026-05-21).
- 미래에 이메일이 필요해지면 [`task-6-email-resend.md`](./project-plan/phase-6/task-6-email-resend.md) 설계 그대로 부활 가능.

---

## 4. task-3 완료 기록 (2026-05-20 20:20 KST)

V1~V4 실검증 PASS. 세부는 [`project-plan/phase-6/task-3-post-run-actions.md`](./project-plan/phase-6/task-3-post-run-actions.md) "검증 결과" 섹션. 코덱스 review session: `019e4514-e802`.

증거: Issue [#1](https://github.com/jhlee9815/uno-home/issues/1) (closed, `[verified]` prefix), PR [#2](https://github.com/jhlee9815/uno-home/pull/2) (closed). 원격 브랜치 `designer-bot/cs-fixture-2026-05-20T11-15` 삭제 완료. 3개 commit (bfc478e, d175c35, 8697e58) push 완료.

Not-tested 갭: PR body update on existing PR — task-5 이후 자연 cs 발생 시 확인.

### task-4 (2026-05-20 20:45 KST)

`.github/CODEOWNERS` 단일 owner `jhlee9815` + Phase 7 영역 분리 TODO. PR/Issue 템플릿, `labels.yml` 추가. task-3 자동 생성 라벨 4개 색상/설명 표준화 (PATCH ×4). branch protection rule은 task-5 이후 분리.

---

## 5. task-7 완료 기록

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

## 6. 참고 문서 인덱스

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


## 7. Task 8 완료 기록 (2026-05-21 10:50 KST)

- PR #9 merged to `main` (`6d4cd94`).
- 구현: snapshot deep traversal compliance 수집, stable-key diff, classify report-only policy, cs report compliance sections, pending local viewer.
- 검증: full figma test loop, `npm run lint`, `npm run build`, Stage 6 real Figma probe PASS.
- rollout 보강: old-schema baseline compliance diff skip guard.
- 상세: [project-plan/phase-6/task-8-ds-compliance-detection.md](./project-plan/phase-6/task-8-ds-compliance-detection.md) §8-13.
- 다음: Task 10 Phase A 권장. 운영 지연 해소가 우선이면 Task 5.
