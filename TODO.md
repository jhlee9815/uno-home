# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-21 10:50 KST (Task 8 DS Compliance Detection ✅ PR #9 merge 완료, 다음 권장: Task 10 Phase A)

---

## 0. 현재 상태 (30초 요약)

- **현재 단계**: Phase 6 — Pesse Figma 자동 반영 파이프라인을 GitHub Actions 실서비스 형태로 운영화 중.
- **GitHub**: private repo `jhlee9815/uno-home`, `main...origin/main`, 최신 main `6d4cd94` (`Detect Figma compliance drift before auto-apply`). PR #9 merged.
- **완료**: Phase 1~5 archive, Pesse 데모 검증, Phase 6 task-1/2/3/4/7/8 ✅.
- **Task 8 완료 내용**: Figma 자손 트리에서 DS compliance signal(`detached-style`, `new-frame`, `image-change`)을 수집·diff·classify·report에 연결. 모두 `report-only`이며 자동 patch 없음.
- **Task 8 실환경 검증**: Figma file `9cevQvPHlQ5vZv5Pz3QaLL`, tracked screen `pesse_home` (`7:3`)에 임시 probe 생성 → `cs-2026-05-21T01-42-28`에서 3종 감지 → apply noop → verify build/lint PASS → probe 삭제 확인(`probeCount: 0`).
- **rollout 보강**: Task 8 이전 old-schema baseline에는 compliance 배열이 없으므로 기존 node의 compliance diff는 skip해 첫 운영 run flood를 방지. 신규 tracked node는 head compliance를 정상 보고.
- **다음 권장**: **Task 10 Phase A** — hosted before/after viewer + designer-approved/rejected label workflow + immutable cs manifest. 디자이너가 Slack/Issue에서 실제 변경을 1-click로 판단할 수 있게 만드는 작업.
- **대안 우선순위**: 운영 지연(2h cron)이 가장 불편하면 **Task 5 Cloudflare Worker**를 먼저 진행. **Task 6 Resend**는 Slack 알림이 충분하므로 후순위.

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

## 2. 우선순위 1 — Task 10 Phase A (디자이너 리뷰 워크플로우)

Task 8로 “무엇이 어긋났는지”는 구조화됐다. 다음 병목은 디자이너가 Issue/Markdown/Figma를 오가며 수동 판단해야 한다는 점이다.

### 목표
- baseline/snapshot 이미지를 저장해 before/after를 보여준다.
- `cs-{id}` viewer HTML을 생성하고 GitHub Pages(또는 대체 호스팅)에 올린다.
- GitHub Issue 라벨 `designer-approved` / `designer-rejected`로 디자이너 결정을 기록한다.
- `.automation/cs/{id}.json` manifest를 git-tracked로 남겨 label/workflow/artifact 상태를 재현 가능하게 만든다.

세부 설계/구현 기록: [`project-plan/phase-6/task-10-designer-workflow-design.md`](./project-plan/phase-6/task-10-designer-workflow-design.md).

현재 구현 브랜치: `feature/task-10-phase-a`. 1차 구현 산출물은 `figma:images:bootstrap`, `figma:viewer:generate`, `.automation/cs/{id}.json`, `designer-approval.yml`, pipeline viewer publish + manifest persist step.

### Phase A 시작 전 확인
- `FIGMA_VIEWER_BASE_URL`를 repo variable로 둘지 확인. 미설정 시 workflow는 `https://{owner}.github.io/{repo}` 기본값 사용.
- `npm run figma:images:bootstrap`를 실제 Figma 토큰 환경에서 1회 실행해 baseline PNG를 seed.
- PR merge 후 GitHub Pages publish + `.automation/cs/{id}.json` manifest commit/push + `designer-approved` / `designer-rejected` label event를 Actions에서 확인.

---

## 3. 우선순위 2 — Task 5 Cloudflare Worker (Figma webhook 프록시)

Task 10보다 “Figma 편집 후 2시간 기다리는 문제”가 더 크면 Task 5를 먼저 한다.

- 필요: Cloudflare 계정, `wrangler` CLI, GitHub fine-grained PAT 또는 repository dispatch 권한, Figma webhook passcode/signature 검증.
- 목표: Figma 편집 → Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → `figma-pipeline.yml` 즉시 실행.
- 부수 옵션: 같은 Worker에 `/slack` 엔드포인트 추가하면 Slack slash command 트리거 가능.
- Task 5 후 branch protection rule `require_code_owner_reviews: true` 활성화.

문서: [`project-plan/phase-6/task-5-webhook-proxy.md`](./project-plan/phase-6/task-5-webhook-proxy.md), [`project-plan/phase-6/slack-integration.md`](./project-plan/phase-6/slack-integration.md).

---

## 3-1. 우선순위 3 — Task 6 Resend 이메일

- 필요: Resend API key, from domain/email, recipient list.
- 현재 방침: env 미설정 시 skip.
- Slack 경로가 이미 동작하므로 이메일은 “이메일 수신이 꼭 필요할 때” 진행.

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
