# Phase 7 quick handoff

Canonical Phase 7 plan: [`phase-plan-7.md`](./phase-plan-7.md).

이 파일은 사용자가 요청한 `plan-7.md` 경로용 빠른 진입 문서다. 중복 source of truth를 피하기 위해 세부 계획은 `phase-plan-7.md`에서 유지한다.

## 현재 반영된 내용

- 2026-05-20 Phase 6 task-7에서 추출-friendly env override를 선적용했다.
- Phase 7 CLI/init wizard는 아래 env var를 템플릿 질문으로 승격하면 된다.

| Env var | 목적 |
|---|---|
| `FIGMA_FILE_KEY` | 사용자 Figma 파일 키 |
| `FIGMA_CONFIG_DIR` | config 위치 |
| `FIGMA_VERIFY_BUILD_CMD` / `FIGMA_VERIFY_LINT_CMD` | 프로젝트별 검증 명령 |
| `FIGMA_VERIFY_PORT` / `FIGMA_PROMOTE_PORT` | preview/promote 포트 |
| `FIGMA_VERIFY_VIEWPORT_WIDTH` / `FIGMA_VERIFY_VIEWPORT_HEIGHT` | visual diff viewport |
| `FIGMA_SMOKE_KEYS` | smoke target keys |

## 아직 Phase 7에서 해야 할 것

- mapping/template 생성
- marker guide 및 변환 도구
- npm package/CLI 분리
- 새 Vite 프로젝트 dogfood 검증
- uno-home 자체를 첫 reference implementation으로 재마이그레이션
