# UNO HOME × Apple-inspired DS — 발표 리포트 초안

> 작성: 2026-05-20 (Claude)
> 단계: Phase 5 draft. Phase 4 결과까지 반영. Codex Apple Phase 3 결과 도착 시 §5·§9 정합성 한 차례 재검토 필요.
> 본 문서는 발표에서 그대로 읽을 수 있는 흐름으로 구성되어 있다. 한 화면당 한 섹션 기준.

---

## 0. 한 문장 요약 (slide 1)

> 디자인 시스템의 변경을 코드로 "자동 반영"하는 것이 아니라, **자동 감지·Claude 분류·사람 검토**의 3단계로 **개발 전달 비용을 줄이는** 실험이다.

---

## 1. 문제 정의 (slide 2)

- 디자이너가 Figma에서 디자인을 바꾼다 → 개발자에게 "이번에 뭐 바뀌었는지" 정리해서 전달해야 한다.
- 매번 사람이 정리하면 누락 / 오해 / 지연이 발생한다.
- 반대로 모든 변경을 자동으로 코드에 반영하면 **레이아웃 / 구조 / 상태 색상 충돌 같은 위험한 변경**이 무방비로 들어간다.
- 우리가 풀려는 문제: "어디까지는 자동 반영, 어디까지는 사람 검토" 경계를 명시화하고, 이 경계가 적용된 결과를 **검증된 markdown 리포트**로 제공하는 것.

---

## 2. 목표 (slide 3)

- 완전 자동화가 아니다. 자동 반영의 안전 후보만 자동 적용.
- 안전 후보 외 변경은 **Claude 체크리스트** 또는 **사람 검토**로 분류한다.
- 모든 변경은 한 markdown 리포트(`cs-{id}.md`)에 통합되어 디자이너·개발자·PM이 같은 화면을 본다.
- 발표에서 말할 수 있는 한계를 명확히 한다.

비목표:
- 완전 자동 코드 리디자인
- LLM이 디자인 의도를 추측해 새 컴포넌트를 생성하는 것
- Figma 외 다른 디자인 도구 지원

---

## 3. 전체 파이프라인 (slide 4 — 다이어그램)

```
[Figma file]
   ↓ snapshot (REST API, depth=2)
[.automation/snapshots/]
   ↓ diff (baseline vs head)
[.automation/diffs/]
   ↓ classify (figma-mapping.yaml 정책 + class)
[.automation/diffs/*-classified.json]
   ↓ [Design System Skill]      ←── NEW (Phase 3·보완 트랙)
[.automation/reports/claude-review-*.md]
   ↓ apply (token/text/prop markers)
   ↓ verify (build/lint/visual)
[.automation/reports/cs-{id}.md]   ← 디자이너 승인 게이트
   ↓ approve & promote
[dist-dev/ + .automation/baseline/ 갱신]
```

- **자동 영역**: snapshot, diff, classify, apply, verify, promote — 결정적(deterministic), 모든 단계 시각 회귀 검증 + build/lint 게이트
- **Skill 영역**: classified diff를 **Auto-applied / Claude review / Human review** 3-band markdown으로 번역. SKILL.md가 단일 규칙 소스.
- **사람 영역**: 승인 / 반려 / 모범 리포트 검토

---

## 4. 감지 기준 (slide 5)

파이프라인이 변경을 감지하는 기준:

| 항목 | 기준 |
|---|---|
| 비교 모드 | `baseline` (최신 승인된 snapshot vs head) |
| 매핑 범위 | 186 entries (components 6 / compositions 7 / screens 173) |
| Visual diff | 라우트가 등록된 8개 screen만 |
| Token diff | `tokensHash` (`src/index.css` 전체 해시) |
| Component diff | node id 기준 + `figma:text` 36개 + `figma:prop` 14개 마커 |
| 정책 분포 | report-only 175 / partial 8 / auto 4 |
| 빈도 | 매일 21:00 launchd (또는 수동 `npm run figma:run`) |

---

## 5. 3단계 분류 (slide 6 — 핵심)

`.claude/skills/uno-design-system/SKILL.md` 결정 규칙표 요약:

| 변경 종류 | 자동 (Auto) | Claude 체크리스트 | 사람 검토 |
|---|:-:|:-:|:-:|
| Token 값 변경 (mapping=auto) | ✅ | | |
| Token 값 변경 (mapping=report-only) | | ✅ | |
| Component-props 변경 (mapping=partial) | ✅ | | |
| Component-props 변경 (mapping=report-only) | | ✅ | |
| Component/composition text (marker 있음) | ✅ | | |
| Component/composition text (marker 없음) | | ✅ | |
| Screen text | | | ✅ (영구) |
| Layout / Structure | | | ✅ (Phase 5-4 M4 보류) |
| Asset (Lucide swap) | | | ✅ |
| Unknown / Unmapped | | | ✅ |

Skill의 역할은 단순한 분류기가 아니라:
- 각 Claude 체크리스트 항목에 **"왜 검토 필요한지 + 제안 액션 + 롤백 방법"** 3줄을 자동 부여
- 각 사람 검토 항목에 **"왜 막혔는지 + 어느 파일을 봐야 하는지"** 명시

---

## 6. Skill 두 트랙 (slide 7)

| 트랙 | 입력 | 트리거 | SKILL.md |
|---|---|---|---|
| UNO | classified diff JSON | 매일 21:00 + 수동 | `.claude/skills/uno-design-system/SKILL.md` |
| Apple-inspired | `apple-tokens.json` + `token-mapping.md` | 수동 (Figma 바인딩 없음) | `.claude/skills/apple-design-system/SKILL.md` |

두 Skill은 **같은 출력 스키마**(3섹션 markdown)를 따른다. 한 wrapper `scripts/pipeline/claude-review.ts`가 `--source` 플래그로 분기.

발표 시연 한 줄:
```bash
npm run figma:claude-review              # UNO 트랙
npm run figma:claude-review -- --source apple  # Apple 트랙
```

---

## 7. Button 사례 — Phase 4 결과 (slide 8)

**Before** (UNO만):
- `Button.tsx` variant: `primary | secondary | danger | ghost`
- 모두 `--button-*` UNO 토큰 사용
- 라운드: size별 `12px` / `16px`

**After** (Apple adapter 추가, UNO 영향 없음):
- variant 두 개 추가: `apple-primary` (배경 `--apple-color-blue` + radius pill) / `apple-pill-link` (outline + pill)
- 모두 `--apple-*` 네임스페이스 사용 — UNO 토큰 / 컴포넌트 / 화면 0건 변경
- 코드 위치: `src/components/Button.tsx` + `design-systems/apple/apple-tokens.css`
- 시각 확인: `npm run dev` → App.tsx 하단 "Phase 4 — Apple-inspired Adapter Demo" 섹션

**검증 증거**:
- `npm run build` PASS (1754 modules, 140ms)
- `npm run lint` PASS (0 errors)
- `npm run figma:claude-review` PASS (UNO·Apple 두 리포트 정상 생성)
- 변경된 UNO DS 토큰: 0건 (격리 성공)

---

## 8. 페이지별 리포트 (slide 9)

모범 표본: [`project-plan/supplementary-2026-05-20/sample-cs-report.md`](../supplementary-2026-05-20/sample-cs-report.md)

구성 7섹션:
1. 한눈에 (presenter용 카운트 + ASCII 다이어그램)
2. 자동 반영 (1 items)
3. Claude 분석 체크리스트 (2 items, illustrative)
4. 사람 검토 필요 (1 items)
5. 검증 결과 (build / lint / visual / skill-rules)
6. 관련 산출물 (raw JSON, apply log, visual diff, Skill 파일)
7. 발표 노트 + 디자이너 액션 CLI

이 한 markdown이 디자이너·개발자·PM이 같은 화면에서 보는 단일 컨택트 포인트.

---

## 9. 산출물 표 (slide 10)

### UNO 트랙 (메인)
| 종류 | 경로 |
|---|---|
| 파이프라인 진입 | `npm run figma:run` (또는 launchd 21:00) |
| 매핑 | `config/figma-mapping.yaml` (186 entries) |
| 토큰 SoT | `src/index.css` (Tailwind v4 `@theme` + `:root`) |
| Skill | `.claude/skills/uno-design-system/SKILL.md` |
| Wrapper | `scripts/pipeline/claude-review.ts` (`npm run figma:claude-review`) |
| 최신 baseline | `.automation/baseline/2026-05-07T00-10-23.json` |
| 모범 리포트 | `project-plan/supplementary-2026-05-20/sample-cs-report.md` |

### Apple-inspired 트랙
| 종류 | 경로 |
|---|---|
| 토큰 JSON | `design-systems/apple/apple-tokens.json` |
| 토큰 CSS | `design-systems/apple/apple-tokens.css` (Phase 4 생성) |
| 매핑/리스크 | `design-systems/apple/token-mapping.md` |
| 미리보기 HTML | `design-systems/apple/preview.html` |
| Skill | `.claude/skills/apple-design-system/SKILL.md` |
| 체크리스트 예시 | `design-systems/apple/checklist-example.md` |
| 데모 라우트 | `src/screens/AppleDemoScreen.tsx` (+ `Button.tsx` variant + `AppleCard.tsx`) |

---

## 10. 기대효과 (slide 11)

- 디자이너↔개발자 사이의 변경 전달 시간 감소 (수기 정리 → 자동 markdown)
- 변경 종류별 안전성 보장 (자동/Claude/사람) — 위험 변경이 무방비로 코드에 들어가지 않음
- 디자인 시스템 변경 이력의 단일 SoT (`.automation/reports/cs-{id}.md` + `.automation/baseline/`)
- Figma가 아닌 외부 DS(예: Markdown DESIGN.md)도 동일 출력 스키마로 통합 가능 (Apple 트랙으로 증명)
- Skill을 새 트랙(Material, Carbon 등)에 복제하는 비용이 SKILL.md 1개 작성으로 한정됨

---

## 11. 한계 (slide 12 — 정직 공개)

발표에서 반드시 인정할 한계 5개:

1. **자동 적용 범위는 좁다**. token / `figma:text` / `figma:prop` marker가 있는 안전 후보에만 적용. 전체 변경의 ~5% 수준.
2. **Visual diff는 8개 screen만**. 173개 등록 frame 중 165개는 markdown 추적만 됨.
3. **레이아웃 / 구조 자동 적용은 영구 보류** (Phase 5-4 M4). 영영 사람이 해야 함.
4. **Skill의 Claude 분석 자체는 현재 deterministic encoding**. SKILL.md 규칙을 TS로 인코딩한 wrapper. LLM-augmented 자연어 요약은 후속 작업 (`--use-claude` 옵션 예정).
5. **Apple 트랙은 Figma 바인딩이 없다**. snapshot/diff 자동화 없이 토큰 JSON 비교만 가능. "외부 DS 통합 가능성"을 보여주는 데모지, 완전한 production-ready 트랙은 아님.

추가 신뢰도 단서:
- minimal-test BottomNavBar 결정 미해결 사례에서 보듯 "writer / verifier 분리 원칙"이 강제되지 않으면 휴먼 에러가 새 들어옴.
- Figma node ID는 파일-로컬이라 새 프로젝트로 옮길 때 매핑 재생성 필요. `figma:register-file` 자동화로 완화했으나 0-friction은 아님.

---

## 12. 다음 단계 (slide 13)

| 단계 | 내용 | 예상 비용 |
|---|---|---|
| ① | `--use-claude` 옵션 구현 (Anthropic SDK 통합, deterministic + LLM 하이브리드) | 1~2h |
| ② | minimal-test에 동일 wrapper 이식 (샌드박스에서도 시연 가능하게) | 2h |
| ③ | Apple Phase 4 확장 — Card, Hero, Navigation 3개 추가 | 1d |
| ④ | Slack/Notion/Linear 알림 출력 (현재 macOS notify만) | 1d |
| ⑤ | git PR comment 자동 생성 (코드 리뷰와 통합) | 0.5d |
| ⑥ | Layout 자동 적용 (Phase 5-4 M4) — 신규 실험 영역 | 1주~ |

발표 시점에는 ①~③까지가 현실적. ④~⑥은 발표 종료 후 별도 트랙.

---

## 13. Q&A 준비 (presenter notes)

**예상 질문**: "Claude가 진짜로 분석하는 거야 아니면 규칙 기반이야?"
- 답: 현재는 SKILL.md의 규칙을 TS로 인코딩한 결정적 wrapper다. SKILL.md 자체는 Claude가 읽고 따르도록 작성된 것이고, 우리는 그 규칙을 코드로 옮겨 wrapper로 만든 것. 다음 단계에서 `--use-claude` 플래그로 진짜 LLM 호출을 붙일 것. 두 모드 모두 SKILL.md가 단일 규칙 소스다.

**예상 질문**: "그러면 LLM이 굳이 필요한가?"
- 답: 규칙 기반만으로도 충분히 가치 있다 (시연 가능). LLM의 역할은 **자연어 요약 + edge case 일반화**다. 예를 들어 "이 텍스트 변경은 마이너 UI 카피인지, 큰 메시지 변경인지" 같은 판단은 규칙으로 어렵다.

**예상 질문**: "Apple은 왜 같이 보여주나?"
- 답: 외부 DS(예: 다른 회사의 Markdown 디자인 가이드)도 같은 출력 스키마로 흡수할 수 있다는 것을 보여주는 데모. UNO Figma처럼 풀 파이프라인이 갖춰져 있지 않아도 Skill만 있으면 체크리스트화 가능하다는 가능성 시연.

**예상 질문**: "이거 누가 쓸 수 있나?"
- 답: Figma 기반 디자인 시스템을 운영하는 팀 (스타트업~중견 규모). 풀 자동화가 부담스러운 팀이 자동/사람 검토 비율을 점진적으로 조정해 가는 데 적합. 대기업의 다중 DS 환경에는 Skill 복제 비용이 낮다는 점이 강점.

---

## Appendix A — 관련 문서 인덱스

- [plan.md](../../plan.md) — 전체 계획
- [`project-plan/phase-1/`](../phase-1/) ~ [`phase-5/`](.) — 단계별 산출물
- [`project-plan/supplementary-2026-05-20/`](../supplementary-2026-05-20/) — 보완 트랙 (skills + wrapper + sample)
- [`.claude/skills/uno-design-system/SKILL.md`](../../.claude/skills/uno-design-system/SKILL.md)
- [`.claude/skills/apple-design-system/SKILL.md`](../../.claude/skills/apple-design-system/SKILL.md)
- [`scripts/pipeline/claude-review.ts`](../../scripts/pipeline/claude-review.ts)
- [`handoff.md`](../../handoff.md) — 디자이너 핸드오프
- [`README.md`](../../README.md) — 자동화 운영 가이드

## Appendix B — 발표용 한 줄 인용

> 이 프로젝트는 Apple-inspired Markdown 디자인 시스템을 외부 입력값으로 등록하고, 이를 토큰/컴포넌트/개발 체크리스트로 변환해 기존 Figma 변경 감지 파이프라인과 연결 가능한지 검증하는 실험입니다. 완전 자동 코드 반영이 아니라, 자동 감지 가능한 항목과 Claude 요약/사람 검토가 필요한 항목을 분리해 개발 전달 비용을 줄이는 것이 목표입니다.
> — `plan.md` §7
