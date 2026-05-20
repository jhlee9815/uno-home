# 보완 작업 트랙 (2026-05-20)

> Codex–Claude 합의 결과로 도출된 5개 보완 작업. 발표 신뢰도 + 검증 가능성 보강 목적.
> 본 트랙은 Apple-inspired DS Phase 트랙(project-plan/phase-1~5)과 별도로 운영.

## 합의 근거

- 진단: 파이프라인(uno-home)은 build/lint/preflight 모두 PASS, 186 mapping, 175 report-only / 8 partial / 4 auto. 그러나 발표 핵심 주장인 **"Design System Skill이 변경을 개발 체크리스트로 번역"**을 시연할 코드/Skill 파일이 0건.
- 결정: 점수 보정 — 기술 데모 60~65, 발표 75~80 (한계 인정 프레이밍 전제).
- Skill 부재는 gap이 아니라 **블로커**로 격상.

## 보완 5종 (실행 순서)

| # | 작업 | 담당 | 예상 | 상태 |
|---|---|---|---|:---:|
| ① | `uno-home/` git init + 초기 커밋 | Claude | 30분 | ✅ 완료 (2026-05-20) |
| ②-a | `.claude/skills/uno-design-system/SKILL.md` 작성 (블로커) | Claude | 1h | ✅ 완료 (2026-05-20) |
| ②-b | `.claude/skills/apple-design-system/SKILL.md` 작성 (블로커) | Claude | 30분 | ✅ 완료 (2026-05-20) |
| ③ | `scripts/pipeline/claude-review.ts` wrapper + npm script (블로커) | Claude | 2h | ✅ 완료 (2026-05-20) |
| ④ | minimal-test BottomNavBar 결정 + verifier 1패스 | Claude | 30분 | ✅ 완료 (2026-05-20) |
| ⑤ | `cs-{id}.md` 모범 리포트 1건 정제 | Claude | 1h | ✅ 완료 (2026-05-20) |

**전체 진행도: 5/5 완료 (100%)**

## 의존성

- ③ ← ② (wrapper가 Skill을 호출)
- ⑤ ← ②③ (모범 리포트에 Skill 출력 + wrapper 출력 통합)
- ① ④는 독립

## ③ claude-review.ts wrapper 완료 기록 (2026-05-20)

- 위치: `scripts/pipeline/claude-review.ts`
- npm script: `figma:claude-review` (package.json)
- 입력: `--source uno|apple` (default uno) / `--input <path>` / `--output <path>`
- 동작:
  - UNO 모드: 최신 `.automation/diffs/*-classified.json`을 읽어 SKILL.md 결정 규칙으로 3-band 분류 → markdown 출력
  - Apple 모드: `design-systems/apple/apple-tokens.json` + `token-mapping.md` 참조해 표본 markdown 출력
- 산출물 위치: `.automation/reports/claude-review-{uno|apple}-<ts>.md`
- 구현 정책: deterministic encoding (LLM API 호출 없음). `--use-claude` 플래그는 후속(현재 TODO 주석).
- 검증:
  - `npm run figma:claude-review` 실행 → UNO 리포트 생성 PASS (2 changes 분류)
  - `npm run figma:claude-review -- --source apple` 실행 → Apple 리포트 생성 PASS (4 Claude / 3 Human)
  - `npm run build` PASS, `npm run lint` PASS

## ⑤ 모범 리포트 완료 기록 (2026-05-20)

- 위치 (커밋 가능): `project-plan/supplementary-2026-05-20/sample-cs-report.md`
- 사본 (실제 .automation/ 위치 — gitignore 됨): `.automation/reports/cs-sample-presentation-2026-05-20.md`
- 구성: 7섹션 — 한눈에 / 자동 반영 / Claude 분석 체크리스트 / 사람 검토 / 검증 결과 / 관련 산출물 / 발표 노트
- 자동 1건 + Claude 2건(illustrative) + 사람 1건으로 3-band 모두 채움
- 실 데이터 출처: `cs-2026-05-07T06-43-49` (classified diff) + 본 보완 트랙에서 생성된 `claude-review-uno-2026-05-20T00-28-19.md`
- 발표 노트(§6)에 "한계 정직 공개" 5항목 포함 — Codex 검증 합의대로 한계 인정 프레이밍 유지

## ② SKILL.md 완료 기록 (2026-05-20)

두 Skill 모두 동일 스키마 — 3섹션 출력(Auto-applied / Claude review checklist / Human review required).

- `.claude/skills/uno-design-system/SKILL.md` (UNO Figma 트랙용)
  - 입력: classified diff JSON + `figma-mapping.yaml` + `src/index.css` + `src/components/`
  - 결정 규칙표: 11행 (auto-apply 통과 / token report-only / text by section / component-props / layout-structure / asset-unknown / unmapped)
  - UNO 토큰 명칭 정책: `--color-*`, `--background-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `text-mobile-*`
  - 12개 컴포넌트 커버리지 표 + BottomNav 미구현 예외
  - 시나리오 예시 2건 (auto-apply, token-out-of-system)
- `.claude/skills/apple-design-system/SKILL.md` (Apple-inspired 트랙용)
  - 입력: `design-systems/apple/apple-tokens.json` + `token-mapping.md` (Figma diff 없음 — Skill이 직접 분류기 역할)
  - 결정 규칙표: 10행
  - Apple 토큰 명칭 정책: `apple.*` JSON 경로 + `--apple-*` CSS 변수 + SF Pro 직접 푸시 금지
  - 6개 Apple 컴포넌트 ↔ UNO 컴포넌트 매핑 + 디스클레이머 강제
  - Cross-track: Apple 변경은 절대 `src/index.css` 덮어쓰지 않음, `design-systems/apple/apple-tokens.css` 어댑터에 격리

검증:
- `npm run build` PASS (vite 8.0.10, 1751 modules, 136ms, dist/ 생성)
- `npm run lint` PASS (eslint, 0 errors)
- Skill 파일 자체는 정적 markdown이므로 별도 unit test 없음. 동작 검증은 ③ wrapper에서 end-to-end로 한다.

## ④ minimal-test BottomNavBar 결정 + verifier 1패스 (2026-05-20)

- 결정: **현재 상태 유지** (350×72 pill, `--base-white` 배경, `--color-neutral-900` 활성 칩).
- 근거: 사용자 선택. uno-home Figma에 실재하는 변경이라 별도 원복 불필요.
- verifier 1패스: `npm run build` PASS + `npm run lint` PASS (위와 동일 실행분).
- 후속: minimal-test의 직전 세션 미해결 항목 닫힘 — `../minimal-test/test_handoff.md`에도 결정 기록.
- 다만 향후 정식 Figma pipeline 재검증(snapshot→diff→classify→approve→promote)을 도는 게 안전하지만, 본 보완 트랙의 범위 외이므로 별도 사이클로 분리한다.

## ① git init 완료 기록 (2026-05-20)

- 위치: `/Users/juhee/Work/Test/design-test/uno-home/`
- 브랜치: `main`
- 첫 커밋: `e499bbe chore: initial commit (snapshot 2026-05-20)`
- 추가된 .gitignore 항목: `.omc/` (편집기/세션 캐시)
- 커밋 제외: `node_modules`, `dist`, `dist-dev`, `.env`, `.automation/{snapshots,diffs,reports,logs,baseline,backups}`, `.omc/`
- 커밋 파일 수: 189
- 검증: `git log --oneline` → 1 commit, working tree clean
