# Active Handoff — Pesse Phase 6 (2026-05-21)

> 아래의 기존 UNO HOME handoff는 archive 트랙 정보가 많다. 현재 작업 기준은 이 상단 섹션과 `plan.md` / `TODO.md` / `project-plan/phase-6/phase-plan-6.md`를 우선한다.

| 항목 | 현재 값 |
|---|---|
| 활성 repo | `jhlee9815/uno-home` (`/Users/juhee/Work/Test/design-test/uno-home`) |
| 활성 Figma file | `9cevQvPHlQ5vZv5Pz3QaLL` (Pesse Apple Demo) |
| 활성 mapping | `config/figma-mapping.yaml` — 5 entries (`pesse_home`, `pesse_cards`, `pesse_send` 포함) |
| 최신 main | `bcb7e98` — PR #23 daily audit auto-register merged |
| 완료 | Phase 6 task-1/2/3/4/7/8 ✅, task-10 Phase A live ✅, Phase B artifact download ✅, audit auto-register code ✅ |
| 다음 권장 | PR #25 body/check 후속 확인 → auto-register mapping PR merge |
| 대안 | #25 후 Task 10 Phase B PR 생성/manifest `pr-open` 재검증 또는 task-5 Cloudflare Worker |

## 현재 디자이너/개발자 워크플로우

1. Figma 변경은 GitHub Actions cron 또는 수동 workflow로 감지된다.
2. Task 8 이후 등록 화면 내부의 `detached-style`, `new-frame`, `image-change`는 `report-only`로 구조화되어 cs report/Issue에 표시된다. schema-compatible baseline `2026-05-21T07-43-40`이 main에 올라가 다음 run부터 증분 감지 가능하다.
3. 디자이너 승인 UX는 Phase A로 live 확인됐고, artifact handoff도 live에서 다운로드 성공까지 확인됐다.
4. `figma-audit` daily auto-register는 PR #23으로 main에 들어갔다. 두 번의 live audit run이 PR #25를 생성했고 validation dispatch도 성공했다.
5. 현재 blocker는 PR #25 후속이다: PR body에서 두 번째 frame name이 비고, `statusCheckRollup`이 empty라 merge gate가 PR에 붙었는지 확인해야 한다. 자세한 재개 문서는 [`project-plan/phase-6/audit-auto-register-handoff-2026-05-21.md`](./project-plan/phase-6/audit-auto-register-handoff-2026-05-21.md).

## 바로 읽을 문서

- [`TODO.md`](./TODO.md) — 다음 세션 진입/우선순위
- [`plan.md`](./plan.md) — 전체 상태와 산출물 인덱스
- [`project-plan/phase-6/phase-plan-6.md`](./project-plan/phase-6/phase-plan-6.md) — Phase 6 source of truth
- [`project-plan/phase-6/task-8-ds-compliance-detection.md`](./project-plan/phase-6/task-8-ds-compliance-detection.md) — 완료된 Task 8
- [`project-plan/phase-6/task-10-designer-workflow-design.md`](./project-plan/phase-6/task-10-designer-workflow-design.md) — 디자이너 승인/자동 PR 설계
- [`project-plan/phase-6/audit-auto-register-handoff-2026-05-21.md`](./project-plan/phase-6/audit-auto-register-handoff-2026-05-21.md) — 현재 Claude 세션 중단 지점

---

# UNO HOME Design System — Handoff

**앱**: UNO HOME — 스마트홈 가족 관리 앱 (홈 허브, 가족 상태, 수면/건강, 알림)
**스타일**: 모노크롬(블랙/화이트) + 레드 강조, 클린 미니멀
**스택**: React + TS + Tailwind v4 (Vite) — `/Users/juhee/Work/Test/design-test/uno-home/`

---

## 파일 / 레퍼런스

| 항목 | 경로 |
|---|---|
| Figma 파일 | https://www.figma.com/design/SXPVingkmqkrcLzcXYFsZd/Untitled (`SXPVingkmqkrcLzcXYFsZd`) |
| 디자인 시스템 문서 | `design-system.md` |
| 토큰 JSON | `tokens.json` |
| 레퍼런스 이미지 | `refernce/` (mo·Home·Family·Notifications·Content 등 9장) |
| 실행 계획 / 진행 상태 | [plan.md](./plan.md) |
| 반복 운영 가이드 | [`uno-home/README.md`](./uno-home/README.md) |

**Figma 페이지 구조**: Page 1 (앱 화면 원본) / Design System (토큰 + 컴포넌트 + 아이콘)

---

## 디자인 토큰 (Variables)

**Primitives** (모드: Value) — Tailwind 스케일: Base(white/black), Neutral·Red·Yellow·Green·Blue 각 50–950 (11단계)

**Colors** (모드: Light / Dark) — Primitive alias 시맨틱 토큰. 그룹: `bg` `text` `border` `icon` `brand` `interactive` `status.{success,warning,info,error,danger}`

**Spacing**: 2·4·6·8·12·16·20·24·32·40·48
**Radius**: None(0)·XS(4)·SM(8)·MD(12)·LG(16)·XL(20)·Full(100)

---

## 타이포그래피

**폰트**: Noto Sans KR — Regular(400) / Medium(500) / Bold(700). SemiBold(600) 없음 → Bold 대체.

| 스타일 | Weight | Size / LH |
|---|---|---|
| Heading H1·H2·H3 | Bold | 22/28 · 18/24 · 16/22 |
| Body LG·MD·SM (+Med) | Reg/Med | 16/24 · 15/22 · 14/20 |
| Caption MD·SM | Reg | 12/16 · 11/14 |
| Label LG·MD·SM | Bold | 14/20 · 12/16 · 11/14 |
| Button LG·MD | Bold | 16/24 · 14/20 |

---

## 아이콘 (Lucide, SVG stroke 24×24)

Home·Activity·Moon·Podcast·Play (하단 내비) / Bell·BellDot·Settings·User (헤더) / ArrowLeft·X / UserPlus·Users (컨텍스트 메뉴) / Trash2 / Check·CircleCheck·CircleAlert / ChevronDown·Plus·MoreVertical·Heart

---

## UI 컴포넌트 (Colors 변수 100% 바인딩, 다크 모드 자동)

| 컴포넌트 | 변형 | 핵심 사양 |
|---|---|---|
| **Button** | Variant(Primary/Secondary/Danger/Ghost) × Size(LG 52/MD 40) | 너비 335, radius 100 |
| **Avatar** | Size(SM 32/MD 40/LG 48) × State(Default/Active) | bg/avatar→active interactive/primary |
| **Badge** | Type(ADMIN/MEMBER/OWNER) | 12px Med, radius 100, ADMIN·MEMBER bg/secondary + text/secondary, OWNER bg/disabled |
| **Input** | State(Default/Filled/Focused/Error/Error+Focused) | 350×48, radius 8, Send 인라인, sub text on/off · Focused: border/focus 2px + neutral.900 15% drop shadow · Error+Focused: red.600 2px + red.600 20% drop shadow |
| **OTP Cell Group** | 셀 State 5종 + showLabel/Timer/SubText | 350px, 6셀 50×56, radius 12 · border: Empty 1px / Focused·Filled·Error 1.4px / Error+Focused 2px |
| **List Item / Member** | State(Default/Selected/Swipe-Delete) | Avatar MD 인스턴스, 스와이프 시 status/danger 레드존 |
| **Header** | Variant(Back-Title / Title-Actions / Back-Title-NoAction) | bg/primary, text/primary |
| **Modal** | Type(Success/Danger) | 335px, radius 20, X 닫기 |
| **NotificationListItem** | Variant(`actions` / `confirmed` / `status-text` / `none`) | 350×{147·147·124·75}, padding 16, radius `radius.xl` (20), 헤더: 타이틀 + time(우측 60px) · 서브텍스트 1줄 · 하단 슬롯 4종 — `actions`: Decline+Accept(2×153, gap 12) / `confirmed`: 단일 disabled 버튼(318) / `status-text`: 상태 텍스트 / `none`: 없음. **NotificationCard 대체 (2026-05-06, Figma `179:11395`)** |
| **Tab Navigation** | All / My Family / Guests | 활성: brand/primary 2px 하단 바 |
| **Bottom Nav Bar** | Home(활성 pill) + 4탭 stroke | 390×83 |
| **Context Menu** | Invite to Hub / Manage Members | 200×112, shadow 0 4px 16px rgba(0,0,0,.12) |

---

## 개발 진행 상태

| Phase | 내용 | 상태 |
|---|---|:-:|
| 1–4 | 토큰 CSS 변수 → atomic 6 → 복합 7 → 화면 8 | ✅ |
| 5 | 자동 감지·분류·반영·검증·승인 + dev 반영 + launchd + M2/M3 엔진 | ⏳ |

5-8 launchd는 등록/수동 실행 검증 완료. 5-4는 M1/M2/M3 components/compositions 범위 자동 반영과 report-only 리포트 품질 개선까지 구현됐고, M4 layout 자동화는 보류 상태다. 2026-05-06에는 Figma 파일의 top-level frame 173개를 모두 screens 매핑에 등록해 총 186개 매핑 기준 baseline을 재산출했다. 상세는 [plan.md](./plan.md), [`uno-home/README.md`](./uno-home/README.md) 및 [`uno-home/phase{1-5}/`](./uno-home/).

---

## 디자이너 워크플로우 (5-8 완료 기준)

1. Figma에서 디자인 수정.
2. 매일 21:00 launchd 자동 실행 — 또는 수동 `npm run figma:run`.
3. 시스템: 변경 감지 → 토큰 자동 반영 → 빌드/린트/시각 검증 → 디자이너 알림(macOS).
4. 리포트 확인: `.automation/reports/cs-{id}.md` (Figma 변경 요약 + 코드 변경 + 스크린샷 + 검증 결과).
   - 변경 0건이면 `apply-*` / `verify-*` 운영 로그만 남기고 `cs-{id}.md` 디자이너 승인 리포트는 생성하지 않음.
5. CLI:
   ```bash
   npm run figma:approve cs-{id}     # 승인 → promote-dev → dist-dev/ 반영 + smoke
   npm run figma:reject cs-{id} "사유" # 반려 → 다음 사이클에서 동일 변경 자동 강등
   npm run figma:remap <id>          # 반려 후 의도 변경되어 다시 푸시할 때 매핑 갱신
   ```
6. 화면(screens) 텍스트는 항상 디자이너가 코드 직접 수정 (영구 `report-only` 정책).

**자동/수동 매트릭스**:
- 토큰 변경 (색상·spacing) → 자동 반영
- atomic/composition 텍스트 (마커 있음) → 자동 반영
- screens 텍스트 → 디자이너 수동
- 레이아웃 / 노드 추가·삭제 → `report-only`, 수동 처리

---

## 다음 세션 진입 가이드

**먼저 읽어야 할 파일**: [`TODO.md`](./TODO.md) — 이번 세션에서 정리된 다음 작업 우선순위.
**현재 진행 중인 트랙 (2026-05-20 갱신)**:
- Apple-inspired DS 트랙 Phase 1~5 모두 ✅. Codex Apple Phase 3 산출물과 우리 SKILL.md/checklist-example.md 정합성 5분 검토 대기.
- 보완 트랙 (Claude–Codex 합의 2026-05-20) 5/5 완료: `.claude/skills/{uno,apple}-design-system/SKILL.md`, `scripts/pipeline/claude-review.ts`, `project-plan/supplementary-2026-05-20/{README,sample-cs-report}.md`, git init.
- 발표 데모: `npm run figma:claude-review` (UNO) + `npm run figma:claude-review -- --source apple` + `npm run dev` (Phase 4 데모 섹션 시각 확인).
- 직전 Track A/B 작업은 그대로 유지. M4 layout 자동화는 영구 보류.

| 항목 | 값 |
|---|---|
| 직전 세션 종료일 | 2026-05-06 |
| 다음 작업 | 추가 필수 작업 없음. Track A ⑥ baseline 재산출 완료, Track B ⑦ report-only 리포트 품질 개선 완료 |
| 추적 문서 (필독) | [`uno-home/phase3/phase3-8.md`](./uno-home/phase3/phase3-8.md) — 단계 표·variant·체크리스트·차단 요소 |
| 결정 사유 | [plan.md](./plan.md) 결정사항 표 "컴포넌트 스코프" 행 (2026-05-06) |
| 사양 | [design-system.md](./design-system.md) §5 `Notification List Item` |
| Figma reference | `179:11404` (Settings > Notifications / List, actions variant). 4 variant 노드 ID는 phase3-8.md 참조 |
| 차단 요소 | Figma Design System에 NotificationListItem ComponentSet **미구성** → `figma-mapping.yaml`에서 잠정 `apply: report-only`. ComponentSet 생기면 `partial`로 승격 검토 |

**진입 시 첫 행동**:
1. `phase3-8.md` ⑥ 체크리스트 확인 (Track A 완료 상태)
2. 최신 promote report: `.automation/reports/promote-cs-2026-05-06T05-08-36.md` (gates/build/smoke passed, screenshot 8장 captured)
3. 새 범위가 생기면 [phase5-4.md](./uno-home/phase5/phase5-4.md)의 M4 layout 보류 결정부터 재검토

**다음 세션 첫 메시지 예시 (사용자가 보낼 만한)**: *"다음 자동화 범위 정리해줘."*

---

## 새 프로젝트 인수자 시작 가이드

이 폴더를 다른 사람이 자기 프로젝트에 적용할 때는 기존 UNO HOME Figma node ID를 그대로 쓰면 안 된다. 먼저 새 프로젝트명, 앱 Figma 파일, 필요 시 별도 디자인 시스템 Figma 파일을 등록해야 한다.

### 1. 프로젝트/파일 등록

앱 화면 Figma 파일만 있는 경우:

```bash
cd /받은경로/design-test/uno-home
npm install
printf 'FIGMA_TOKEN=본인_FIGMA_TOKEN\n' > .env
npm run figma:register-file -- "https://www.figma.com/design/앱_FILE_KEY/파일명?m=dev" --project-name "프로젝트명" --package-name "package-name"
npm run figma:preflight
```

앱 화면 Figma 파일과 별도 디자인 시스템 Figma 파일이 모두 있는 경우:

```bash
cd /받은경로/design-test/uno-home
npm install
printf 'FIGMA_TOKEN=본인_FIGMA_TOKEN\n' > .env
npm run figma:register-file -- "https://www.figma.com/design/앱_FILE_KEY/파일명?m=dev" --project-name "프로젝트명" --package-name "package-name" --design-system-url "https://www.figma.com/design/디자인시스템_FILE_KEY/파일명?m=dev"
npm run figma:preflight
```

`figma:register-file`은 기존 설정을 `.automation/backups/`에 백업하고 새 Figma 파일 기준으로 tracking-only mapping을 다시 만든다. 앱 파일의 top-level frame은 `screens:`에, 디자인 시스템 파일의 top-level `FRAME`/`COMPONENT`/`COMPONENT_SET`은 `components:`에 등록된다.

### 2. 새 디자인 시스템과 화면 검증 세트

새로 시작할 때는 Figma에 바로 전체 서비스를 만들기보다, 먼저 검증 가능한 최소 세트를 만든다.

| 구분 | 해야 할 일 |
|---|---|
| 디자인 시스템 | 색상/타이포/spacing/radius 토큰과 기본 컴포넌트 2~3개 생성 |
| 앱 화면 | 대표 화면 2~3개 생성 |
| 코드 화면 | 최소 1~2개 화면을 React route에 연결해 visual diff 가능 상태로 구성 |
| baseline | 첫 등록 change-set approve/promote 후 재실행해서 `Changes: 0` 확인 |

확인 순서:

```bash
npm run figma:run
npm run figma:approve cs-{id}
npm run figma:promote cs-{id}
npm run figma:run
```

마지막 실행에서 `Changes: 0`이 나오면 새 프로젝트 기준 baseline이 안정화된 것이다.

### 3. 운영 전 주의사항

- 새 프로젝트/새 디자인 시스템은 기본적으로 `report-only` tracking에서 시작한다.
- 자동 반영은 새 파일의 컴포넌트 node ID와 코드 마커를 확인한 뒤 일부 항목만 `auto`/`partial`로 승격한다.
- route가 없는 frame은 markdown report-only로만 확인된다.
- `uno-home` 폴더명을 바꾸는 것은 가능하지만, launchd를 사용할 경우 `config/com.uno-home.figma-pipeline.plist`의 경로와 label도 새 이름에 맞게 수정해야 한다.

---

## 현재 상태 요약

| 항목 | 상태 |
|---|---|
| Figma 디자인 시스템 (tokens + 컴포넌트) | ✅ |
| Phase 1–4 (코드 구현) | ✅ |
| Phase 5-0 ~ 5-3 (감지 인프라) | ✅ |
| Phase 5-4 M1/M2/M3 | ✅ M1 + M2/M3 components/compositions 안전 후보 완료 |
| Phase 5-5 ~ 5-7 (검증·승인·promote-dev) | ✅ |
| Phase 5-8 (launchd 스케줄러) | ✅ |
| 전체 top-level Figma frame 등록 | ✅ 173 frames, total mapping 186 |
| 새 프로젝트/디자인 시스템 등록 CLI | ✅ `figma:register-file --design-system-url` |

**디자이너 액션**: 추가 결정 없음. screens 8개는 영구 `report-only`.

**5-4 최신 구현 메모 (2026-05-06)**:
- `scripts/pipeline/lib/apply-code.ts` 추가 — classified diff의 `basePath`/`headPath` 스냅샷을 읽어 text/component-props leaf 변경을 추출.
- `apply.ts`가 M1 token CSS, M2 `figma:text`, M3 `figma:prop` 마커 적용을 모두 처리.
- `diff-report-only-{ts}.md`가 `Why blocked` / `Manual action` 컬럼으로 screens policy, deferred class, unmapped target을 구분.
- `apply-cs-{id}.md`가 no-marker auto-apply 후보를 `Manual Follow-up`에 기록.
- `cs-{id}.md` 디자이너 리포트가 report-only 상세 리포트 링크를 포함.
- `report.ts`가 classified summary `total === 0`이면 designer-review 리포트를 skip해 no-change 사이클의 pending 리포트 누적을 방지.
- Figma 파일 전체 top-level frame 173개 등록 완료. 미구현 프레임은 `src/screens/FigmaFrameTracking.ts` + `report-only`로 추적하고, 등록 change-set `cs-2026-05-06T06-00-51`을 promote해 baseline `2026-05-06T06-00-44.json`으로 갱신.
- `figma:register-file` 확장 — 새 프로젝트명/package name, 앱 Figma 파일, 별도 디자인 시스템 Figma 파일을 등록 가능. 앱 frames는 `screens:`, 디자인 시스템 top-level nodes는 `components:` report-only tracking으로 시작.
- 운영 검증(2026-05-06): no-change `npm run figma:run`은 `cs-*.md` 생성 없이 complete. 임시 token 변경은 autoApply=1 → `src/index.css` 반영 → build/lint/visual passed → `cs-2026-05-06T05-43-41.md` 생성 확인 후 rejected 처리.
- `figma:text` 소스 마커 36개 주입. 최신 marker-candidates 기준 components/compositions의 `ambiguous`/`missing-code-candidate` gap은 0개.
- 실제 `figma:prop` 소스 마커 14개 주입. 컴포넌트 기본 prop 값과 안전한 child JSX prop(`Input` error icon, `ListItem` Avatar size/state)을 대상으로 함.
- components/compositions 범위의 component-props leaf 19개는 14개 prop marker로 커버. 같은 node id 안의 다중 prop 변경은 marker `id`/`prop` 기준으로 매칭.
- `figma:prop` marker는 `transform="lower"` 또는 `transform="pascal-compact"`를 지원해 Figma variant 값(`LG`, `Back-Title`)을 코드 union 값(`lg`, `BackTitle`)으로 변환.
- 최신 전체 text 후보 통계: 19 entries, 262 Figma text leaves, matched 121, ambiguous 16, missing 125. 남은 ambiguous/missing은 screens/report-only 중심.

---

## 기술 참고

### Figma Plugin API (use_figma MCP)
- `figma.createNodeFromSvg(svg)` — Lucide 아이콘 생성, resize 금지
- COMPONENT_SET에 변형: `componentSet.appendChild(newComponent)`
- Auto-layout 자식 순서: `insertChild(index, node)` (x 직접 수정 X)
- 아이콘 색상: Lucide는 `strokes`에 바인딩 (`fills` 아님)
- `layoutSizingHorizontal/Vertical = 'FILL'` → `appendChild` **이후** 설정
- 페이지 전환: `await figma.setCurrentPageAsync(page)` 필수
- `renameMode()` → `modes[0].modeId` (`.id` 아님)

### 폰트
- **Noto Sans KR**: Figma 클라우드 폰트, MCP 직접 접근 가능 (Thin/Light/DemiLight/Regular/Medium/Bold/Black)
- **Pretendard**: 시스템 설치되어 있으나 MCP 클라우드 환경 접근 불가, Figma Desktop에서 수동 적용

### tokens.json 구조
`primitives` (HEX) / `semantic` (Light) / `semantic-dark` / `typography` / `spacing` / `radius` / `shadow` (card·modal·dropdown) / `component` (치수·radius·border)
