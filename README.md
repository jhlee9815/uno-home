# design-review-bot

Figma → 코드 디자인 변경을 자동으로 감지·분류·알리는 GitHub Actions 기반 자동화 봇.

디자이너가 Figma에서 화면을 수정하면, 봇이 일정 주기로 변경 사항을 잡아 카테고리별로 분류하고, 디자이너에게 GitHub Issue / Slack / 시각 비교 viewer로 알리며, 개발 코드가 Figma와 어긋난 부분(디자인 시스템 미사용, 새 화면 추가, 이미지 변경 등)을 PR로 자동 등록합니다.

> **선행 조건**: 이 봇은 사용 중인 디자인 시스템을 Figma 측에 등록(컬러/타이포 변수, 컴포넌트, 스타일)한 뒤에야 의미 있는 감지를 합니다. 토큰이 등록돼 있어야 "디자인 시스템 미사용"을 변별할 수 있고, 컴포넌트가 등록돼 있어야 INSTANCE 교체를 잡을 수 있습니다.

---

## 빠르게 보는 결과 (Quick Result)

스케줄러가 한 번 돌면 디자이너는 보통 이 3가지를 받습니다:

1. **Slack 통합 알림** — cs마다 한 번씩 (cron 2시간 또는 audit cascade 직후 1회):

   **예시 A — DS 미사용/새 화면 등 compliance 변경이 많은 경우**:
   ```
   🎨 Figma 변경 감지 — cs-2026-05-22T01-12-45
   • 🎨 디자인 시스템 미사용: 1083건 (상세는 viewer 참조)
   • 🆕 새 화면 추가: 2건
   • 🖼️ 이미지 변경: 5건
   • 전체: 1090건 (자동 반영 후보 0건, 디자이너 검토 1090건)
   • 영향 화면 top-3: Phone · Cards (412) · Phone · Home (320) · Phone · Send (108)
   • 오늘의 audit Issue: Issue #31
   • 새 화면 등록 PR: PR #30
   • 리뷰 viewer: cs-2026-05-22T01-12-45
   ```

   **예시 B — 구조·토큰·레이아웃 등 raw 변경 위주인 경우**:
   ```
   🎨 Figma 변경 감지 — cs-2026-05-25T11-44-34
   • 🧱 구조 변경: 5건 (추가 3·삭제 2)
   • 🎨 디자인 토큰 변경: 2건
   • 📐 레이아웃 변경: 1건
   • 전체: 8건 (자동 반영 후보 0건, 디자이너 검토 8건)
   • 영향 화면 top-3: Pesse Apple-inspired (4) · Phone · Home (3) · test1 (1)
   • 리뷰 viewer: cs-2026-05-25T11-44-34
   ```

   `(상세는 viewer 참조)` 표기는 카테고리당 50건 이상일 때 자동 첨부됩니다. Slack(3500자) / Discord(1800자) 채널별 본문 길이 cap도 적용돼, 본문이 truncated되더라도 `• 전체:` headline은 항상 보존됩니다.

2. **GitHub Issue** (`audit` 라벨): 감지된 미사용/미등록 항목을 표로 정리한 Markdown 리포트.

3. **GitHub Pages viewer**: baseline ↔ 현재 스크린샷을 좌우 비교하고, 각 변경에 카테고리 chip(🆕 새 화면 추가, 🎨 디자인 시스템 미사용, …)을 붙인 HTML.

추가로, **새로 등록할 만한 화면이 발견되면 봇이 자동으로 Pull Request를 만들어** `config/figma-mapping.yaml`에 추가합니다. 디자이너 또는 관리자가 머지 한 번으로 다음 cycle부터 그 화면 내부도 감지 대상에 포함됩니다.

---

## 작동 방식 (How it works)

### 워크플로 2개로 분리 — "전체 점검" vs "변경 추적"

이 봇은 서로 다른 목적의 워크플로 2개로 나뉩니다. 한쪽은 디자인 시스템 위생을 매일 점검하고, 다른 한쪽은 디자이너가 편집한 변경을 자주 추적합니다.

| 항목 | **figma-audit** (위생 점검) | **figma-pipeline** (변경 추적) |
|---|---|---|
| **언제 도는가** | 매일 1회 00:00 UTC (09:00 KST) | 2시간마다 (02·04·06·…·22 UTC) + audit 직후 cascade |
| **횟수/일** | 1회 | 12회 |
| **보는 것** | Figma 파일 **전체 절대량** (스냅샷 한 장) | baseline ↔ 현재 **델타** (전후 비교) |
| **잡아내는 것** | ① DS 토큰 미사용 raw 색상/타이포/효과의 **총 개수**<br>② 등록 안 된 top-level 화면 후보 (2-sighting 누적) | ① 텍스트/속성/구조/레이아웃 변경<br>② 등록 화면 내부의 detached-style/new-frame/image 변경 |
| **결과물** | • GitHub Issue (`audit` 라벨)<br>• 자동 등록 PR (2-sighting 누적 후)<br>• Slack 일간 절대량 알림 | • `cs-{timestamp}` 리포트<br>• before/after viewer (GitHub Pages)<br>• cs별 Slack 알림 + GitHub Issue<br>• 자동 적용 Draft PR (auto-apply 한정) |
| **목적** | "어제보다 detached가 줄었나?" 추세 점검 | "Figma에서 뭐가 바뀌었나?" 즉시 알림 |

**왜 audit는 daily이고 pipeline은 2h인가**:
- audit의 절대량은 하루 단위 변화가 의미 있는 트렌드 지표 — 2시간마다 봐도 노이즈만 늘어남
- 새 화면 자동 등록은 **2회 연속 sighting**(약 24h) 안전장치 — daily가 자연스러움
- pipeline은 디자이너 편집을 빨리 잡기 위한 polling — 본래 webhook 즉시 트리거가 답이지만, webhook 누락 안전망으로 2시간 cron 유지 (task-5 Cloudflare Worker 머지 시 webhook + cron 안전망 2단 구조 완성 예정)

### cascade — 1일 1회 통합 알림

매일 00:00 UTC `figma-audit`이 끝나면 `figma-pipeline`이 자동으로 이어 돌면서 (`workflow_run` 트리거), pipeline의 Slack 메시지에 audit 결과 + auto-register PR 링크를 함께 담아 디자이너가 한 번의 알림으로 모든 시그널을 확인할 수 있게 합니다.

### 자동 등록 PR

새 top-level 화면이 **2회 연속 sighting**(약 24시간)되면 `designer-bot` GitHub App이 PR을 만들고 `config/figma-mapping.yaml`에 `apply: report-only`로 추가합니다. 머지하면 다음 audit cycle부터 그 화면 내부의 디자인 시스템 미사용까지 검사 대상에 포함됩니다.

---

## 감지 가능 항목 (What it detects)

| 카테고리 | 라벨 | 감지 기준 | 처리 |
|---|---|---|---|
| 🆕 새 화면 추가 | `new-frame` | snapshot에 없던 frame 노드 (등록 화면 안 / top-level 모두) | Issue + 자동 등록 PR |
| 🎨 디자인 시스템 미사용 | `detached-style` | `boundVariables`/`fillStyleId`/`textStyleId` 없는 raw 컬러·타이포·효과 | Issue |
| 🖼️ 이미지 변경 | `image-change` | image fill의 `imageRef` 해시 변경 | Issue |
| ✏️ 텍스트 변경 | `text-change` | 등록된 텍스트 노드의 `characters` 변경 | Tier 1 marker patch (자동 반영) |
| 🧩 속성 변경 | `props-change` | 등록된 컴포넌트의 속성 변경 (매핑 외) | Issue |
| 🧱 구조 변경 / 📐 레이아웃 변경 / 📦 에셋 변경 / 🎨 디자인 토큰 변경 | `structure` / `layout` / `asset` / `token` | 그 외 저수준 diff 시그널 | Issue (참고용) |

---

## 어디까지 가능한가 (Limits / non-goals)

**v1에서 가능**:
- 디자인 토큰(`boundVariables` 부재) 단위로 화면 안의 미사용 색상/타이포/효과 감지
- 새 top-level 화면 자동 등록 PR (`apply: report-only` 모드)
- 등록된 텍스트 노드의 marker 기반 자동 코드 반영
- baseline ↔ 현재 시각 비교 (스크린샷 diff)
- Slack 통합 알림 (한국어 카테고리)

**v1 범위 밖 (수동 / 다음 phase)**:
- 토큰 이름까지 추적해 "어떤 토큰을 써야 할지" 추천 (`suggestedToken: null` 정책 유지). 잘못된 추천은 없는 것보다 나쁘다는 판단.
- INSTANCE_SWAP / component path 기반 정밀한 아이콘 교체 감지 — v1은 `imageRef` 해시 비교만.
- 컴포넌트 속성 변경의 자동 코드 반영 — 위험도가 높아 report-only.
- 시각적 diff 자동 baseline promote — 다음 Phase에서 처리.

**원천적으로 불가능**:
- 디자인 시스템이 Figma 측에 등록돼 있지 않으면 "미사용"을 판단할 기준이 없습니다. 컬러/타이포 변수, 컴포넌트, 스타일을 먼저 Figma에서 정리하세요.

### 다른 프로젝트에 적용할 때의 한계 (Phase 7 미해결 차단점)

이 봇은 **Pesse Apple-inspired demo (모바일 React)** 기준으로 개발됐고, 일반 fork 가능한 도구로의 추출은 Phase 7 작업 범위입니다. 지금 시점에 다른 프로젝트에 도입할 때 직접 손봐야 할 부분:

| 차단점 | 현재 상태 | 어떻게 해야 하나 |
|---|---|---|
| **mapping이 Pesse 전용** | `config/figma-mapping.yaml`은 비워두고 시작 가능하지만, `scripts/pipeline/promote-dev.ts` 등 일부 코드에 Pesse 화면 키(`home/family`)가 default로 남음 | `FIGMA_SMOKE_KEYS` env var로 override 또는 빈 값으로 비활성화 |
| **마커가 React 전용** | `figma:text` / `figma:prop` 주석 형식이 JSX 안 주석 기준 | Vue/Svelte/Flutter 등 다른 프레임워크는 marker parsing을 직접 수정 필요 |
| **viewport 390×844 (모바일 고정)** | visual diff 해상도 하드코딩 | 데스크탑 앱은 별도 패치 (Phase 7에서 config화 예정) |
| **package.json 일부 잔여** | `design-review-bot`으로 리네임 됐으나 일부 스크립트가 옛 이름 가능 | grep으로 확인 후 수정 |

도입 가능한 시나리오:
- ✅ 모바일 React (Vite/CRA) + Figma file + Slack/Discord = 그대로 따라 하면 동작
- 🟡 데스크탑 React = viewport만 수정하면 동작
- ❌ Vue / Svelte / Flutter / 모바일 네이티브 = marker 파서 직접 작성 필요

→ 본격 다른 팀 공유는 **Phase 7 완료 후** 권장. 현재는 같은 스택의 sibling 프로젝트에 한해 PoC 도입 가능.

---

## 자기 프로젝트에 설치하기 (Install in your project)

### 1. 사전 준비

- GitHub repository (private/public 모두 가능)
- Figma 파일 + 토큰 (`FIGMA_TOKEN`)
- Slack incoming webhook URL (선택, `SLACK_WEBHOOK_URL`)
- Node.js 20+ (CI runner는 `actions/setup-node@v4`로 자동 설치)

### 2. 봇 코드 도입

이 repo를 자신의 프로젝트에 도입하는 가장 단순한 방법은 다음 디렉토리/파일을 복사해 들이는 것입니다:

```
scripts/pipeline/            # 봇 본체
scripts/ops/                 # 보조 ops 스크립트
.github/workflows/           # figma-audit, figma-pipeline, pr-checks, designer-approval
config/figma-mapping.yaml    # 사용자 매핑 (비워 두고 직접 등록)
package.json                 # 봇 dependencies + npm scripts
package-lock.json            # 잠긴 dependency 트리 (`npm ci` 재현성용)
tsconfig.json                # 스크립트 빌드 설정
tsconfig.app.json            # (현재 v1 한정) 데모 앱 빌드 설정 — 후속 PR에서 분리 예정
tsconfig.node.json           # (현재 v1 한정) Vite 노드 측 설정
vite.config.ts               # (현재 v1 한정) 데모 앱 빌드용
eslint.config.js             # 린트 설정
```

> v1에서는 `pr-checks` 워크플로가 `npm run build`로 `tsc -b && vite build`를 실행합니다. 봇 자체는 Vite/React 없이 동작하지만 build step이 데모 앱 빌드를 함께 검증하므로 위 5개 파일이 필요합니다. **다음 release에서 봇 빌드를 독립시키면 vite/tsconfig.app/tsconfig.node가 빠집니다.**

### 3. 디자인 시스템 등록

Figma 측:
1. 컬러/타이포/효과를 **Variables 또는 Styles로 등록**합니다.
2. 화면에서 raw 값(hex, font name 직접 입력) 대신 등록된 변수/스타일을 적용합니다.
3. 봇이 raw 값을 만나면 `detached-style`로 분류합니다.

> 디자인 시스템 등록을 건너뛰면 `detached-style` 감지가 무의미해집니다 — 모든 값이 raw로 보이기 때문.

### 4. Figma 매핑 등록

`config/figma-mapping.yaml`에 추적할 화면을 등록합니다.

```yaml
screens:
  home_screen:
    figmaNodeId: "123:456"
    figmaNodeName: "Home"
    figmaNodePath: []          # 필수 (현재 schema에서 required, 비워두려면 [])
    code: ../src/screens/Home.tsx
    targetType: screen
    automation:
      apply: report-only        # 또는 auto-apply (텍스트 marker 한정)
      audit: include
      allowedClasses:
        - token
        - text
        - layout
        - structure
```

> 비워 두고 시작해도 됩니다. 스케줄러가 등록되지 않은 top-level 화면을 발견하면 2-sighting 후 자동 등록 PR을 보냅니다.

### 5. GitHub App 설치 (자동 등록 PR용)

자동 등록 PR이 정상적인 `pull_request: opened` 이벤트로 cascade하려면 GitHub App이 PR을 만들어야 합니다 (`GITHUB_TOKEN`으로 만든 PR은 cascade되지 않음).

1. https://github.com/settings/apps 에서 새 App 생성 (예: `designer-bot`)
2. Permissions: `contents: write`, `pull-requests: write`, `issues: write`
3. 해당 repo에 install
4. App ID + private key를 repo secrets에 추가:
   - `AUDIT_APP_ID`
   - `AUDIT_APP_PRIVATE_KEY`

### 6. Repository secrets

| 이름 | 용도 |
|---|---|
| `FIGMA_TOKEN` | Figma API 호출 (필수) |
| `AUDIT_APP_ID` / `AUDIT_APP_PRIVATE_KEY` | 자동 등록 PR (필수) |
| `SLACK_WEBHOOK_URL` | Slack 알림 (선택) |
| `DISCORD_WEBHOOK_URL` | Discord 알림 (선택) |

Repository variables:

| 이름 | 용도 |
|---|---|
| `FIGMA_FILE_KEY` | Figma 파일 키 |
| `FIGMA_CONFIG_DIR` | (선택) 매핑 config 디렉토리 override |
| `FIGMA_VIEWER_BASE_URL` | (선택) GitHub Pages base URL override |

### 7. 수동 실행

```bash
# Figma → snapshot
npm run figma:snapshot

# 감사 (DS 미사용 + 새 화면)
npm run figma:audit

# 자동 등록 후보 등록
npm run figma:audit:register

# 전체 파이프라인 (snapshot → diff → classify → apply → verify → report)
npm run figma:run
```

### 8. 스케줄러 활성화

`.github/workflows/figma-audit.yml`과 `figma-pipeline.yml`이 각각 daily / 2시간 cron으로 자동 실행됩니다. 별도 설정 없이 main에 들어가면 활성화됩니다.

수동으로 트리거하고 싶을 때:
```bash
gh workflow run figma-audit.yml
gh workflow run figma-pipeline.yml
```

---

## GitHub App

이 봇은 자동 PR 생성에 GitHub App `designer-bot`을 사용합니다. App 이름은 사용자가 변경해도 됩니다(설치할 때 임의의 이름을 줄 수 있음). 워크플로 코드에는 App 이름이 하드코드되어 있지 않고 `AUDIT_APP_ID` / `AUDIT_APP_PRIVATE_KEY` secret 값으로 인증합니다.

---

## 트러블슈팅 (Troubleshooting)

### "알림이 안 와요"

1. **변경이 없으면 알림도 없습니다** — figma-pipeline은 `Changes: 0`이면 post-run-actions 스텝 자체가 skip됩니다. Slack 본문 누락이 아니라 정상 동작입니다. 확인:
   ```bash
   gh run view <run-id> --log | grep -E "Changes:|cs-id"
   ```
   `cs-id: none`이면 변경이 0건이라 알림이 발생하지 않은 것.

2. **Slack webhook URL이 없거나 만료**:
   ```bash
   gh secret list                         # SLACK_WEBHOOK_URL이 있는지
   gh run view <run-id> --log | grep slack
   ```
   `[slack] skipped (SLACK_WEBHOOK_URL not set)`이 보이면 secret 등록 필요.

3. **`workflow_run` cascade가 안 도는 경우**: audit이 GitHub Actions UI에서 success인데 pipeline이 안 이어졌다면, `figma-pipeline.yml`의 `workflow_run` 트리거가 비활성화됐을 가능성. main 브랜치 기준으로만 cascade가 동작합니다.

### "audit Issue가 매일 새로 생성돼서 노이즈"

현재 audit Issue는 직전 카운트와 동일해도 매일 close-and-create 됩니다. 향후 dedup 작업 예정 (TODO.md §2.후순위). 디자이너가 `audit` 라벨로 필터링해 보거나, Slack 채널에 audit 알림(매일 1회)만 구독하는 게 임시 대응.

### "viewer 페이지가 404"

`figma-pipeline.yml`의 `Publish designer review viewer` 스텝이 실패했거나 Pages가 활성화되지 않았을 가능성. 확인:
```bash
gh run view <run-id> --log | grep -E "Pages|viewer-publish"
```
Repository → Settings → Pages → source가 "GitHub Actions"로 돼있는지 확인.

### "자동 등록 PR이 안 만들어져요"

새 top-level 화면은 **2회 연속 sighting** 후에만 자동 등록됩니다 (약 24h). 직후엔 안 나옵니다. `.automation/audit-state.json`에 sighting count가 기록됩니다 — 매일 audit 후 PR이 나올 때까지 1일 더 대기.

또한 `AUDIT_APP_ID` / `AUDIT_APP_PRIVATE_KEY` secret이 없으면 `GITHUB_TOKEN` fallback이 되는데, 이 경우 PR은 만들어지지만 `pull_request: opened` cascade가 안 됩니다 ([README §5 GitHub App 설치](#5-github-app-설치-자동-등록-pr용)).

### "본문이 잘려요"

Slack은 4000자, Discord는 2000자 한도가 있어 본문이 채널별 cap(3500/1800)을 넘으면 자동 truncation됩니다. 끝에 `• … (상세는 viewer 참조)` marker가 붙고 viewer 링크는 항상 보존됩니다. 전체 상세는 viewer 페이지에서 확인.

---

## 라이선스 / 기여

내부 자동화 도구로 시작한 프로젝트입니다. 외부 기여는 issue로 먼저 논의해 주세요.
