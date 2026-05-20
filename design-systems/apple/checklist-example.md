# Apple-inspired DS — Checklist Example

> Phase 3 산출물 (계약상 요구 항목).
> 본 파일은 `apple-design-system` Skill이 실제로 어떤 체크리스트를 만드는지 보여주는 정적 예시이다.

---

## 1. 입력

Skill은 Figma snapshot/diff 대신 다음 두 파일을 입력으로 받는다:

- `design-systems/apple/apple-tokens.json` (현 상태 토큰 정의)
- `design-systems/apple/token-mapping.md` (UNO ↔ Apple 대응표 + 리스크 표)

선택적으로 두 시점의 `apple-tokens.json`을 비교한 delta를 줘서 "변경된 항목"만 분류할 수도 있다. 본 예시는 "현 상태를 처음 한 번 정리하는" 시나리오를 다룬다.

## 2. 실행

```bash
npm run figma:claude-review -- --source apple
```

이 명령은 `scripts/pipeline/claude-review.ts`가 `.claude/skills/apple-design-system/SKILL.md`의 결정 규칙을 적용해 markdown 리포트를 생성한다.

산출물 위치: `.automation/reports/claude-review-apple-<ts>.md`

## 3. 출력 (실제 생성된 예시 — 2026-05-20)

```markdown
# Claude review report — Apple-inspired track

> Generated: 2026-05-20T00-28-19
> Skill: `.claude/skills/apple-design-system/SKILL.md`
> Apple-inspired only. Not official Apple Design System. Not affiliated with Apple Inc.

## Auto-applied (0 items)

- _no items_ (Apple track has no Figma node bindings yet)

## Claude review checklist (4 items)

- [ ] **apple.component.button.primaryBlue → src/components/Button.tsx** (component-props)
  - Why this needs review: New Apple primary variant uses `--apple-color-blue` (#0071e3); UNO uses `--color-neutral-950`. Both can coexist as namespaced variants.
  - Suggested developer action: Add a new `variant="apple-primary"` to Button.tsx that reads `--apple-color-blue` + radius `--apple-radius-standard`.
  - Rollback: Remove the `apple-primary` branch from Button.tsx; no shared token touched.

- [ ] **apple.component.card.productTile → src/components/Card.tsx** (component-props)
  - Why this needs review: Light gray surface (`--apple-color-light-gray`) + rare shadow (`--apple-shadow-card`). UNO Card already uses `--background-card`. Decide whether to add an `apple-tile` variant.
  - Suggested developer action: Extend Card.tsx with a `surface="apple-tile"` prop wired to `--apple-color-light-gray`. Keep default surface unchanged.
  - Rollback: Remove the `apple-tile` branch.

- [ ] **apple.typography.roles.displayHero → presentation hero only** (text)
  - Why this needs review: 56px / 600 weight headline is not used in any current UNO screen. Suitable for a presentation hero, not for product screens.
  - Suggested developer action: Create a one-off demo route (e.g. `src/screens/AppleDemoHero.tsx`) that uses Apple typography for the presentation; do NOT touch existing UNO typography classes.
  - Rollback: Delete the demo route file.

- [ ] **apple.typography.fontFamily.display → projectFallback** (token)
  - Why this needs review: `display` value leads with "SF Pro Display, SF Pro Icons". SF Pro Icons is Apple-proprietary. Code should use `projectFallback` (Inter-led).
  - Suggested developer action: When emitting `--apple-font-display` CSS, prefer the `projectFallback` value from apple-tokens.json. Keep the SF Pro chain as a comment-only reference.
  - Rollback: Restore the SF Pro chain in any consuming CSS file.

## Human review required (3 items)

- **apple.component.navigation.glass** (structure)
  - Why blocked: Backdrop-filter glass nav is a new layout pattern, not present in UNO.
  - Manual action: Designer + PM decide whether to introduce. If yes, scope to one demo screen only.

- **Status color overlap (UNO red/yellow/green vs Apple single-blue accent)** (token)
  - Why blocked: Apple single-accent philosophy conflicts with UNO health/state semantics.
  - Manual action: Keep UNO status tokens authoritative; Apple track CTA/hero only.

- **Full-app redesign suggestion** (structure)
  - Why blocked: Listed in apple-tokens.json `automationPolicy.requiresHumanReview`.
  - Manual action: Explicitly out of scope for this experiment.

---

Source: Markdown reference at `awesome-design-md/design-md/apple/DESIGN.md` — not affiliated with Apple Inc.
```

## 4. 발표 설명 (한 줄)

`apple-tokens.json` 안의 모든 정의가 자동으로 3-band 체크리스트가 되고, 4건은 개발자가 즉시 결정할 수 있는 액션이고 3건은 사람 검토가 필요한 정책 충돌이라는 것이 한 화면에 정리된다.

## 5. 다음 단계와의 연결

이 체크리스트의 1·2번 항목(Button apple-primary, Card apple-tile)이 Phase 4에서 실제 코드로 구현되는 후보다. 디자이너가 체크 표시한 항목만 Phase 4 작업 범위에 포함시키는 것이 본 실험의 운영 흐름이다.
