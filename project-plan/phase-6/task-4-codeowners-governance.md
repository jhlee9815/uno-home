# Task 6-4 — CODEOWNERS + Governance Rules

> **목표**: 디자이너→개발자 영역 침범 방지 안전장치 4겹 중 3, 4겹 완성
> **예상 시간**: 30분
> **선행**: 없음 (task-1에서 branch protection은 미설정. task-5 외부 webhook 시작 시점에 별도 적용)
> **블록 해제**: 없음 (병렬 가능)

## 설계 의도

Phase 6-5의 4겹 차단 중 이 task가 다루는 것:
- **3겹**: PR Draft + 라벨 + CODEOWNERS dev 리뷰 강제
- **4겹**: 채널 분리 (auto-apply → PR, report-only → Issue)

## 파일 1: `CODEOWNERS`

```
# .github/CODEOWNERS  (또는 repo root /CODEOWNERS)
# Pattern → Owner(s)
# 어떤 변경이든 코드 리뷰 받아야 함

*                       @<dev-username1> @<dev-username2>

# 디자이너가 직접 수정 가능한 영역 (있다면)
/design-systems/        @<dev-username1> @<designer-username>
/src/screens/Pesse*.tsx @<dev-username1>

# 절대 자동 변경 금지 영역
/scripts/               @<dev-username1>
/.github/               @<dev-username1>
/config/                @<dev-username1>
```

CODEOWNERS는 branch protection의 `require_code_owner_reviews` 와 함께 작동:
- 본 task는 CODEOWNERS 파일만 적용. protection rule 활성화는 task-5에서 외부 webhook이 들어오기 시작할 때 (그 전엔 owner 1인이라 강제 무의미).
- protection 적용 후: `designer-bot`이 PR 만들면 → CODEOWNERS에 명시된 사람이 review approval 안 하면 머지 불가. 디자이너 본인은 owner 목록에 없으니까 자기 PR을 본인이 머지 불가.

## 파일 2: `.github/PULL_REQUEST_TEMPLATE.md`

> ⚠️ 중요: GitHub PR 템플릿은 **사람이 손으로 PR을 열 때만** 적용된다. `post-run-actions.ts`가 octokit으로 `body: csReport`를 직접 채워 PR을 만들면 이 템플릿은 우회된다. 그래서 템플릿은 designer-bot PR의 reviewer가 참고할 checklist + 사람이 만든 PR의 보조 양식 역할로 작성.

```markdown
<!-- NOTE: 이 템플릿은 사람이 손으로 PR을 열 때 사용. designer-bot 자동 PR은 API로 body 직접 채움. -->

## What changed
<!-- 한 줄 요약. -->

## Why
<!-- 변경 의도 / 관련 이슈 / 마커 부착 여부 등. -->

## Verification
- [ ] `npm run build` 통과
- [ ] `npm run lint` 통과
- [ ] visual diff 검토 (수동, 필요 시)

## Reviewer checklist (dev) — designer-bot PR에도 동일 적용
- [ ] 변경된 노드 ID와 코드 위치 일치 확인
- [ ] 마커가 의도된 영역인지 확인 (`figma:text` / `figma:prop` 화이트리스트)
- [ ] 자동 변경이 디자인 시스템 토큰만 건드렸는지 확인
- [ ] Draft → **Ready for review** 전환 후 머지
```

## 파일 3: `.github/ISSUE_TEMPLATE/designer-review.md`

```markdown
---
name: Designer review request
about: report-only 항목 (자동 적용 안 됨)
labels: designer-review, report-only
---

## Detected change
<!-- 자동 채움 -->

## Why not auto-applied
<!-- 자동 채움 — 마커 없음 / allowedClasses 차단 / 화면 정책 -->

## Manual action needed
<!-- 자동 채움 -->

## Designer notes
<!-- 디자이너가 채워서 코멘트 -->
```

## 파일 4: `.github/labels.yml` (선택 — 라벨 색상 통일)

```yaml
- name: designer-bot
  color: ff8c00
  description: Auto-created by figma-pipeline workflow

- name: auto-apply
  color: 0e8a16
  description: Marker-attached change that was auto-applied

- name: designer-review
  color: 1d76db
  description: Designer change needing manual code review

- name: report-only
  color: fbca04
  description: Detected but intentionally not auto-applied
```

라벨 동기화는 `crazy-max/ghaction-github-labeler` action 사용 가능 (선택).

## 단계

```bash
mkdir -p .github/ISSUE_TEMPLATE
# CODEOWNERS는 repo root에 (가장 우선)
cat > CODEOWNERS <<'EOF'
*                       @<dev-username>
/design-systems/        @<dev-username> @<designer-username>
/scripts/               @<dev-username>
/.github/               @<dev-username>
/config/                @<dev-username>
EOF
# 나머지 파일들 작성 (위 템플릿 참고)
git add CODEOWNERS .github/PULL_REQUEST_TEMPLATE.md .github/ISSUE_TEMPLATE/designer-review.md .github/labels.yml
git commit -m "chore: CODEOWNERS + PR/Issue templates for designer-bot governance"
git push
```

## 검증

```bash
# CODEOWNERS 문법 확인
gh api "repos/:owner/uno-home/codeowners/errors"
```

응답에 `errors: []` 이면 OK.

```bash
# 테스트 PR 만들어보기 (designer-bot 흉내)
git checkout -b test/codeowners-check
echo "// test" >> src/screens/PesseSendScreen.tsx
git add . && git commit -m "test"
git push origin test/codeowners-check
gh pr create --draft --title "test" --body "CODEOWNERS check"
# PR 화면에서 "Code owner review required" 보여야 OK
```

확인 후 PR 닫고 브랜치 삭제.

## 함정

- **`<dev-username>` 실제 GitHub ID로 치환**: 없는 ID면 CODEOWNERS errors에 뜸.
- **CODEOWNERS 매칭 우선순위**: 아래 줄이 위 줄을 덮어씀. 가장 specific한 패턴을 아래로.
- **`@team/name` 사용**: GitHub Team이 있으면 개인 ID 대신 team 권장 (멤버 변동 대응).
- **외부 협력자 (designer가 회사 GitHub org 멤버 아님)**: CODEOWNERS에 못 넣음. → 디자이너는 PR 코멘트로만 참여, 머지는 dev.

## 디자이너에게 전달할 한 줄

> "Figma에서 변경하면 자동으로 Draft PR이 만들어집니다. 머지는 개발자가 합니다. PR/Issue에 코멘트로 의도 알려주세요."

## 완료 기록 — 2026-05-20 20:45 KST

사용자 결정: **단일 owner (`jhlee9815`)** 출발 + Phase 7에서 영역별 분리 재검토 (designer/dev/infra).

### 작성 파일
- `.github/CODEOWNERS` — `*` → `@jhlee9815`. `/scripts/`, `/.github/`, `/.github/CODEOWNERS`, `/config/` 명시. Phase 7 분리 TODO를 주석으로 남김.
- `.github/PULL_REQUEST_TEMPLATE.md` — **사람이 손으로 PR을 열 때만 적용** (designer-bot 자동 PR은 API body 직접 채움으로 템플릿 우회). 수동 PR 본문 + designer-bot PR reviewer가 참고할 checklist 역할.
- `.github/ISSUE_TEMPLATE/designer-review.md` — 동일하게 **수동 Issue 작성 시에만 적용**. 자동 생성 Issue는 cs-{id}.md 본문을 body로 직접 사용. 자동 Issue를 받은 디자이너/개발자가 코멘트로 채울 항목(Why not auto-applied / Manual action / Designer notes) 양식.
- `.github/labels.yml` — task-3 자동 생성 4개 라벨(`designer-bot`, `auto-apply`, `designer-review`, `report-only`) 색상/설명 표준화 spec. 라벨 색상은 GitHub API PATCH로 즉시 동기화 적용 완료. 자동 동기화 워크플로 추가는 Phase 7 검토.

### 적용 확인
- 라벨 4개: GitHub API `PATCH /repos/jhlee9815/uno-home/labels/<name>` 으로 색상/설명 적용. HTTP 200 ×4.
  - `designer-bot` #ff8c00 — Auto-created by figma-pipeline workflow
  - `auto-apply` #0e8a16 — Marker-attached change that was auto-applied
  - `designer-review` #1d76db — Designer change needing manual code review
  - `report-only` #fbca04 — Detected but intentionally not auto-applied
- CODEOWNERS 문법: push 후 `GET /repos/jhlee9815/uno-home/codeowners/errors` 로 검증 예정.

### Not-done (의도된 보류)
- **Branch protection rule**: `require_code_owner_reviews: true` 는 GitHub UI 또는 별도 API 호출 필요. private repo는 GitHub Free에서도 가능하나, designer-bot 자동 PR이 자기 PR을 자기가 못 머지하게 막는 게 목적인데 — 현 단계는 owner 1인이라 강제 무의미. **task-5 끝나고 외부 webhook 들어올 때 적용**.
- **labels 동기화 워크플로**: 매 commit마다 `labels.yml` 기준 적용. Phase 7에서 재사용 가치 높을 때 추가.
- **외부 디자이너 GitHub ID 추가**: 디자이너 organization 멤버 아닐 가능성. Phase 7 마이그레이션 가이드와 함께 결정.

### 검증 (다음 cs 자연 트리거 시)
1. cron 2시간 트리거 또는 Slack `/github workflow run` 트리거.
2. cs 발생 시 post-run-actions가 만든 PR/Issue에 라벨 4종이 표준화된 색상/설명으로 정확히 부착되는지 확인 (템플릿 본문 적용은 사람 PR/Issue 한정).
3. PR Draft 상태에서 CODEOWNERS 기반 reviewer assignment 동작 확인 (branch protection 적용 전이라 강제는 task-5 이후).
