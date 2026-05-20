# Task 6-3 — Post-run Routing Script

> **목표**: `scripts/pipeline/post-run-actions.ts` 작성 — cs 리포트를 PR/Issue/Slack/Email로 분기
> **예상 시간**: 2시간
> **선행**: task-2 (workflow에서 호출됨)
> **블록 해제**: task-4 (CODEOWNERS는 별도, 동시 가능)

## 설계 의도

cs-{id}.md 리포트 1개를 입력으로 받아 4갈래 분기:

```
cs-{id}.md
   ├─ auto-apply 변경 있음 → gh pr create --draft --label designer-bot
   ├─ report-only 변경 있음 → gh issue create --label designer-review
   ├─ 항상 → Slack/Discord webhook (있을 때)
   └─ 항상 → Resend 이메일 (있을 때, task-6에서 활성화)
```

**중요 거버넌스 룰**:
- PR은 **항상 Draft**로 생성 (디자이너가 머지 불가)
- 동일 노드 변경은 **기존 PR을 업데이트** (새 PR 안 만듦) — `branch reuse`
- 라벨 `designer-bot`, `auto-apply` 부착으로 출처 명시
- Issue도 `designer-review` 라벨 + assignee는 CODEOWNERS 첫 사람

## 의존성

```bash
npm install --save-dev octokit @octokit/webhooks-types
# Resend는 task-6에서
```

## 파일 스켈레톤 (`scripts/pipeline/post-run-actions.ts`)

```typescript
#!/usr/bin/env tsx
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Octokit } from 'octokit';

const csId = process.argv[2];
if (!csId) {
  console.error('Usage: post-run-actions.ts <cs-id>');
  process.exit(1);
}

const REPO = process.env.GITHUB_REPOSITORY ?? '';
const [owner, repo] = REPO.split('/');
const token = process.env.GITHUB_TOKEN;
if (!token || !owner || !repo) {
  console.error('GITHUB_TOKEN / GITHUB_REPOSITORY missing');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

// 1. cs 리포트 읽기
const csPath = join('.automation/reports', `${csId}.md`);
const csReport = readFileSync(csPath, 'utf-8');

// 2. classified diff JSON 읽기 — auto-apply / report-only 분리
const classifiedPath = join('.automation/diffs', `${csId.replace('cs-', '')}-classified.json`);
const classified = JSON.parse(readFileSync(classifiedPath, 'utf-8'));

const autoApplyChanges = classified.changes.filter((c: any) => c.decision === 'auto-apply');
const reportOnlyChanges = classified.changes.filter((c: any) => c.decision === 'report-only');

console.log(`auto-apply: ${autoApplyChanges.length}, report-only: ${reportOnlyChanges.length}`);

// 3. Slack/Discord (항상)
await notifyWebhooks({ csId, autoApply: autoApplyChanges.length, reportOnly: reportOnlyChanges.length, csReport });

// 4. auto-apply → PR
if (autoApplyChanges.length > 0) {
  await createOrUpdatePR({ csId, changes: autoApplyChanges, body: csReport });
}

// 5. report-only → Issue
if (reportOnlyChanges.length > 0) {
  await createIssue({ csId, changes: reportOnlyChanges, body: csReport });
}

// 6. Resend 이메일 (task-6에서 활성)
if (process.env.RESEND_API_KEY) {
  await sendEmail({ csId, autoApply: autoApplyChanges.length, reportOnly: reportOnlyChanges.length });
}

// === helpers ===

async function notifyWebhooks(args: { csId: string; autoApply: number; reportOnly: number; csReport: string }) {
  const summary = `🎨 Figma 변경 감지: ${args.csId}\nauto-apply: ${args.autoApply}건 · report-only: ${args.reportOnly}건`;
  const slack = process.env.SLACK_WEBHOOK_URL;
  if (slack) {
    await fetch(slack, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: summary }),
    });
  }
  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (discord) {
    await fetch(discord, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: summary }),
    });
  }
}

async function createOrUpdatePR(args: { csId: string; changes: any[]; body: string }) {
  const branchName = `designer-bot/${args.csId}`;

  // 1. 변경된 파일 git add + commit (이미 apply.ts가 코드 수정함)
  await execAsync(`git config user.name "designer-bot"`);
  await execAsync(`git config user.email "designer-bot@users.noreply.github.com"`);
  await execAsync(`git checkout -b ${branchName} || git checkout ${branchName}`);
  await execAsync(`git add -A`);
  await execAsync(`git commit -m "design: ${args.csId} auto-apply" || true`);
  await execAsync(`git push origin ${branchName} --force-with-lease`);

  // 2. 기존 PR 찾기 (브랜치명 기준)
  const existingPRs = await octokit.rest.pulls.list({ owner, repo, head: `${owner}:${branchName}`, state: 'open' });

  if (existingPRs.data.length > 0) {
    // 업데이트
    const pr = existingPRs.data[0];
    await octokit.rest.pulls.update({
      owner, repo, pull_number: pr.number,
      body: args.body,
    });
    console.log(`Updated existing PR #${pr.number}`);
  } else {
    // 신규 생성 (Draft)
    const pr = await octokit.rest.pulls.create({
      owner, repo,
      head: branchName,
      base: 'main',
      title: `[designer-bot] ${args.csId} — ${args.changes.length} auto-apply changes`,
      body: args.body,
      draft: true,
    });
    await octokit.rest.issues.addLabels({
      owner, repo, issue_number: pr.data.number,
      labels: ['designer-bot', 'auto-apply'],
    });
    console.log(`Created Draft PR #${pr.data.number}`);
  }
}

async function createIssue(args: { csId: string; changes: any[]; body: string }) {
  const title = `[designer-review] ${args.csId} — ${args.changes.length} manual review items`;
  const issue = await octokit.rest.issues.create({
    owner, repo,
    title,
    body: args.body,
    labels: ['designer-review', 'report-only'],
  });
  console.log(`Created Issue #${issue.data.number}`);
}

async function sendEmail(args: { csId: string; autoApply: number; reportOnly: number }) {
  // task-6에서 구현
  console.log('Email send: TODO task-6');
}

async function execAsync(cmd: string): Promise<void> {
  const { execSync } = await import('node:child_process');
  execSync(cmd, { stdio: 'inherit' });
}
```

## 검증

```bash
# 로컬에서 (dry-run 보강 권장)
npx tsx scripts/pipeline/post-run-actions.ts cs-2026-05-20T05-48-54

# GitHub Actions에서 (task-2 워크플로 통해)
gh workflow run figma-pipeline.yml -f reason="post-run-actions test"
```

성공 기준:
- auto-apply 0건일 때 PR 안 만들어짐
- auto-apply ≥1건일 때 Draft PR 1개 생성 + 라벨 부착
- report-only ≥1건일 때 Issue 1개 생성 + 라벨 부착
- Slack/Discord/Email 변수 있을 때만 발송 (없으면 skip)

## 함정

- **`git commit` 권한**: workflow에 `contents: write` 필요 (task-2에서 이미 설정)
- **`force-with-lease`**: 같은 브랜치 재push 시 충돌 방지. `--force`는 위험.
- **`apply.ts`가 수정한 파일 위치**: 워크플로의 same job에서 같은 working dir이라야 함.
- **PR body 길이**: GitHub 최대 65,536 chars. cs-*.md가 그보다 크면 자르거나 link로.
- **라벨 사전 생성**: `designer-bot`, `auto-apply`, `designer-review`, `report-only` 라벨이 repo에 없으면 자동 생성됨 (Octokit). 색상 통일하려면 task-4에서 명시.

## 다음

task-4에서 CODEOWNERS + PR 템플릿으로 거버넌스 보강.


## 진행 기록 — 2026-05-20 17:02 KST

- Claude가 task-3을 시작해 `octokit` 의존성 및 `scripts/pipeline/post-run-actions.ts` 초안을 생성한 뒤 토큰 소진으로 중단했다.
- Slack webhook은 아직 없으므로 env 미설정 시 skip하는 방향으로 유지한다.
- Codex가 dry-run 안전성을 보강했다: `DRY_RUN=1`이면 GitHub search/create PR/Issue API를 호출하지 않고 로그만 출력한다.
- 검증 명령:

```bash
DRY_RUN=1 GITHUB_REPOSITORY=jhlee9815/uno-home GITHUB_TOKEN=dummy npx tsx scripts/pipeline/post-run-actions.ts cs-2026-05-20T05-48-54
```

결과: PASS. report-only 4건에 대해 Issue 생성 예정 로그, PR skip, Slack/Discord skip 확인.

## 구현 보완 사항 (실제 코드 vs 위 스켈레톤)

스켈레톤에서 의도만 적었던 동작이 실제 `scripts/pipeline/post-run-actions.ts` 구현에서 다음과 같이 구체화되어 있다. 검증 시 이 6가지를 기준으로 확인한다.

| # | 보완 동작 | 위치 | 의도 |
|:-:|---|---|---|
| 1 | 알림 채널 분리 — `notifySlack` / `notifyDiscord` 별도 함수 | post-run-actions.ts | 환경변수 부재 시 채널별 독립 skip 로그 |
| 2 | Issue dedupe via search API — 동일 `csId` 가 제목에 포함된 open Issue를 `search.issuesAndPullRequests`로 찾고 있으면 body 업데이트, 없을 때만 신규 생성 | `createOrUpdateIssue` | 디자이너가 같은 cs를 여러 번 트리거해도 Issue 1건으로 수렴 |
| 3 | PR no-op detection — `git status --porcelain` 결과가 비면 push/PR 자체를 skip하고 로그만 남김 | `createOrUpdatePR` | `apply.ts`가 마커 화이트리스트로 인해 실제 코드 변경을 안 만든 경우(예: marker 없는 노드) 빈 PR 방지 |
| 4 | `truncateBody` — Issue/PR body가 60,000자를 넘으면 안내 푸터를 붙여 자르고 전체는 workflow artifact 안내 | helper | GitHub body 한도 65,536 + 여유 마진. cs 리포트가 큰 경우 안전. |
| 5 | webhook URL redaction — DRY_RUN 로그에 20자 이상 토큰 패턴을 `<redacted>`로 마스킹 | `postWebhook` | 로그 누출 방지 (Slack/Discord webhook URL은 사실상 토큰) |
| 6 | DRY_RUN 일관 게이트 — `exec` / `postWebhook` / `createOrUpdateIssue` / `createOrUpdatePR` 모두 `DRY_RUN=1`에서 외부 부수효과 0 | 전체 | 로컬에서 `npx tsx` 한 줄로 전체 흐름 검증 가능 |

이 보완 사항은 워크플로 `Post-run routing` 단계에서도 동일하게 동작한다. 워크플로 측은 `GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}` 만 주입하고 `DRY_RUN`은 설정하지 않는다 — 즉, Actions 환경에서는 (a) report-only 변경이 있고 (b) `issues: write` 권한이 있을 때 실제 Issue가 생성되고, PR은 추가로 (c) `git status --porcelain`이 dirty 일 때만 푸시·생성된다. apply가 no-op이면 PR은 skip.

## 남은 검증 (task-3 종료 조건)

> 사전 조건: `gh auth status` PASS + `gh api repos/jhlee9815/uno-home --jq .full_name` 응답 = `jhlee9815/uno-home`. V3 직전엔 격리된 worktree 또는 `git status --porcelain` 빈 상태일 것 — 본 repo의 dirty 변경이 PR 브랜치에 섞이는 사고 방지.

| # | 검증 | 방법 | 성공 기준 |
|:-:|---|---|---|
| V1 | 실제 Issue 생성 | `GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=jhlee9815/uno-home npx tsx scripts/pipeline/post-run-actions.ts cs-2026-05-20T05-48-54` 1회 (`DRY_RUN`은 unset) | report-only 4건 → Issue 1건 생성. 라벨 `designer-review` / `report-only` 부착. Issue URL 기록. (실행 전에 동일 `csId` open Issue가 이미 있으면 V1이 곧 V2로 동작하므로 한 번 검색해 확인) |
| V2 | Issue dedupe | V1 직후 동일 명령 재실행 | 신규 Issue 미생성. "existing open issue found … updating body" 로그 출력. body 재기록 확인. |
| V3 | PR fixture | **격리된 worktree** (`git worktree add ../uno-home-pr-fixture`)에서 합성 `<ts>-classified.json` (auto-apply ≥1건) + 합성 `cs-<ts>.md` + 더미 코드 변경 1줄 생성 → 동일 명령 (cs id는 fixture에 맞춰서) | Draft PR 1건 생성 + `designer-bot` / `auto-apply` 라벨. PR URL 기록. |
| V4 | PR no-op skip | V3와 동일 worktree에서 더미 변경 원복 (`git checkout -- .`) 으로 `git status --porcelain` 비운 후 재실행 | PR push skip + "apply is no-op" 로그 |
| V5 | workflow 통합 | ✅ 2026-05-20 12:05 KST (workflow_dispatch run 26161348247) | report-only 4건 → Issue [`#3`](https://github.com/jhlee9815/uno-home/issues/3) 신규 생성. 라벨 `designer-review`+`report-only` 자동 부착 (task-4 표준화 색상 적용). Slack 알림 자동 전달. cron 10:52 자연 실행은 변경 0건이라 post-run skip — 분기도 정상. |

V1~V5 모두 통과 — task-3 ✅. V5는 task-4 직후 첫 자연 트리거 (workflow_dispatch via Slack 핀 + cron 1회 실행)에서 확인.

검증 후 정리:
- V1로 생성된 Issue는 close (제목에 `[verified]` 접두 추가).
- V3로 생성된 PR은 close + 원격 브랜치 삭제.
- V3 fixture worktree는 `git worktree remove --force` 로 제거 (main repo의 dirty Phase 6 변경에 영향 없음).
- fixture로 만든 `<ts>.json` / `<ts>-classified.json` / `cs-<ts>.md` 는 worktree 제거와 함께 사라짐.

## 검증 결과 — 2026-05-20 20:20 KST (task-3 ✅)

코덱스 1차 review (`019e4514-e802`)에서 권고한 preflight + 격리 worktree 조건을 모두 충족한 뒤 V1~V4 실행.

### 사전 확인
- 토큰: macOS keychain의 OAuth 토큰을 env var로만 주입, 파일/로그/커밋에 절대 노출 없음. 검증 종료 후 unset.
- repo 접근: `GET /repos/jhlee9815/uno-home` → `private=True`, `default_branch=main`. PASS.
- 동일 csId 기존 open Issue: 0건 → V1은 진짜 신규 생성.
- worktree: `git worktree add -b designer-bot/fixture-test ../uno-home-pr-fixture origin/main` 으로 main repo의 dirty Phase 6 변경과 격리.

### 결과

| # | 결과 | 증거 |
|:-:|:-:|---|
| V1 | ✅ | Issue `#1` 신규 생성, 라벨 `designer-review` + `report-only` 자동 부착. report-only 4건. `https://github.com/jhlee9815/uno-home/issues/1` (closed) |
| V2 | ✅ | 동일 csId 재실행 → "existing open issue found: #1 — updating body" 로그, `PATCH /issues/1` 호출, 신규 Issue 미생성. |
| V3 | ✅ | fixture (`auto-apply=1, report-only=0`) + 더미 dirty 파일로 Draft PR `#2` 생성, 라벨 `designer-bot` + `auto-apply` 부착. `head=designer-bot/cs-fixture-2026-05-20T11-15 → base=main`. `https://github.com/jhlee9815/uno-home/pull/2` (closed) |
| V4 | ✅ | V3 직후 clean worktree에서 동일 명령 재실행 → "`[pr] skipped — apply.ts produced no code changes (apply is no-op)`" 로그. PR push 미발생. |
| V5 | ⏳ | task-4 종료 후 cron / `gh workflow run` 자연 트리거에서 검증. task-3 종료 조건과 분리. |

### Not-tested (의도된 갭, task-3 closure 비차단)
- **PR body update on existing PR** (`pulls.update` at `scripts/pipeline/post-run-actions.ts:222`) — V3에서는 신규 생성 경로만 탔다. 이론적으로는 Issue의 `issues.update` 와 같은 패턴이지만 동일 함수가 아니므로 직접 검증되지 않았다. 자연 cs로 auto-apply가 발생하기 시작하는 시점(마커 부착된 Pesse Send CTA 노드 실제 편집)에 자연스럽게 검증될 예정.

### V5 추가 evidence — 2026-05-20 12:05 KST 첫 자연 트리거
- workflow run `26161348247` (event: workflow_dispatch, conclusion: success, 47s).
- 같은 워크플로의 직전 cron 실행 `26157843554` (10:52, schedule)도 success였으나 figma 파일 변경 없어 post-run-actions skip — schedule 경로의 변경 0건 분기도 함께 검증됨.
- 신규 Issue #3 body는 cs 리포트 frontmatter + 요약 ("Figma/classified 변경: 4건, 자동 반영 후보: 0건, report-only: 4건, Apply 상태: noop, Verify 상태: passed") 그대로 본문에 들어감 — `truncateBody` 미발동 (1,254자, 60,000자 한도 안).
- Slack 채널: GitHub 앱이 "Issue created by github-actions[bot]" 즉시 포스팅. 구독 + 라벨 + body 전달 모두 정상.

### Cleanup 결과 (코덱스 2차 review `session 019e4514-e802` 권고 항목 포함)
- Issue `#1`: `PATCH state=closed`, 제목 `[verified] [designer-review] …` 프리픽스 추가. ✅
- PR `#2`: `PATCH state=closed`. ✅
- 원격 브랜치 `designer-bot/cs-fixture-2026-05-20T11-15`: `DELETE /git/refs/heads/...` → HTTP 204. `git ls-remote --heads origin "designer-bot/*"` 결과 0건으로 확인. ✅
- worktree `../uno-home-pr-fixture`: `git worktree remove --force` 로 제거. 로컬 fixture 브랜치 2개(`designer-bot/fixture-test`, `designer-bot/cs-fixture-2026-05-20T11-15`) 삭제. ✅
- main repo dirty 상태(Phase 6 task-7 코드 + Phase 6/7 문서 수정 + post-run-actions.ts/package.json/package-lock.json)는 V3 전과 100% 동일 — 영향 없음. ✅
- 잔여 라벨(`designer-review`, `report-only`, `designer-bot`, `auto-apply`)은 의도된 산출물. task-4에서 색상/설명 표준화 예정.

### 코덱스 검증 세션
- 1차 (doc patch + 정적 검증): `session 019e4514-e802-7f72-9f36-e9fb4a0b2371` — PASS
- 2차 (V1~V4 evidence + cleanup): 위 동일 세션 후속 호출 — PASS
