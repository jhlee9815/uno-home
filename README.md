# design-review-bot

Figma → 코드 디자인 변경을 자동으로 감지·분류·알리는 GitHub Actions 기반 자동화 봇.

디자이너가 Figma에서 화면을 수정하면, 봇이 일정 주기로 변경 사항을 잡아 카테고리별로 분류하고, 디자이너에게 GitHub Issue / Slack / 시각 비교 viewer로 알리며, 개발 코드가 Figma와 어긋난 부분(디자인 시스템 미사용, 새 화면 추가, 이미지 변경 등)을 PR로 자동 등록합니다.

> **선행 조건**: 이 봇은 사용 중인 디자인 시스템을 Figma 측에 등록(컬러/타이포 변수, 컴포넌트, 스타일)한 뒤에야 의미 있는 감지를 합니다. 토큰이 등록돼 있어야 "디자인 시스템 미사용"을 변별할 수 있고, 컴포넌트가 등록돼 있어야 INSTANCE 교체를 잡을 수 있습니다.

---

## 빠르게 보는 결과 (Quick Result)

스케줄러가 한 번 돌면 디자이너는 보통 이 3가지를 받습니다:

1. **Slack 통합 알림** (1일 1회 기준):
   ```
   🎨 Figma 변경 감지 — cs-2026-05-22T01-12-45
   • 🆕 새 화면 추가: 2건
   • 🎨 디자인 시스템 미사용: 1083건 (색상 980, 타이포 100, 효과 3)
   • 🖼️ 이미지 변경: 5건
   • 전체: 1090건 (자동 반영 후보 0건, 디자이너 검토 1090건)
   • 오늘의 audit Issue: Issue #31
   • 새 화면 등록 PR: PR #30
   • 리뷰 viewer: cs-2026-05-22T01-12-45
   ```

2. **GitHub Issue** (`audit` 라벨): 감지된 미사용/미등록 항목을 표로 정리한 Markdown 리포트.

3. **GitHub Pages viewer**: baseline ↔ 현재 스크린샷을 좌우 비교하고, 각 변경에 카테고리 chip(🆕 새 화면 추가, 🎨 디자인 시스템 미사용, …)을 붙인 HTML.

추가로, **새로 등록할 만한 화면이 발견되면 봇이 자동으로 Pull Request를 만들어** `config/figma-mapping.yaml`에 추가합니다. 디자이너 또는 관리자가 머지 한 번으로 다음 cycle부터 그 화면 내부도 감지 대상에 포함됩니다.

---

## 작동 방식 (How it works)

### 워크플로 2개로 분리

| 워크플로 | 일정 | 역할 |
|---|---|---|
| `figma-audit.yml` | 매일 00:00 UTC (09:00 KST) | 디자인 시스템 미사용 + 새 top-level 화면 감지 → Issue / 자동 등록 PR |
| `figma-pipeline.yml` | 2시간마다 + audit 완료 후 cascade | baseline 스냅샷 비교 → cs-* 리포트 + viewer + Slack |

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
tsconfig.json                # 스크립트 빌드 설정
eslint.config.js             # 린트 설정
```

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
    code: ../src/screens/Home.tsx
    targetType: screen
    automation:
      apply: report-only      # 또는 auto-apply (텍스트 marker 한정)
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

## 라이선스 / 기여

내부 자동화 도구로 시작한 프로젝트입니다. 외부 기여는 issue로 먼저 논의해 주세요.
