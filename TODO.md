# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20
> 최신 갱신: 2026-05-20 21:15 KST (Phase 6 task-1/2/3/4/7 ✅, **운영 관찰 기간** 진입 — 2026-05-23까지 cron 자연 실행 관찰 후 task-5)

---

## 0. 현재 상태 (30초 요약)

- **현재 단계**: Phase 6 — Pesse Figma 자동 반영 파이프라인을 GitHub Actions 실서비스 형태로 운영화.
- **GitHub**: private repo `jhlee9815/uno-home`, `main...origin/main`. Actions workflow `figma-pipeline.yml`은 수동 실행 성공 이력 있음.
- **완료**: Phase 1~5 archive, Pesse 데모 검증, Phase 6 task-1/2/3/4/7 ✅.
- **task-3 V1~V4 실검증** (2026-05-20 20:20 KST): Issue 신규+dedupe, Draft PR 신규, no-op skip 모두 PASS. Issue/PR 모두 close cleanup 완료. Codex 2회 PASS. **3개 commit push 완료 (bfc478e, d175c35, 8697e58)**.
- **task-4 거버넌스** (2026-05-20 20:45 KST): CODEOWNERS(단일 owner) + PR/Issue 템플릿 + labels.yml + 라벨 4개 색상/설명 표준화 완료.
- **task-3 V5 자연 트리거** (2026-05-20 21:05 KST): Slack 핀 링크 → GitHub Actions Run workflow → Issue [#3](https://github.com/jhlee9815/uno-home/issues/3) 자동 생성 + Slack 알림. cron 10:52 변경 0건 분기도 검증. end-to-end 운영 흐름 통과.
- **uncommitted 상태**: task-4 4개 신규 파일 + 관련 docs (commit 대기).
- **다음 우선순위**: task-5 Cloudflare Worker → task-6 Resend.
- **선결조건**: task-5 진입 전에 Cloudflare 계정 + wrangler 설치 필요. (Slack 트리거는 GitHub 공식 Slack 앱으로 즉시 가능, 별도 작업 불필요)

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

## 2. 우선순위 1 — 운영 관찰 기간 (~2026-05-23)

task-3/4 첫 자연 트리거 통과 직후. cron 2시간 주기로 자연 실행되는 결과를 2-3일 관찰. **노트북 꺼져 있어도 cron은 GitHub 서버에서 자동 실행됨.**

### 매일 1초 routine
```bash
cd /Users/juhee/Work/Test/design-test/uno-home
npm run figma:health
```
`Anomalies ✅ none detected` 보이면 끝. 출력 해석/이상 신호 대응 매뉴얼은 [`phase-plan-6 §6-8-A`](./project-plan/phase-6/phase-plan-6.md#6-8-a-운영-관찰-기간-task-5-진입-전-2026-05-20--05-23-권장).

### Figma 추적 메커니즘 / 새 프레임 만들 때
어떤 파일/노드가 잡히는지, 새 프레임 만들면 어떻게 되는지: [`phase-plan-6 §6-8-B`](./project-plan/phase-6/phase-plan-6.md#6-8-b-figma-추적-메커니즘--운영자가-알아야-할-것).

### 관찰 끝난 뒤 (사용자 진입 우선순위 결정)
- **(A) task-8 — DS Compliance Detection** (detached styles / image / new frames). 디자이너+개발자 양쪽 즉시 가치. 7-9시간. 설계 확정. 세부: [`task-8-ds-compliance-detection.md`](./project-plan/phase-6/task-8-ds-compliance-detection.md).
- **(B) task-5 — Cloudflare Worker** (Figma webhook → 즉시 트리거). 1-2시간 + 외부 의존성. 디자이너 편집 → 결과까지 지연 단축.
- **(C) task-6 — Resend 이메일** (현재 Slack 알림 충분, 후순위).

task-5 진입 가이드: [`phase-plan-6 §6-8-C`](./project-plan/phase-6/phase-plan-6.md#6-8-c-다음-세션-진입-가이드).

## 3. 우선순위 2 — task-5 Cloudflare Worker (Figma webhook 프록시, 관찰 후)

- 필요: Cloudflare 계정, `wrangler` CLI, GitHub fine-grained PAT (workflow trigger 권한), Figma webhook passcode.
- 목표: Figma 파일 편집 → Figma webhook → Cloudflare Worker → GitHub `repository_dispatch` → workflow `figma-pipeline.yml` 자동 트리거.
- 부수 옵션: 같은 Worker에 `/slack` 엔드포인트 추가하면 Slack 슬래시 커맨드로도 트리거 가능. (없어도 GitHub 공식 Slack 앱으로 트리거 가능, [`project-plan/phase-6/slack-integration.md`](./project-plan/phase-6/slack-integration.md) 참조)
- task-5 끝나면 branch protection rule `require_code_owner_reviews: true` 활성화 — 외부 webhook이 자동 PR을 만들기 시작할 때부터 의미 있음.

---

## 3-1. 우선순위 3 — task-6 Resend 이메일

- 필요: Resend API key, from domain/email, recipient list.
- 현재 방침: env 미설정 시 skip (코드 분기 이미 있음).
- 도메인 DNS 검증 propagation에 24h+ 걸릴 수 있으므로 Resend 계정만 미리 만들어두면 좋음.

Slack/Discord webhook은 별개:
- GitHub 공식 Slack 앱은 webhook URL 없이 OAuth로 작동.
- `post-run-actions.ts`의 `notifySlack`/`notifyDiscord`는 추가 풍부한 메시지 원할 때만 `SLACK_WEBHOOK_URL`/`DISCORD_WEBHOOK_URL` secret 등록.

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
| Phase 7 canonical 계획 | [project-plan/phase-7/phase-plan-7.md](./project-plan/phase-7/phase-plan-7.md) |
| Phase 7 quick handoff | [project-plan/phase-7/plan-7.md](./project-plan/phase-7/plan-7.md) |
| 운영 가이드 | [README.md](./README.md) |
| 디자이너 핸드오프 | [handoff.md](./handoff.md) |


## Task 8 진행 메모 (2026-05-21 10:33 KST)

- `feature/task-8-ds-compliance` 브랜치에서 Stage 0-6 완료.
- 구현: snapshot deep traversal compliance 수집, stable-key diff, classify report-only policy, cs report compliance sections, pending local viewer.
- 검증: full figma test loop, `npm run lint`, `npm run build`, Stage 6 real Figma probe PASS.
- 상세: [project-plan/phase-6/task-8-ds-compliance-detection.md](./project-plan/phase-6/task-8-ds-compliance-detection.md) §8-12.
- 다음: Draft PR #9 review/CI 후 merge. 이후 task-9 또는 task-10 Phase A 진입.
