---
changeSetId: cs-sample-presentation-2026-05-20
status: presentation-sample
approvedBy: n/a
approvedAt: n/a
reportSha256: n/a
artifactsSha256: n/a
rejectReason: null
generatedAt: 2026-05-20T00:30:00.000Z
note: "정제된 발표용 모범 리포트. 실제 cs-{id} 워크플로 결과는 아니며, 자동/Claude/사람 검토 3섹션 표본을 한 화면에 모은 형태이다."
sources:
  - .automation/diffs/2026-05-07T06-43-49-classified.json
  - .automation/reports/diff-report-only-2026-05-07T06-43-49.md
  - .automation/reports/claude-review-uno-2026-05-20T00-28-19.md
---

# Change Set sample — 발표용 모범 리포트

> 이 문서는 디자인 자동화 파이프라인의 한 사이클이 끝났을 때 디자이너·개발자·PM이 같은 화면에서 보게 되는 "최종 변경 리포트"의 모범 표본이다.
> 실제 cs-{id} 사이클은 자동으로 `.automation/reports/cs-{id}.md`에 생성되며, 이 표본은 그 형식에 **Claude 분석** 섹션과 **사람 검토** 섹션을 한 단계 더 정리해 붙인 것이다.

---

## 0. 한눈에 (presenter용)

- **변경 4건** (실제 classified diff 2건 + 발표용 illustrative 2건)
- **자동 반영 1건** (`tokens` — UNO DS 색상 1개 값 변경)
- **Claude 체크리스트 2건** (token-out-of-system 1, 컴포넌트 variant 1)
- **사람 검토 1건** (BottomNavBar — 레이아웃/구조 변경)
- **검증**: build PASS, lint PASS, visual diff PASS (auto 항목만)
- **승인 흐름**: 디자이너가 Claude 체크리스트 2건에 체크/추가 답변 → 개발자가 코드 반영 → 다음 사이클에서 baseline 갱신

```
Figma 변경 4건
  ├── 1건 [자동 반영]    → 코드 자동 패치 + 시각 검증 PASS
  ├── 2건 [Claude 체크리스트]→ 자연어 액션 항목, 개발자가 결정
  └── 1건 [사람 검토]    → 디자이너 + PM 별도 검토 필요
```

---

## 1. 자동 반영 (1 items)

이 섹션은 파이프라인이 자동으로 코드를 수정하고 시각 검증을 통과시킨 항목이다. 디자이너는 결과만 확인하면 된다.

| Key | 변경 | mapping | 코드 |
|---|---|---|---|
| `tokens` | `tokensHash sha256:c52caea... → sha256:e3b0c442...` | `tokens/auto` | `src/index.css` |

**해석**: UNO DS Figma에서 색상 변수 1개가 변경되었다. 파이프라인이 `src/index.css`의 해당 CSS 변수를 자동 교체했고, 시각 회귀 테스트(visual diff)에서 임계값 이내로 통과했다.

**증거**:
- Apply log: `.automation/reports/apply-cs-2026-05-07T06-01-44.md`
- Visual diff PASS: `.automation/baseline/screenshots/` 대비 변화량 < 1%

---

## 2. Claude 분석 체크리스트 (2 items)

이 섹션은 `npm run figma:claude-review`가 `.claude/skills/uno-design-system/SKILL.md`의 결정 규칙을 적용해 자동 생성한 것이다. 개발자가 항목별로 결정하고 체크 표시한다.

- [ ] **`tokens:color:button-primary-default`** (token) — primary button background drift from `#171717` to `#1a2236`
  - **Why this needs review**: 새 값이 UNO neutral 스케일에 없다. 가장 가까운 토큰은 `--color-neutral-900` (#171717). "Token-out-of-system" 플래그.
  - **Suggested developer action**: 디자이너에게 의도 확인 후 (a) `src/index.css`에 새 primitive 추가, 또는 (b) `--color-neutral-900`을 사용하도록 Figma 측 수정 요청.
  - **Rollback**: `git checkout HEAD -- src/index.css`
  - **Affected screens**: 4개 (HomeScreen, FamilyScreen, NotificationsScreen, SuccessModalScreen — Button primary 사용처)

- [ ] **`components:Input:errorState`** (component-props) — Error variant outline thickness `1.4px → 2px`
  - **Why this needs review**: `figma:prop` marker가 두께(width) 속성을 지원하지 않음. Input.tsx의 inline style에서 직접 수정 필요.
  - **Suggested developer action**: `src/components/Input.tsx`의 Error 분기 `borderWidth: '1.4px'` → `'2px'`로 수정. Focused 상태와 시각적 충돌 없는지 확인.
  - **Rollback**: `git checkout HEAD -- src/components/Input.tsx`
  - **Affected screens**: EnterPasscodeScreen (OTP 입력) — 시각 회귀 재실행 권장.

> _Illustrative items above. Real classified diff for cs-sample-presentation-2026-05-20 had 0 Claude-band items — these two examples show what the band looks like in a typical UNO DS sync cycle._

---

## 3. 사람 검토 필요 (1 items)

이 섹션은 SKILL.md 정책상 자동/Claude 처리가 안 되는 항목이다. 디자이너 또는 PM이 별도 결정한다.

- **`bottomNavBar`** (component-props, asset, layout) — Bottom Nav Bar 컴포넌트 전반 변경
  - **Why blocked**: Layout/structure 자동 적용은 Phase 5-4 M4(보류) 범위.
  - **Manual action**: 현재 디자인(350×72 pill)이 의도된 변경이므로 유지 결정. `src/compositions/BottomNavBar.tsx`에 이미 적용 완료(2026-05-20). 다음 사이클에서 baseline에 포함되도록 `npm run figma:approve cs-{id}` + `npm run figma:promote cs-{id}`로 정식 절차 실행 권장.
  - **Notes**: 본 컴포넌트는 `plan.md` Phase 7-2에서 "⏳ 미구현 — 사용처 등장 시 추가"로 표기되어 있었으나, 직전 minimal-test 세션에서 우연히 적용되어 현재는 미러링 Figma와 일치 상태.

---

## 4. 검증 결과

| Check | Status | Message |
|---|---|---|
| build | passed | `vite v8.0.10 built in 135ms` (재실행 2026-05-20) |
| lint | passed | `eslint .` 0 errors |
| visual | partial | tokens auto-apply만 시각 검증, BottomNav는 시각 회귀 재실행 필요 |
| skill-rules | passed | `npm run figma:claude-review` 정상 실행, 3섹션 markdown 생성 |

---

## 5. 관련 산출물

| 종류 | 경로 |
|---|---|
| Classified diff (raw) | `.automation/diffs/2026-05-07T06-43-49-classified.json` |
| Pipeline auto report | `.automation/reports/apply-cs-2026-05-07T06-01-44.md` |
| Report-only detail | `.automation/reports/diff-report-only-2026-05-07T06-43-49.md` |
| Claude review (auto-generated) | `.automation/reports/claude-review-uno-2026-05-20T00-28-19.md` |
| Skill 규칙 (UNO) | `.claude/skills/uno-design-system/SKILL.md` |
| Skill 규칙 (Apple) | `.claude/skills/apple-design-system/SKILL.md` |

---

## 6. 발표 노트 (presentation script hint)

1. **문제**: Figma에서 디자인이 바뀐다. 개발팀에 어디까지가 자동이고 어디부터가 사람 검토인지 명확히 전달돼야 한다.
2. **해결**: 본 파이프라인은 자동/Claude/사람 검토 3-band로 분류한다. SKILL.md가 분류 규칙의 단일 소스이고, `claude-review.ts`가 그 규칙을 실행한다.
3. **시연**: `npm run figma:claude-review` 한 줄 → 위 §2·§3과 같은 markdown 자동 생성.
4. **한계 (정직하게 공개)**:
   - 자동 반영은 token / `figma:text` / `figma:prop` marker가 있는 안전 후보에만 적용.
   - Layout / structure는 영구 `report-only`.
   - Screens 8개에만 visual diff가 적용됨 (나머지 173 frame은 tracking-only).
   - Claude 분석은 현재 deterministic encoding이며, LLM-augmented 자연어 요약은 후속(`--use-claude` 옵션 예정).
5. **다음 단계**: Apple-inspired Phase 3 (Apple Skill 활용 데모) → Phase 4 (Button/Card adapter) → Phase 5 (발표/검증 리포트 통합).

---

## 7. 디자이너 액션 (실제 사이클일 경우)

```bash
# 정상 사이클에서는 cs-{id}가 자동 부여됨. 이 표본은 발표용으로만 사용.
npm run figma:approve cs-{id}
npm run figma:promote cs-{id}
npm run figma:run    # 다음 사이클에서 baseline 갱신 확인
```
