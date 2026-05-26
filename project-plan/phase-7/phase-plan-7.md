# Phase 7 — Phase B: GitHub 템플릿 + 얇은 CLI로 추출

> 시작 조건: Phase 6 완료 + 2주 안정 운영 + 디자이너/개발자 1명씩 실 사용
> 목표: "다른 팀이 fork해서 자기 Figma 파일 / 자기 React 프로젝트에 적용 가능"
> 예상 분량: 1~2주
> 의사결정 근거: Codex consult `019e4407-9f23`의 권고 — "GitHub template + thin CLI = MVP reusable path"
> 최신 갱신: 2026-05-20 16:58 KST — Phase 6 task-7 env override를 Phase 7 추출 선행 조건으로 반영

## 7-0. 한 줄 요약

> uno-home repo의 figma-pipeline을 **`@your-org/figma-design-sync` GitHub 템플릿 + `npx figma-design-sync init` CLI**로 추출. 다른 팀이 fork → `init` 실행 → 자기 토큰/파일/매핑 입력 → 자기 GitHub Actions 동작.

## 7-1. 시작 조건 체크리스트

Phase 7 진입 전 모두 ✅ 되어야 함:

- [ ] Phase 6 완료 정의 7개 항목 전부 done
- [ ] 2주 이상 실 운영 (webhook trigger 100건+, cron trigger 200건+ 누적)
- [ ] 디자이너 1명이 적어도 한 사이클(Figma 편집 → PR/Issue 생성 → 코멘트) 경험
- [ ] 개발자 1명이 designer-bot PR 머지 경험
- [ ] 영역 침범 우려 사후 점검 — 실제 문제 발생 없음
- [ ] Phase 6에서 적용된 env var override (`FIGMA_FILE_KEY`, `FIGMA_CONFIG_DIR`, `FIGMA_VERIFY_*`, `FIGMA_PROMOTE_PORT`, `FIGMA_SMOKE_KEYS`) 안정 동작 확인

조건 미충족 시 Phase 7 진입 보류 + Phase 6 안정화 우선.

## 7-2. Codex의 in-scope / out-of-scope (그대로 채택)

### In-scope (Phase 7에서 함)

- `npx figma-design-sync init` 스캐폴드 명령
  - copies `scripts/pipeline/` 묶음
  - generates `config/figma.yaml` 템플릿
  - generates `.github/workflows/figma-pipeline.yml`
  - generates `CODEOWNERS`, PR/Issue 템플릿
- CLI 옵션: `--figma-file`, `--project-name`, `--app-type vite|next|custom`
- 설정 명령: build/lint/preview/port/viewport (Phase 6 env vars 그대로 재활용)
- 생성된 GitHub Actions에 secrets 가이드 자동 안내
- `register-file`과 `marker-candidates` 명령을 onboarding 단계로 문서화
- **default: report-only**. auto-apply는 명시적 마커 부착 후에만.

### Out-of-scope (Phase 7에서 안 함, 별도 검토)

- ❌ Hosted SaaS (Phase 8?)
- ❌ Multi-tenant secrets management
- ❌ 임의 React/Vue/Svelte 자동 편집
- ❌ Figma → 코드 완전 자동 binding
- ❌ Visual equivalence 보장
- ❌ 네이티브 (iOS/Android) 앱 지원


## 7-2-A. Phase 6 task-7에서 이미 선납한 추출 기반

Phase 7의 canonical 문서는 `phase-plan-7.md`다. 사용자가 요청한 `plan-7.md`는 빠른 handoff/index 파일로만 유지하고, 세부 source of truth는 이 파일에 둔다.

2026-05-20 task-7에서 Phase 7 비용을 줄이기 위해 다음 하드코딩을 env override로 추출했다. 이 값들은 `npx figma-design-sync init`이 생성할 설정 질문/템플릿의 1차 후보가 된다.

| Env var | 현재 기본값 | Phase 7 의미 |
|---|---|---|
| `FIGMA_FILE_KEY` | `config/figma.yaml` 값 | 사용자의 Figma 파일 키를 CI/로컬에서 주입 |
| `FIGMA_CONFIG_DIR` | `config/` | 템플릿/패키지 분리 후 config 위치 주입 |
| `FIGMA_VERIFY_BUILD_CMD` | `npm run build` | Vite/Next/custom build command 설정 |
| `FIGMA_VERIFY_LINT_CMD` | `npm run lint` | 프로젝트별 lint/typecheck command 설정 |
| `FIGMA_VERIFY_PORT` | `4173` | preview server 포트 충돌 방지 |
| `FIGMA_VERIFY_VIEWPORT_WIDTH` | `390` | 프로젝트별 visual diff viewport |
| `FIGMA_VERIFY_VIEWPORT_HEIGHT` | `844` | 프로젝트별 visual diff viewport |
| `FIGMA_PROMOTE_PORT` | `4174` | promote-dev preview 포트 충돌 방지 |
| `FIGMA_SMOKE_KEYS` | `pesse_home,pesse_cards,pesse_send` | 프로젝트별 smoke target 선택 |
| `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | `true` | GitHub Actions Node 24 전환 사전 대응 |

Phase 7 CLI 질문 후보:

1. Figma file key 또는 URL
2. config directory
3. build/lint command
4. preview/promote port
5. viewport width/height
6. smoke target keys
7. default mode: report-only 또는 marker-gated auto-apply

주의: task-7은 **하드코딩 해소의 일부**일 뿐이다. mapping 생성, marker 변환, package name 분리, framework별 visual target 전략은 여전히 Phase 7 본 작업이다.

## 7-3. 단계별 작업 (스케치 — Phase 6 끝나면 세부화)

| # | 작업 | 예상 |
|:-:|---|---|
| 1 | `scripts/pipeline/` → npm 패키지 분리 (`packages/figma-pipeline/`) | 2일 |
| 2 | `cli/` 폴더 + `bin/figma-design-sync.ts` 진입점 + commander 기반 명령 | 2일 |
| 3 | `templates/` 폴더 — `config/`, `.github/workflows/`, `CODEOWNERS` 등 스캐폴드 자원 | 1일 |
| 4 | Codex 차단점 ②(매핑), ④(마커), ⑥(viewport), ⑨(package) 해소 | 2일 |
| 5 | `figma-design-sync init` 인터랙티브 wizard (`inquirer` 사용) | 1일 |
| 6 | `figma-design-sync register-file` `marker-candidates` 명령 분리 | 1일 |
| 7 | Docs: README, getting-started, marker-guide, troubleshooting | 1일 |
| 8 | Demo: 빈 React-Vite repo에 npx 적용 → 동작 확인 | 1일 |
| 9 | (선택) Claude Skill 작성 — onboarding을 Claude로 가이드 | 1일 |

## 7-4. 패키지 구조 (목표)

```
@your-org/figma-design-sync/
├── packages/
│   └── figma-pipeline/      # 코어 파이프라인 (snapshot/diff/classify/apply/verify/report/promote)
├── cli/
│   ├── bin/figma-design-sync.ts
│   └── src/
│       ├── commands/init.ts
│       ├── commands/register-file.ts
│       ├── commands/marker-candidates.ts
│       └── lib/
├── templates/
│   ├── config/figma.yaml.tpl
│   ├── config/figma-mapping.yaml.tpl
│   ├── .github/workflows/figma-pipeline.yml.tpl
│   ├── CODEOWNERS.tpl
│   └── .github/ISSUE_TEMPLATE/designer-review.md
├── docs/
│   ├── getting-started.md
│   ├── marker-guide.md
│   ├── governance.md
│   └── troubleshooting.md
├── package.json    # name: @your-org/figma-design-sync, bin: figma-design-sync
└── README.md
```

## 7-5. 마이그레이션 가이드 (uno-home → 템플릿 사용)

Phase 7 완료 후, uno-home 자신을 템플릿의 첫 reference impl로 변환:

```bash
# uno-home repo에서
npx figma-design-sync init --migrate-from-legacy
# 1. 기존 scripts/pipeline/ → packages/figma-pipeline/ 로 symlink 또는 dep 전환
# 2. 기존 config 유지 (이미 호환)
# 3. workflow 파일 재생성 (멱등)
```

이게 동작하면 "uno-home은 figma-design-sync의 dogfooding repo"가 됨.

## 7-6. 검증

- [ ] 새 빈 Vite 프로젝트에 `npx figma-design-sync init` → 30분 내 setup 완료
- [ ] 새 프로젝트에서 first `npm run figma:run` PASS
- [ ] 새 프로젝트에서 `register-file` + `marker-candidates` 동작
- [ ] 새 프로젝트에서 GitHub Actions trigger → PR 생성 동작
- [ ] uno-home 자신이 마이그레이션해도 기존 동작 깨지지 않음

## 7-7. 배포 계획

- npm public publish: `@your-org/figma-design-sync`
- GitHub template repo 별도: `github.com/your-org/figma-design-sync-template`
- v0.x.x로 시작 (alpha 명시)
- 사용자 피드백 받을 채널 (GitHub Issues + 사내 Slack)

## 7-8. 한계 (정직 공개 — Phase 7 완료 후에도 남는 것)

- 마커 부착은 여전히 수동 작업
- React가 아닌 프레임워크는 verify 명령만 가능, 자동 patch는 React만
- 디자이너가 무리하게 layout 변경하면 여전히 report-only
- visual equivalence는 보장 안 됨 (작업자 검토 필요)

## 7-9. 후속 (Phase 8 후보)

만약 Phase 7가 검증되면:

- **Claude Skill 본격화**: onboarding을 Claude가 가이드
- **Hosted SaaS 검토**: 외부 수요가 있을 때만
- **다른 프레임워크 지원**: Vue/Svelte/SolidJS의 verify hook
- **AI 보조 마커 제안**: 코드/Figma 토폴로지로 마커 자동 후보 제안

## 참고

- 운영 상태: [`../../STATUS.md`](../../STATUS.md)
- Phase 6 (완료) 히스토리: `git log -- project-plan/phase-6/phase-plan-6.md` 또는 PR #135-#142 커밋 로그
- Codex 검증 세션: `019e4407-9f23-7190-b963-60fd7ba11d4b`
