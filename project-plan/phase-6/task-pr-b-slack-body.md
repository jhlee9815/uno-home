# Phase 2 (PR-B) — figma-pipeline Slack 본문 강화

> 작성: 2026-05-26
> 상태: 🟢 design draft (Codex 사전 검증 PASS — 조건부 OK, 5가지 보강 반영)
> 관련 코드: `scripts/pipeline/post-run-actions.ts`, `scripts/pipeline/lib/category-labels.ts`
> 선행 PR: #131 (new-frame compliance), #132 (audit→slack)
> 추적 cs 예: `cs-2026-05-25T11-44-34` (Issue #127) — 8건인데 카테고리 라인 0개
> Codex 검증 일자: 2026-05-26

## 1. 문제

현재 `figma-pipeline` 슬랙 알림은 5개 compliance bucket(`text-change`/`props-change`/`image-change`/`detached-style`/`new-frame`)만 라인으로 출력하고, classifier가 생성하는 **raw class(`structure`/`token`/`layout`/`asset`)는 슬랙에서 0% 노출**됨.

결과: `cs-2026-05-25T11-44-34`처럼 structure/token만 8건 발생한 경우 디자이너는 슬랙에서 다음만 본다.

```
🎨 Figma 변경 감지 — cs-2026-05-25T11-44-34
• 전체: 8건 (자동 반영 후보 0건, 디자이너 검토 8건)
• 리뷰 viewer: cs-2026-05-25T11-44-34
• repo: jhlee9815/design-review-bot
```

→ viewer를 열기 전까지 "구조 변경 5건 / 토큰 변경 2건 / 레이아웃 1건" 중 무엇인지 모름. 검출 시스템 96%의 정보가 알림 단계에서 휘발.

## 2. 완료 조건

- ✅ raw class도 카테고리 라인으로 표시 (구조/토큰/레이아웃/에셋)
- ✅ structure 라인은 추가/삭제/toggle 세분
- ✅ 영향 화면 top-3 inline
- ✅ 카테고리당/본문 cap 적용
- ✅ 기존 5개 compliance bucket 라인 회귀 없음

## 3. Before / After 본문

### Before (현재, cs-2026-05-25T11-44-34 실제)

```
🎨 *Figma 변경 감지* — `cs-2026-05-25T11-44-34`
• 전체: 8건 (자동 반영 후보 0건, 디자이너 검토 8건)
• 리뷰 viewer: <https://.../cs/cs-2026-05-25T11-44-34/|cs-2026-05-25T11-44-34>
• repo: <https://github.com/jhlee9815/design-review-bot|jhlee9815/design-review-bot>
```

### After (강화 후, 같은 cs)

```
🎨 *Figma 변경 감지* — `cs-2026-05-25T11-44-34`
• 🧱 구조 변경: 5건 (추가 3·삭제 2)
• 🎨 디자인 토큰 변경: 2건
• 📐 레이아웃 변경: 1건
• 전체: 8건 (자동 반영 후보 0건, 디자이너 검토 8건)
• 영향 화면 top-3: Pesse Apple-inspired (4) · Phone · Home (3) · test1 (1)
• 리뷰 viewer: <https://.../cs/cs-2026-05-25T11-44-34/|cs-2026-05-25T11-44-34>
• repo: <https://github.com/jhlee9815/design-review-bot|jhlee9815/design-review-bot>
```

### After (compliance 50+건, cap 발동)

```
🎨 *Figma 변경 감지* — `cs-2026-05-25T01-12-45`
• 🆕 새 화면 추가: 2건
• 🎨 디자인 시스템 미사용: 1083건 (외 1083건은 viewer 참조)
• 🖼️ 이미지 변경: 5건
• 🧱 구조 변경: 3건
• 전체: 1093건 (자동 반영 후보 0건, 디자이너 검토 1093건)
• 영향 화면 top-3: Pesse Apple-inspired (980) · Phone · Cards (108) · Phone · Send (5)
```

## 4. 변경 지점 — 파일·라인

### 4-1. `scripts/pipeline/lib/category-labels.ts`

- `RAW_CLASS_LABEL_KO` (line 30), `RAW_CLASS_EMOJI` (line 38) — **export** 추가. 현재 module-local.
- 신규 함수 `rawClassLabel(raw: string)`, `rawClassEmoji(raw: string)` 또는 기존 `labelForClass`/`emojiForClass` 재사용.

### 4-2. `scripts/pipeline/post-run-actions.ts`

#### `categoryCounts()` (line 155-192) 확장 — 분리 구조 (Codex 권고 #1)

현재 시그너처: `Partial<Record<ComplianceSubcategory, number>>`
신규 시그너처:
```ts
interface CategoryBreakdown {
  compliance: Partial<Record<ComplianceSubcategory, number>>;
  raw: Partial<Record<'token' | 'structure' | 'layout' | 'asset', number>>;
  structureSubKinds: { added: number; removed: number; toggle: number };
}
```

**카운트 규칙 (Codex 권고 #2 반영)**:
1. 기존 compliance arrays 카운트는 그대로 유지 (1번 분기).
2. **raw class 카운트는 `subcategories` 유무와 무관하게 항상 `classes`에서 별도 산출**.
3. raw는 **unbucketed raw class만** count: `token` / `structure` / `layout` / `asset`. 즉 `detached-style`/`new-frame`/`image-change`/`text`/`component-props`는 raw에서 카운트하지 않음 (compliance bucket이 흡수).
4. classes=`['detached-style','structure']` + `compliance.newDetachedStyles.length = 2`인 경우 기대값:
   - `compliance['detached-style'] = 2`
   - `raw.structure = 1`
   - `raw['detached-style']` 카운트 X (unbucketed만 카운트)

#### structure 추가/삭제 세분 — reasons anchored pattern (Codex 권고 #5)

실제 `diff-snapshot.ts`가 생성하는 reason 문자열을 anchored regex로 매칭:
- 추가: `/missing from base snapshot/`
- 삭제: `/missing from head snapshot/`
- toggle: `/boundingBox changed to or from null/`

⚠️ `"added"` / `"removed"` 단순 substring 매칭은 `"newly added node"` 같은 compliance reason과 오탐. 반드시 위 anchored pattern 사용. PR-C에서 schema 확장으로 안전화.

#### `buildLocalizedSummary()` (line 245-264) 확장

추가 라인 (순서 deterministic):
1. compliance bucket 라인 (현재) — 5개 fixed order: detached-style / new-frame / image-change / text-change / props-change
2. raw class 라인 (신규) — fixed order: structure / token / layout / asset
3. 전체 라인 (현재)
4. **영향 화면 top-3 라인 (신규)**

cap 발동 문구 (Codex 권고 #3 반영):
- `🎨 디자인 시스템 미사용: 1083건 (상세는 viewer 참조)` — 동어반복 회피
- 50건 이상이면 항상 `(상세는 viewer 참조)` 첨부

#### 영향 화면 top-3 산출 — finding-weight (Codex 권고 #4)

```ts
interface AffectedScreen {
  key: string;          // aggregation key: change.nodeId ?? change.key ?? change.nodeName
  displayName: string;  // change.nodeName
  weight: number;
}

function computeWeight(change): number {
  let w = 0;
  if (change.compliance) {
    w += change.compliance.newDetachedStyles?.length ?? 0;
    w += change.compliance.newFrames?.length ?? 0;
    w += change.compliance.changedImageRefs?.length ?? 0;
  }
  // raw unbucketed classes count once
  for (const c of change.classes ?? []) {
    if (['token','structure','layout','asset'].includes(c)) w += 1;
  }
  // legacy text/props without compliance
  if (!change.compliance) {
    for (const c of change.classes ?? []) {
      if (c === 'text' || c === 'component-props') w += 1;
    }
  }
  return w;
}
```

정렬: `weight desc, displayName asc, key asc` (deterministic tie-break).

#### cap 정책 — 채널별 분리 (Codex 권고 #3)

| 항목 | 값 | 이유 |
|---|---|---|
| 카테고리 cap 문구 | `(상세는 viewer 참조)` | 50건↑일 때만 첨부 |
| **Slack `text` cap** | 3500자 | 공식 4000자 한도 - viewer/repo 여유 500자 |
| **Discord `content` cap** | 1800자 | 공식 2000자 한도 - viewer/repo 여유 200자 |
| 영향 화면 top-N | 3 | 한 줄 가독성 |
| 라인 truncation 순서 | 마지막 라인부터 (top-3 우선 유지 안 함; viewer/repo는 wrapper가 별도로 prepend/append 보장) | wrapper에서 channel-specific cap 적용 |

**채널별 처리 방식**:
- `buildLocalizedSummary({ maxChars }: { maxChars?: number })` — `maxChars` 옵션 받음
- `notifySlack()`: `buildLocalizedSummary({ maxChars: 3500 })`
- `notifyDiscord()`: `buildLocalizedSummary({ maxChars: 1800 })`
- viewer/repo line은 wrapper에서 별도 append (cap 영향 X)

## 5. 테스트 fixture

`scripts/pipeline/post-run-actions.test.ts` (신규)

| 케이스 | 입력 | 기대 출력 |
|---|---|---|
| T1: 기존 5 bucket 회귀 | 1083 detached + 2 new-frame + 5 image-change | compliance 3 라인 + 전체 + top-3 |
| T2: raw class only (cs-2026-05-25T11-44-34) | structure 5 + token 2 + layout 1 | raw 3 라인 + 전체 + top-3 |
| T3: 혼합 | 5 detached + 3 structure + 1 token | compliance + raw 라인 + 전체 + top-3 |
| T4: cap 50+ | 1083 detached | `(상세는 viewer 참조)` 첨부 |
| T5: top-3 동률 | 같은 weight 3개 화면, 다른 nodeName | displayName asc 정렬 |
| **T6: 같은 nodeName 다른 nodeId** (Codex 추가) | 동일 nodeName 2개 change, 다른 nodeId | nodeId 기준 분리 카운트 |
| T7: structure sub-kind | reasons에 `missing from base/head snapshot` 혼합 | `5건 (추가 3·삭제 2)` |
| **T8: structure toggle** (Codex 추가) | reasons에 `boundingBox changed to or from null` | toggle count 반영 |
| **T9: legacy classes only — token** (Codex 추가) | subcategories=[], classes=`['token']` | raw `token=1` |
| **T10: legacy mixed text + layout** (Codex 추가) | subcategories=[], classes=`['text','layout']` | text-change=1 + raw layout=1 |
| **T11: legacy detached+structure no compliance** (Codex 추가) | subcategories=[], classes=`['detached-style','structure']`, compliance 없음 | detached-style=1 + raw structure=1 |
| T12: subcategories + raw 혼합 | subcategories=`['detached-style']`, classes=`['detached-style','structure']`, compliance.newDetachedStyles.length=2 | detached-style=2 + raw structure=1 |
| **T13: empty changes** (Codex 추가) | classified.changes=[] | top-3 라인 미출력, 전체 0건 라인만 |
| **T14: unknown class** (Codex 추가) | classes=`['unknown']` | raw 라인에 미포함 (unbucketed만 카운트) |
| **T15: Slack cap (3500자)** | 모든 카테고리 1000+건 | 3500자 이내, 라인 truncation deterministic |
| **T16: Discord cap (1800자)** (Codex 추가) | 같은 입력 → notifyDiscord 경로 | 1800자 이내 |
| **T17: viewer/repo line 보존** (Codex 추가) | 본문 cap 발동 | viewer/repo line은 wrapper에서 append되어 truncation 영향 X |
| **T18: deterministic ordering** (Codex 추가) | compliance + raw 혼합 | compliance fixed order → raw fixed order → 전체 → top-3 |

## 6. 회귀 위험 — Codex 사전 검증 완료 사항

| # | 항목 | Codex 결론 | 반영 위치 |
|---|---|---|---|
| 1 | compliance bucket 중복 카운트 | ✅ 의도 맞음, 구현은 raw에 unbucketed만 카운트 | §4-2 categoryCounts 규칙 #3 |
| 2 | legacy fixture 영향 | ✅ 의도된 변경. 단 multi-class change는 category sum > total 가능 (PR-B 목표와 일치) | T9-T11 fixture |
| 3 | structure reason 패턴 | ⚠️ 단순 매칭 위험 → anchored regex 사용 | §4-2 structure 세분 |
| 4 | cap 정책 | ⚠️ 채널별 분리 필요 (Slack 3500 / Discord 1800) + 문구 `(상세는 viewer 참조)` | §4-2 cap 표 |
| 5 | top-3 weight | ⚠️ classes.length 과가중 → finding-weight + nodeId aggregation | §4-2 영향 화면 |
| 6 | Discord 공유 | ✅ 의도. semantic summary 공유, channel-specific cap 분리 | wrapper 분리 |
| 7 | 빈 카테고리 / unknown class | ✅ T13/T14에서 처리 | T13/T14 fixture |

## 7. 작업 외 — 후속 분리

- **PR-C**: classify-diff에 structure `subKind`(`added`/`removed`/`toggle`) 부여 — schema 확장
- **PR-D**: audit-slack(`lib/audit-slack.ts`)도 같은 카테고리 라인 정책 적용 — 일관성 (현재는 audit 슬랙은 자체 포맷)
- **운영 정리**: stale manual-edit PR #20/#40/#64/#71/#129 닫기, baseline 디렉토리 prune

## 8. 진행 체크리스트

- [ ] Codex 사전 검증 (이 문서)
- [ ] feat/pr-b-slack-body 브랜치 생성 (from main)
- [ ] `category-labels.ts` export 추가
- [ ] `categoryCounts()` 확장
- [ ] `buildLocalizedSummary()` 확장
- [ ] `post-run-actions.test.ts` 신규 (T1~T7)
- [ ] `npm run lint && npm run build` PASS
- [ ] Codex post-impl 검증
- [ ] PR 생성 + auto-merge
