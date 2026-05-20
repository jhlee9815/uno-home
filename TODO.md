# TODO — 다음 세션 시작 가이드

> 작성: 2026-05-20 (보완 트랙 5/5 + Apple Phase 3·4·5 초안 완료 시점)
> 이 파일을 읽고 §1 → §2 → §3 순서로 진입하면 됨.

---

## 0. 이 세션이 끝난 시점의 상태 (30초 요약)

- **UNO HOME 메인 파이프라인**: 동작 (build/lint/preflight/figma-pipeline 모두 PASS). 매핑 186, baseline `2026-05-07T00-10-23.json`.
- **Design System Skill** (`.claude/skills/{uno,apple}-design-system/SKILL.md`): 작성 완료, 3-band 분류 규칙 명문화.
- **Wrapper** `scripts/pipeline/claude-review.ts` + `npm run figma:claude-review`: 동작 확인. 결정적 인코딩 (LLM 호출 없음).
- **Apple-inspired DS Phase 1~5**: 모두 ✅. Phase 4에서 `Button apple-primary/apple-pill-link` + `AppleCard` + `AppleDemoScreen`까지 적용. UNO DS 영향 0건.
- **Phase 5 발표 리포트**: `project-plan/phase-5/presentation-report.md` 13 슬라이드 분량 초안 작성됨.
- **git**: 로컬 init만 됨 (remote 없음). 2개 커밋 (`e499bbe` initial + `756756f` supplementary). Phase 3·4·5 산출물(9개 파일)은 아직 미커밋 상태 — `git status`로 확인.
- **Codex**: 직전 세션에서 Apple-inspired DS Phase 3 진행 중. 우리 합의 메시지(workspace:1/surface:2)는 큐잉됨. 주간 한도 89% 사용. **오후 1시 이후 재개 예정**.

---

## 1. 첫 진입 — 5분

체크하고 시작:

```bash
cd /Users/juhee/Work/Test/design-test/uno-home

# 상태 확인
git status                                        # 미커밋 9개 파일 확인
git log --oneline                                 # e499bbe + 756756f 2개 커밋

# 최종 검증 재실행 (예전 세션 결과 그대로인지 확인)
npm run build && npm run lint                     # 둘 다 PASS 기대
npm run figma:claude-review                       # UNO 트랙 리포트 생성
npm run figma:claude-review -- --source apple     # Apple 트랙 리포트 생성
```

문제 없으면 §2로. 문제 있으면 §6 트러블슈팅 먼저.

---

## 2. 우선순위 1 — Codex 응답 회수 + 정합성 점검 (15분)

**전제**: Codex가 오후 1시 이후 재개됨. 직전 큐잉된 합의 메시지에 ack 또는 이견을 보낼 것.

### 2-1. Codex 응답 확인

```bash
cmux read-screen --workspace workspace:1 --surface surface:2 --lines 60
```

확인 항목:
- 우리 합의 메시지 (workspace:1/surface:2)에 Codex가 응답했는지
- 토큰 한도 갱신됐는지 (`weekly` 표시)
- Apple Phase 3 산출물이 `project-plan/phase-3/` 추가 파일을 만들었는지

### 2-2. Phase 3 정합성 5분 비교

Codex가 만들었을 수도 있는 추가 파일:
- `project-plan/phase-3/checklist-example.md` (이미 우리가 `design-systems/apple/checklist-example.md`로 만들어둠)
- `design-systems/apple/apple-skill.md` (대안 위치)
- 기타 phase-3 산출물

Codex 산출물 vs 우리 `.claude/skills/apple-design-system/SKILL.md`:
- 입력/출력 계약 일치 여부
- 결정 규칙표 충돌 여부
- 디스클레이머 정책 일치 여부

**불일치 발견 시**: 우리 쪽이 더 풍부하므로 Codex 산출물에 cross-reference 추가하고 우리 SKILL.md를 단일 소스로 합의.

---

## 3. 우선순위 2 — 미커밋 9개 묶어서 커밋 (5분)

> 사용자 명시 승인 후에만 실행 (글로벌 정책 — 명시 없이 git 명령 금지).

**커밋 대상 (다음 세션 시작 시 git status 확인)**:
```
 M plan.md
 M src/App.tsx
 M src/components/Button.tsx
 M src/main.tsx
 M handoff.md            # 본 세션에서 추가 갱신될 수 있음
 M README.md             # 본 세션에서 추가 갱신될 수 있음
?? TODO.md               # 본 파일
?? design-systems/apple/apple-tokens.css
?? design-systems/apple/checklist-example.md
?? project-plan/phase-5/presentation-report.md
?? src/components/AppleCard.tsx
?? src/screens/AppleDemoScreen.tsx
```

**제안 커밋 메시지** (또는 분할 — 사용자 선택):
- 통합: `feat: phase 3-5 (apple adapter + checklist-example + presentation report)`
- 분할 시:
  - `docs(phase-3): add Apple DS checklist-example`
  - `feat(phase-4): Button apple-variants + AppleCard + AppleDemoScreen`
  - `docs(phase-5): presentation report draft`
  - `docs: update README/handoff with claude-review + TODO`

---

## 4. 우선순위 3 — 발표 데모 리허설 (15분)

```bash
# 데모 1: UNO 트랙 자동 리포트
npm run figma:claude-review
# → .automation/reports/claude-review-uno-<ts>.md 생성, 3-band markdown 확인

# 데모 2: Apple 트랙 자동 리포트
npm run figma:claude-review -- --source apple
# → 4 Claude items + 3 Human items 자동 생성 확인

# 데모 3: 시각 (npm run dev)
npm run dev
# 브라우저에서 http://localhost:5173 → 가장 하단 "Phase 4 — Apple-inspired Adapter Demo" 섹션
# - Apple primary 파란 pill 버튼
# - Apple pill-link outline 버튼
# - light surface AppleCard (Cinematic neutrals)
# - dark surface AppleCard (Focused moments)

# 데모 4: 모범 리포트
cat project-plan/supplementary-2026-05-20/sample-cs-report.md
# → 7섹션 발표용 표본
```

발표 흐름 (`project-plan/phase-5/presentation-report.md` §1~§12 그대로):
1. 한 문장 요약
2. 문제 정의 → 목표
3. 파이프라인 다이어그램
4. 감지 기준
5. 3단계 분류표
6. Skill 두 트랙
7. Button 사례 (Phase 4 결과)
8. 페이지별 리포트 (sample-cs-report.md 인용)
9. 산출물 표
10. 기대효과
11. 한계 5개 (정직 공개)
12. 다음 단계

---

## 5. 선택 작업 (시간 여유 있을 때)

| 우선도 | 작업 | 예상 |
|:-:|---|---|
| Low | `--use-claude` 옵션 실제 구현 (Anthropic SDK 통합) | 1~2h |
| Low | minimal-test에 동일 wrapper 이식 | 2h |
| Low | Apple Phase 4 확장 (Navigation glass, Hero) | 1d |
| Low | Slack/PR comment 알림 출력 | 1d |
| Low | git remote 추가 + GitHub 푸시 (사용자 명시 필요) | 30분 |

이 항목들은 **발표 자체에 필수가 아님**. 발표 끝나고 다음 사이클로.

---

## 6. 트러블슈팅

| 증상 | 확인 |
|---|---|
| `npm run figma:claude-review` 실패: "Skill file missing" | `.claude/skills/{uno,apple}-design-system/SKILL.md` 존재 확인 |
| `npm run figma:claude-review` 실패: "No classified diff found" | `npm run figma:classify` 먼저 실행하거나 `--input` 직접 지정 |
| `npm run build` TS 에러 | `src/components/Button.tsx`의 `ButtonVariant` 타입에 apple 변형 두 개 들어있는지 확인 |
| `npm run dev` Apple 섹션이 빈 화면 | `src/main.tsx`에서 `apple-tokens.css` import 라인 확인 |
| Codex 응답 없음 | 1시 이후 재시도, 그래도 없으면 토큰 한도 갱신 여부 확인 |

---

## 7. 참고 문서 인덱스

| 종류 | 경로 |
|---|---|
| 전체 계획 | [plan.md](./plan.md) |
| 디자이너 핸드오프 | [handoff.md](./handoff.md) |
| 운영 가이드 | [README.md](./README.md) |
| Apple 트랙 phase 단계 | [project-plan/phase-1/](./project-plan/phase-1/) ~ [phase-5/](./project-plan/phase-5/) |
| 보완 트랙 | [project-plan/supplementary-2026-05-20/](./project-plan/supplementary-2026-05-20/) |
| 발표 리포트 초안 | [project-plan/phase-5/presentation-report.md](./project-plan/phase-5/presentation-report.md) |
| 모범 cs 리포트 | [project-plan/supplementary-2026-05-20/sample-cs-report.md](./project-plan/supplementary-2026-05-20/sample-cs-report.md) |
| UNO Skill | [.claude/skills/uno-design-system/SKILL.md](./.claude/skills/uno-design-system/SKILL.md) |
| Apple Skill | [.claude/skills/apple-design-system/SKILL.md](./.claude/skills/apple-design-system/SKILL.md) |
| Apple checklist example | [design-systems/apple/checklist-example.md](./design-systems/apple/checklist-example.md) |
| Apple preview HTML | http://127.0.0.1:4177/design-systems/apple/preview.html (또는 `design-systems/apple/preview.html`) |
