# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-20 20:20 KST (Phase 6 task-1/2/3/7 ✅, 다음 task-4)

---

## 0. 현재 상태 (30초 요약)

- **현재 단계**: Phase 6 — Pesse Figma 자동 반영 파이프라인을 GitHub Actions 실서비스 형태로 운영화.
- **GitHub**: private repo `jhlee9815/uno-home`, `main...origin/main`. Actions workflow `figma-pipeline.yml`은 수동 실행 성공 이력 있음.
- **완료**: Phase 1~5 archive, Pesse 데모 검증, Phase 6 task-1/2/3/7 ✅.
- **task-3 V1~V4 실검증** (2026-05-20 20:20 KST): Issue 신규+dedupe, Draft PR 신규, no-op skip 모두 PASS. Codex review 2회 PASS. Issue/PR 모두 close cleanup 완료.
- **uncommitted 상태**: 12 modified + 2 untracked (Phase 6 task-3 + task-7 코드/문서). 아직 commit 안 함 — 사용자 승인 후 일괄 commit 예정.
- **다음 우선순위**: task-4 CODEOWNERS/PR 템플릿 → task-5 Cloudflare Worker → task-6 Resend.
- **선결조건**: task-4 진입 전에 CODEOWNERS에 들어갈 GitHub username 결정 (`jhlee9815` 단일 또는 +reviewer).

---

## 1. 첫 진입 — 5분

```bash
cd /Users/juhee/Work/Test/design-test/uno-home

git status --short --branch
git log --oneline -5

npm run build && npm run lint
npm run figma:preflight
npx tsc --noEmit
```

현재 Codex 확인 결과 위 검증은 PASS.

---

## 2. 우선순위 1 — task-4 CODEOWNERS/PR 템플릿

- 실제 GitHub username 필요(`jhlee9815` 단일이면 그대로).
- 목표 파일: `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/designer-review.md`, optional `.github/labels.yml`.
- task-3에서 만든 라벨 `designer-bot` / `auto-apply` / `designer-review` / `report-only`를 `labels.yml`로 색상/설명 표준화하면 자연스럽게 이어짐.
- task-3 검증 중 미커버 갭(PR body update on existing PR)도 task-4 진행 중 자연 cs로 함께 확인.

---

## 3. 우선순위 2 — task-5/6 외부 서비스

| Task | 필요 외부 준비 | 현재 방침 |
|---|---|---|
| task-5 Cloudflare Worker | Cloudflare 계정, wrangler login, GitHub fine-grained PAT, Figma webhook passcode | 아직 미진행 |
| task-6 Resend Email | Resend API key, from domain/email, recipient list | env 없으면 skip |
| Slack/Discord | webhook URL | 아직 없음 — 코드에서는 env 없으면 skip |

---

## 4. task-3 완료 기록 (2026-05-20 20:20 KST)

V1~V4 실검증 PASS. 세부는 [`project-plan/phase-6/task-3-post-run-actions.md`](./project-plan/phase-6/task-3-post-run-actions.md) "검증 결과" 섹션. 코덱스 review session: `019e4514-e802`.

증거: Issue [#1](https://github.com/jhlee9815/uno-home/issues/1) (closed, `[verified]` prefix), PR [#2](https://github.com/jhlee9815/uno-home/pull/2) (closed). 원격 브랜치 `designer-bot/cs-fixture-2026-05-20T11-15` 삭제 완료.

Not-tested 갭: PR body update on existing PR — task-4 진행 중 자연 cs 발생 시 확인.

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
| task-3 계획 | [project-plan/phase-6/task-3-post-run-actions.md](./project-plan/phase-6/task-3-post-run-actions.md) |
| task-7 완료 기록 | [project-plan/phase-6/task-7-bugfixes.md](./project-plan/phase-6/task-7-bugfixes.md) |
| Phase 7 canonical 계획 | [project-plan/phase-7/phase-plan-7.md](./project-plan/phase-7/phase-plan-7.md) |
| Phase 7 quick handoff | [project-plan/phase-7/plan-7.md](./project-plan/phase-7/plan-7.md) |
| 운영 가이드 | [README.md](./README.md) |
| 디자이너 핸드오프 | [handoff.md](./handoff.md) |
