# UNO HOME × Apple-inspired Design System 실험 계획

> 작성일: 2026-05-20  
> 최신 갱신: 2026-05-20 (Phase 1·2 완료 / Phase 3 진행 전 보완 작업 트랙 추가)  
> 프로젝트 위치: `/Users/juhee/Work/Test/design-test/uno-home`  
> 외부 디자인 시스템 입력: `/Users/juhee/Work/Test/awesome-design-md/design-md/apple`  
> 기준 전략: **기존 Figma 자동화 파이프라인은 보존하고, Apple-inspired DESIGN.md를 외부 디자인 시스템 입력값으로 등록해 토큰/컴포넌트 변환 가능성을 검증한다.**

## 0-A. 현재 진행 요약 (한눈에)

- **Apple-inspired DS 트랙**: Phase 1 ✅ / Phase 2 ✅ / Phase 3 ✅ (Codex outline + Claude SKILL.md + checklist-example.md 정합 완료) / Phase 4 ✅ (Button apple-variants + AppleCard + AppleDemoScreen) / Phase 5 ✅ (presentation-report.md 초안)
- **보완 작업 트랙 (Claude–Codex 합의, 2026-05-20)**: 5/5 완료. 세부 §8 참조
- **블로커**: 없음 ✅
- **전체 완료율**: 메인 트랙 5/5 (100% — Phase 5는 초안 단계, Codex 결과 도착 시 §5·§9 정합성 재확인), 보완 트랙 5/5 (100%)
- **다음 액션 (Codex 1시 이후 재개 시)**: Codex의 Apple Phase 3 산출물과 우리 SKILL.md/checklist-example.md 일치 여부 5분 검토 → 일치하면 presentation-report 확정 → 불일치하면 정합성 보정 후 확정.
- **발표 데모 한 줄**: `npm run figma:claude-review` (UNO 트랙) / `npm run figma:claude-review -- --source apple` (Apple 트랙) / `npm run dev` → App.tsx 하단 "Phase 4 — Apple-inspired Adapter Demo" 섹션 시각 확인

---

## 0. 프로젝트 목표

현재 자체 UNO 디자인 시스템은 수정 중이므로, 발표/실험 안정성을 위해 Apple-inspired 외부 디자인 시스템을 별도 입력으로 잡고 다음을 검증한다.

1. Markdown 기반 디자인 시스템(`DESIGN.md`)을 코드가 이해할 수 있는 토큰/컴포넌트 규칙으로 정리할 수 있는가?
2. 정리된 외부 DS를 기존 React/Vite 프로젝트의 토큰·컴포넌트에 안전하게 연결할 수 있는가?
3. 기존 Figma `snapshot → diff → classify → report` 자동화 파이프라인과 충돌하지 않고 “개발 전달 체크리스트”를 만들 수 있는가?
4. 발표에서는 과장 없이 “완전 자동 개발 반영”이 아니라 **디자인 시스템 변경 감지/분류/개발 전달 자동화 실험**으로 설명할 수 있는가?

---

## 1. 핵심 원칙

- **교체가 아니라 분리 실험**: 기존 UNO Figma 자동화 증거와 baseline은 보존한다.
- **Apple DS는 공식 Apple DS가 아님**: `awesome-design-md`의 Apple-inspired 참고 자료로 표기한다.
- **Figma 자동화와 Markdown DS를 혼동하지 않음**: Markdown DS는 토큰/컴포넌트 규칙 입력이고, Figma node 기반 자동화는 별도 레이어다.
- **작은 end-to-end 증거 우선**: 전체 앱 리디자인보다 Button/Card/Hero 같은 대표 단위 2~3개를 검증한다.
- **report-only를 실패가 아니라 안전장치로 설명**: 자동 적용 불가 항목은 Claude/사람 검토 체크리스트로 전달한다.

---

## 2. 현재 근거 상태

| 항목 | 현재 상태 |
|---|---|
| 메인 앱 | React + TypeScript + Vite, `uno-home` |
| 기존 자동화 | `figma:preflight/snapshot/diff/classify/apply/verify/report/run` 스크립트 존재 |
| 기존 Figma 파일 | `SXPVingkmqkrcLzcXYFsZd` |
| 기존 mapping | `config/figma-mapping.yaml` |
| 기존 mapping 규모 | components 6, compositions 7, screens 173, 총 186 bindings |
| 기존 정책 | 대부분 report-only, 일부 auto/partial |
| 기존 최신 baseline | `.automation/baseline/2026-05-07T00-10-23.json` |
| 외부 DS 후보 | `awesome-design-md/design-md/apple/DESIGN.md` |
| 외부 DS 성격 | Markdown/HTML 기반 Apple-inspired 스타일 가이드, Figma node 없음 |

---

## 3. 단계별 진행 계획

| 단계 | 폴더 | 목표 | 완료 조건 | 상태 |
|---|---|---|---|:-:|
| 1단계 | `project-plan/phase-1/` | 현 상태 고정, 불필요 파일 정리, Apple DS 입력 등록 | 현재 상태 문서화 + Apple source index + 안전 정리 완료 | ✅ |
| 2단계 | `project-plan/phase-2/` | Apple DS 토큰 후보 추출 | `design-systems/apple/apple-tokens.json` 초안 + 토큰 매핑표 작성 | ✅ |
| 3단계 | `project-plan/phase-3/` | Apple DS Skill/운영 가이드 명시화 | `.claude/skills/apple-design-system/SKILL.md` + `design-systems/apple/checklist-example.md` | ✅ (Codex 정합성 확인 대기) |
| 4단계 | `project-plan/phase-4/` | 대표 컴포넌트 2~3개 적용 실험 | Button/Card/Hero 중 최소 2개에 adapter 적용, build/lint 통과 | ✅ (Button apple-primary·apple-pill-link + AppleCard 2개) |
| 5단계 | `project-plan/phase-5/` | 발표/검증 리포트 완성 | before/after, 자동/Claude/사람검토 분류, 한계/다음 단계 리포트 작성 | ✅ (초안 — `presentation-report.md`) |

---

## 4. 우선순위

1. **현재 프로젝트 상태 고정** — 기존 자동화가 동작했다는 증거를 잃지 않는다.
2. **Apple DS 입력 등록** — 원본을 그대로 덮어쓰지 않고 별도 `design-systems/apple/` 아래에 연결한다.
3. **토큰 후보 추출** — 색상/타입/radius/shadow/spacing만 먼저 구조화한다.
4. **Design System Skill 명시화** — 발표에서 말하는 “Skill이 변경을 개발 체크리스트로 번역”하는 실체를 만든다.
5. **작은 컴포넌트 실험** — Button/Card/Hero 정도만 end-to-end로 증명한다.

---

## 5. 삭제/정리 정책

즉시 삭제 가능한 것은 다음처럼 **재생성 가능하거나 명백한 임시 산출물**에 한정한다.

- `.DS_Store`
- 루트의 임시 비교 스크린샷: `bottomnav-*.png`, `compare-before-after.png`, `minimal-test-after.png`
- `.playwright-mcp/`의 과거 브라우저 로그/스냅샷
- `.omc/` HUD 캐시

보존한다.

- `src/`, `scripts/`, `config/`, `tokens.json`, `design-system.md`
- `.automation/baseline/` 최신 baseline과 파이프라인 산출물
- 기존 `phase1`~`phase7` 이력 문서
- `.env` 내용은 열람/출력하지 않음

---

## 6. 검증 방법

각 단계 종료 시 최소 검증:

```bash
npm run figma:preflight
npm run build
npm run lint
```

컴포넌트 적용 단계부터는 추가로 관련 figma 테스트를 실행한다.

```bash
npm run figma:test:classify
npm run figma:test:apply-code
npm run figma:test:report-only
npm run figma:test:designer-review
```

---

## 7. 발표용 최종 문장

> 이 프로젝트는 Apple-inspired Markdown 디자인 시스템을 외부 입력값으로 등록하고, 이를 토큰/컴포넌트/개발 체크리스트로 변환해 기존 Figma 변경 감지 파이프라인과 연결 가능한지 검증하는 실험입니다. 완전 자동 코드 반영이 아니라, 자동 감지 가능한 항목과 Claude 요약/사람 검토가 필요한 항목을 분리해 개발 전달 비용을 줄이는 것이 목표입니다.

---

## 8. 보완 작업 트랙 (2026-05-20)

> 세부 진행 기록: [`project-plan/supplementary-2026-05-20/README.md`](./project-plan/supplementary-2026-05-20/README.md)
> 도출 근거: Claude–Codex 교차 검증 (기술 데모 60~65, 발표 75~80 — Skill 부재 = 블로커)

| # | 작업 | 담당 | 의존 | 상태 |
|---|---|---|---|:-:|
| ① | `uno-home/` git init + 초기 커밋 | Claude | — | ✅ 2026-05-20 (`e499bbe`) |
| ②-a | `.claude/skills/uno-design-system/SKILL.md` (**블로커**) | Claude | — | ✅ 2026-05-20 |
| ②-b | `.claude/skills/apple-design-system/SKILL.md` (**블로커**) | Claude | — | ✅ 2026-05-20 |
| ③ | `scripts/pipeline/claude-review.ts` + `npm run figma:claude-review` (**블로커**) | Claude | ② | ✅ 2026-05-20 |
| ④ | minimal-test BottomNavBar 결정 + verifier 1패스 | Claude | 사용자 결정 | ✅ 2026-05-20 (현 상태 유지) |
| ⑤ | `cs-{id}.md` 모범 리포트 1건 정제 | Claude | ②③ | ✅ 2026-05-20 |

**다음 진입점**: 보완 트랙 종료. 메인 트랙 Phase 3 (Codex) 결과 도착 시 Phase 4로 진입.
