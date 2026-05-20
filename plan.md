# UNO HOME × Apple-inspired Design System 실험 계획

> 작성일: 2026-05-20
> 최신 갱신: 2026-05-20 20:20 KST (Phase 6 task-1/2/3/7 ✅, 다음 task-4)
> 프로젝트 위치: `/Users/juhee/Work/Test/design-test/uno-home`
> 외부 디자인 시스템 입력: `/Users/juhee/Work/Test/awesome-design-md/design-md/apple`

## 0. 한눈에 보는 현 상태

| 트랙 | 상태 | 위치 |
|---|:-:|---|
| Phase 1~5 (Apple DS 메인 트랙) | ✅ 완료 | `project-plan/archive/` |
| 보완 작업 (Claude–Codex 합의) | ✅ 완료 (5/5) | `project-plan/archive/supplementary-2026-05-20/` |
| Pesse 라이브 데모 트랙 | ✅ 완료 (7/7 + 확장 3건) | `project-plan/archive/pesse-demo/` |
| **데모 검증 사이클** | **✅ 완료 (2026-05-20)** | `.automation/demo-compare/` |
| **Codex consult 검증** | **✅ 완료 (`019e4407-9f23`)** | — |
| **Phase 6 — Phase A 실서비스화** | **🚧 진행 중: task-1/2/3/7 ✅, task-4/5/6 남음** | `project-plan/phase-6/` |
| **Phase 7 — Phase B 재사용 추출** | **⏳ Phase 6 종료 후** | `project-plan/phase-7/` |

**현재 액션**: **task-4 CODEOWNERS + PR/Issue 거버넌스**. CODEOWNERS에 들어갈 GitHub username 확정 필요.
**블로커**: 기술 블로커 없음. Slack webhook/Cloudflare/Resend는 외부 준비가 필요할 때까지 env 미설정 skip 방식.
**보류 항목**: 다른 팀 공유는 Phase 7 완료 전까지 금지 (Codex 권고).

---

## 1. 프로젝트 목표 (장기)

1. ✅ Markdown 디자인 시스템(`DESIGN.md`)을 토큰/컴포넌트 규칙으로 코드화 가능한가?
2. ✅ 정리된 외부 DS를 기존 React/Vite 프로젝트의 토큰/컴포넌트에 안전 연결 가능한가?
3. ✅ Figma `snapshot → diff → classify → report` 파이프라인과 충돌 없이 "개발 전달 체크리스트" 생성 가능한가?
4. ✅ 발표에서 과장 없이 "변경 감지/분류/전달 자동화 실험"으로 설명 가능한가?
5. ⏳ **(신규)** 이 파이프라인을 24/7 동작하는 GitHub Actions 서비스로 만들 수 있는가? **→ Phase 6**
6. ⏳ **(신규)** 다른 팀이 fork해서 자기 프로젝트에 적용 가능한 재사용 도구로 추출 가능한가? **→ Phase 7**

목표 1~4는 archive 트랙에서 완료. 5~6은 Codex 검증 후 신규 채택.

---

## 2. 핵심 원칙 (현재까지)

- **교체가 아니라 분리 실험**: 기존 UNO 자동화는 백업 보존.
- **Apple DS는 비공식 Apple DS**: "Apple-inspired only · Not affiliated" 디스클레이머 유지.
- **작은 end-to-end 우선**: 대표 단위 2~3개로 검증.
- **report-only는 안전장치**: 자동 불가 항목은 사람 검토 체크리스트로.
- **(신규)** **다른 팀 공유 전 검증 필수**: Phase 6 완료 + 2주 안정 운영 후 Phase 7. Codex 권고.

---

## 3. 단계 인덱스 (메인 로드맵)

| 단계 | 위치 | 상태 |
|---|---|:-:|
| Phase 1~5 (Apple-inspired DS) | [`project-plan/archive/`](./project-plan/archive/README.md) | ✅ |
| Phase 6 — 이 repo 실서비스화 (extraction-friendly) | [`project-plan/phase-6/`](./project-plan/phase-6/phase-plan-6.md) | 🚧 |
| Phase 7 — 재사용 GitHub 템플릿 + CLI 추출 | [`project-plan/phase-7/`](./project-plan/phase-7/phase-plan-7.md) | ⏳ 대기 (`plan-7.md` quick handoff 추가) |

---

## 4. Phase 6 작업 인덱스 (지금 진행할 것)

| # | 작업 | 상태 | 세부 |
|:-:|---|:-:|---|
| 1 | GitHub Remote init + 초기 push | ✅ | [`task-1-github-init.md`](./project-plan/phase-6/task-1-github-init.md) |
| 2 | `.github/workflows/figma-pipeline.yml` 작성 | ✅ | [`task-2-actions-workflow.md`](./project-plan/phase-6/task-2-actions-workflow.md) |
| 3 | `post-run-actions.ts` 라우팅 스크립트 (PR/Issue/Slack/Email) | ✅ V1~V4 실검증 통과 (V5 task-4 이후) | [`task-3-post-run-actions.md`](./project-plan/phase-6/task-3-post-run-actions.md) |
| 4 | CODEOWNERS + PR/Issue 거버넌스 | ⏳ | [`task-4-codeowners-governance.md`](./project-plan/phase-6/task-4-codeowners-governance.md) |
| 5 | Cloudflare Worker Figma webhook 프록시 | ⏳ | [`task-5-webhook-proxy.md`](./project-plan/phase-6/task-5-webhook-proxy.md) |
| 6 | Resend 이메일 통합 | ⏳ | [`task-6-email-resend.md`](./project-plan/phase-6/task-6-email-resend.md) |
| 7 | Codex 발견 버그 수정 + env var 추출 + Node 24 강제 | ✅ | [`task-7-bugfixes.md`](./project-plan/phase-6/task-7-bugfixes.md) |

총 예상: ~6.5~8시간 (2~3일 분량). 현재 task-1/2/3/7 ✅. 잔여는 task-4/5/6.

### 2026-05-20 16:58 KST — Codex 병렬 진행 기록

- Claude는 task-3 도중 토큰 소진으로 중단했다. 남은 uncommitted 변경: `package.json`, `package-lock.json`, `scripts/pipeline/post-run-actions.ts`.
- Codex는 task-3 dry-run 안전성을 보강했고 `cs-2026-05-20T05-48-54`로 외부 호출 없는 dry-run PASS를 확인했다.
- task-7 변경: `promote-dev.ts`, `verify.ts`, `config-loader.ts`, `.github/workflows/figma-pipeline.yml`.
- 검증: `npm run build`, `npm run lint`, `npm run figma:preflight`, env override preflight, `npx tsc --noEmit`, post-run dry-run 모두 PASS.
- `project-plan/phase-7/plan-7.md`는 빠른 진입 문서로 생성했고, 실제 source of truth는 `phase-plan-7.md`로 유지한다.

### 2026-05-20 20:20 KST — task-3 ✅ 실검증 완료

- Claude가 task-3을 이어서 V1~V4 실 GitHub API 검증 완료. Codex 2회 review (`session 019e4514-e802`) 둘 다 PASS.
- V1: Issue `#1` 신규 생성 (report-only 4건, 라벨 `designer-review`+`report-only`).
- V2: 동일 csId 재실행 → `existing open issue found: #1 — updating body` (dedupe).
- V3: 격리 worktree에서 fixture로 Draft PR `#2` 생성 (라벨 `designer-bot`+`auto-apply`).
- V4: 같은 worktree clean 상태로 재실행 → "apply is no-op" skip.
- Cleanup: Issue closed (`[verified]` prefix), PR closed, 원격 브랜치 삭제, worktree 제거. main repo dirty 변경 영향 없음.
- 토큰은 macOS keychain에서 env-only 주입, 파일/로그/커밋 어디에도 노출 없음.
- Not-tested (의도된 갭, task-3 비차단): PR body update on existing PR. task-4 이후 자연 cs 발생 시 재확인.

### 활성 GitHub 리소스
- Repo: https://github.com/jhlee9815/uno-home (private)
- Latest successful run: https://github.com/jhlee9815/uno-home/actions/runs/26148882072
- Secrets: `FIGMA_TOKEN`

---

## 5. Phase 7 일정 (미래)

세부는 [`project-plan/phase-7/phase-plan-7.md`](./project-plan/phase-7/phase-plan-7.md).

진입 조건: Phase 6 완료 + 2주 안정 운영 + 디자이너/개발자 1명씩 사이클 경험 + 영역 침범 무발생.

---

## 6. 검증 방법 (단계 종료 공통)

```bash
npm run figma:preflight                              # mapping 정합성
npm run build                                        # vite build PASS
npm run lint                                         # eslint 0 errors
npm run figma:run                                    # 파이프라인 전체
npm run figma:claude-review                          # UNO 트랙 3-band 리포트
npm run figma:claude-review -- --source apple        # Apple 트랙 3-band 리포트
```

Phase 6에서 추가:
```bash
gh workflow run figma-pipeline.yml                   # Actions 수동 트리거
gh run watch                                         # 진행 보기
gh pr list --label designer-bot                      # 자동 PR 확인
gh issue list --label designer-review                # 자동 Issue 확인
```

---

## 7. 산출물 인덱스 (활성)

### 코드 (Phase 1~5 → 활성)
| 종류 | 경로 |
|---|---|
| Apple 토큰 JSON | `design-systems/apple/apple-tokens.json` |
| Apple 토큰 CSS | `design-systems/apple/apple-tokens.css` |
| 토큰 매핑/리스크 | `design-systems/apple/token-mapping.md` |
| Apple Skill | `.claude/skills/apple-design-system/SKILL.md` |
| UNO Skill | `.claude/skills/uno-design-system/SKILL.md` |
| Apple demo | `src/screens/AppleDemoScreen.tsx` + `Button.tsx` + `AppleCard.tsx` |
| Pesse 화면 | `src/screens/Pesse{Home,Cards,Send}Screen.tsx` |
| 파이프라인 코어 | `scripts/pipeline/*.ts` (8 stages) |
| Wrapper | `scripts/pipeline/claude-review.ts` |

### Figma (활성)
| 종류 | 위치 |
|---|---|
| 파일 | `9cevQvPHlQ5vZv5Pz3QaLL` (Pesse Apple Demo) |
| 변수 | 43개 (17 색상 primitives + 17 semantic + 7 radii + 2 폰트) |
| 텍스트 스타일 | 16개 (`apple/display`, `apple/heading/*`, …) |
| Icon 셋 | 28 variants (node `22:129`) |
| 화면 | Home `7:3` · Cards `7:4` · Send `7:5` |
| 활성 마커 | `pesse.send.cta` → node `10:62` |

### 파이프라인 상태 (활성)
| 종류 | 위치 |
|---|---|
| 활성 baseline | `.automation/baseline/2026-05-20T02-09-13.json` |
| 활성 매핑 | `config/figma-mapping.yaml` (5 entries) |
| UNO 백업 | `.automation/backups/figma-mapping.2026-05-20T02-07-19-249Z.yaml` |
| 데모 비교 페이지 | `.automation/demo-compare/compare.html` |

### 메타 문서
| 종류 | 경로 |
|---|---|
| 이 파일 | `plan.md` |
| Phase 1~5 아카이브 | `project-plan/archive/README.md` |
| Phase 6 계획 | `project-plan/phase-6/phase-plan-6.md` |
| Phase 7 계획 | `project-plan/phase-7/phase-plan-7.md` |
| 다음 세션 진입 가이드 | `TODO.md` |
| 디자이너 핸드오프 | `handoff.md` |
| 운영 가이드 | `README.md` |

---

## 8. 한계 (정직 공개 — 발표/공유 시 반드시 인정)

### Phase 5까지 인정한 5개 (그대로 유효)

1. **자동 적용 범위는 좁다** — token / `figma:text` / `figma:prop` marker가 있는 안전 후보에만. 전체 변경의 ~5%.
2. **Visual diff는 routed screens만** — 등록 frame 중 일부만.
3. **레이아웃/구조 자동 적용은 영구 보류** — 안전상 의도.
4. **Claude 분석은 deterministic encoding** — LLM-augmented 자연어 요약은 후속.
5. **Pesse auto-apply는 CTA 1건만** — 마커 부착된 것만 작동.

### Phase 6/7 진입으로 추가되는 한계 (정직 표기)

6. **재사용 불가** — Phase 6 완료 시점에도 이 repo 전용. "다른 팀이 fork해서 사용"은 Phase 7 완료 전까지 불가능. (Codex consult 2026-05-20 검증)
7. **9가지 차단점 중 5개는 Phase 7에서 해소** — Phase 6는 extraction-friendly 설계로 ①③⑤⑦만 선제 처리, 나머지(②매핑/④마커/⑥viewport/⑧plist/⑨package)는 Phase 7.

---

## 9. Codex Consult 검증 요약 (2026-05-20)

Phase 6/7 진입 전 외부 검증 결과:

- 세션 ID: `019e4407-9f23-7190-b963-60fd7ba11d4b`
- 검증 질문: "GitHub Actions + webhook 계획이 재사용 가능한 서비스/스킬을 만드는가?"
- 결론: **No.** 이 repo의 productization일 뿐, 재사용은 Phase 7 별도 작업 필요.
- 권고: **이 repo 데모를 먼저 완성하라**. "다른 사람도 쓸 수 있다"고 팔지 말 것.
- 부수 발견 (코드 결함): `promote-dev.ts:25-26`의 스모크 키 `home/family`가 현재 활성 Pesse 매핑과 불일치. → [`task-7-bugfixes.md`](./project-plan/phase-6/task-7-bugfixes.md)에서 수정.

---

## 10. 사용자가 직접 할 일 (현 시점)

### 즉시 (Phase 6 시작 전 한 번)
- [ ] task-1 GitHub Secrets 등록 (FIGMA_TOKEN, 그 외는 task 진행 시점에)
- [ ] CODEOWNERS에 들어갈 GitHub username 결정 (task-4)
- [ ] Cloudflare 계정 + wrangler 설치 (task-5 직전)
- [ ] Resend 계정 + 도메인 검증 시작 (task-6 직전, DNS 반영 24h 걸릴 수 있음)
- [ ] Slack/Discord webhook URL 생성 (task-3 진행 전)

### Phase 6 진행 중
- 각 task별 세부 문서 따라 실행
- 완료 시 plan.md "상태" 컬럼 업데이트

### Phase 6 종료 후 (2주 안정 운영)
- 디자이너 1명, 개발자 1명에게 사이클 사용 요청 + 피드백 수집
- 영역 침범 우려 사후 점검
- 검증 통과 시 Phase 7 진입

---

## 11. 다음 액션 우선순위 참고 (Phase 6 외 후순위)

| 우선도 | 작업 | 예상 |
|:-:|---|---|
| Low | `--use-claude` 옵션 실제 구현 (Anthropic SDK) | 1~2h |
| Low | Pesse Home/Cards에도 `figma:text` 마커 추가 | 30분 |
| Low | Pesse 토큰 자동 반영 (Figma variables → `apple-tokens.css`) | 1~2h |
| Low | minimal-test에 동일 wrapper 이식 | 2h |
| Low | (Phase 8 후보) Hosted SaaS 검토 | TBD |
