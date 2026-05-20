# Task 6-8 — DS Compliance Detection Core

> **목표**: cron 실행 시 (a) DS 토큰 미사용 색상/타이포 (detached styles), (b) 이미지/아이콘 교체, (c) 등록 화면 안에 새로 추가된 프레임 — 3종을 구조화해 감지. 자동 코드 반영은 안 함, 모두 report-only.
> **예상 시간**: 7-9시간 (Codex 견적, 5-6h optimistic 대비 보강)
> **선행**: task-3/4 완료 ✅. task-5/6 무관 (병렬 가능).
> **블록 해제**: task-9 (Report UX + Labels)
> **상태**: 🛠 설계 확정 (2026-05-20 22:00 KST) — 코드 미진행. 운영 관찰 기간 종료 후 진입.
> **설계 검증**: Codex `019e4xxx-xxxx` (별도 session) — `GO, 단 task-8/task-9로 분리하고 task-8 범위는 "구조화된 detection core"로 고정` 판정.

## 8-1. 배경 / 사용자 요구

사용자 요구 3개 (2026-05-20):
1. **DS 미사용 감지** — 마지막 baseline 이후 등록 프레임에서 토큰 안 쓰고 raw 색상/타이포로 작업한 것 (예: `#ff0000` 직접 입력, `boundVariables` 부재).
2. **이미지/아이콘 교체** 감지.
3. **새 프레임 추가** + 그 안에서 DS 사용 여부 검사. 디자이너 + 개발자 둘 다 어디 무엇이 어긋났는지 알 수 있게.

> ⚠️ 본 task는 **detection core**만. 디자이너+개발자 친화 표시(스크린샷/코드 path 매핑/Slack 메시지 풍부화)는 [task-9 (Report UX + Labels)](./task-9-report-ux-labels.md) 로 분리. classify JSON schema가 안정돼야 report가 의미 있어지므로 task-8 → task-9 순서.

## 8-2. 현재 시스템 사실 (2026-05-20 기준)

- `snapshot.ts`가 `/v1/files/<key>/nodes?ids=...`로 등록 노드 ID만 fetch. 자손 트리는 응답에 포함되지만 자손 ID 별도 추출 안 함.
- `snapshot-node.ts`의 `hashVisualProps(node)`는 **root 노드의 `{type, fills, effects}`만 hash**. 자손 트리 fills/imageRef는 자동 포함 안 됨. ([snapshot-node.ts:211](../../scripts/pipeline/lib/snapshot-node.ts#L211))
- `boundVariables` / `fillStyleId` / `textStyleId` 추적 0 — DS 사용 여부 데이터가 없음.
- `classify`는 `decision: 'auto-apply' | 'report-only'` 만. subcategory 없음.
- `cs-{id}.md` 본문이 곧 GitHub Issue body → report 포맷이 곧 디자이너+개발자가 보는 화면.

## 8-3. 설계 결정 (Codex 검증 반영)

| 결정 사항 | 선택 | 사유 |
|---|---|---|
| 새 프레임 정의 | FRAME 타입만. COMPONENT/INSTANCE/GROUP 제외. | Codex: COMPONENT/INSTANCE/GROUP 까지 넣으면 noise. ignore list로 wrapper/auto-layout 이름 제외 옵션. |
| 자식 트리 깊이 | 전체 깊이 | Codex: 전체 권장. 단 max depth config는 후속. |
| 중복/우선순위 | 같은 노드가 `new-frame` + `detached-style` 동시 잡혀도 허용 | Codex: parent grouping으로 표시 분리. dedupe로 숨기지 않음. |
| suggestedToken 매핑 | v1은 raw 값만 표시, `suggestedToken: null` | Codex: 잘못 추천하는 토큰은 없는 것보다 나쁨. |
| token name resolve | 미적용 (Enterprise + `file_variables:read` 필요) | first iteration은 "bound 여부 감지"까지만. |
| 아이콘 교체 범위 | v1은 imageRef만. INSTANCE_SWAP / component path는 task-8 v2 또는 task-10. | Codex 지적: imageRef만으로는 "아이콘 교체" 불완전. v1은 명시적으로 제한. |
| 등록 화면 밖 새 top-level frame | 본 task 범위 외 | Codex 지적: `?depth=2` 추가 호출 / register-file 연결 필요. 별도 task. |

## 8-4. Schema contract (Stage 1에서 확정)

```typescript
// lib/compliance-types.ts (신규)

interface DetachedStyleEntry {
  nodeId: string;             // 예: '7:12'
  nodePath: string[];         // ['Pesse Home', 'Header', 'Title']
  kind: 'color' | 'typography' | 'effect';
  property: string;           // 'fill', 'stroke', 'fontFamily', 'fontSize', ...
  rawValue: unknown;          // { r:1,g:0,b:0,a:1 } 또는 'Roboto', 16 등
  suggestedToken: null;       // v1에서는 항상 null. v2 매핑 시 토큰 키.
}

interface DescendantFrameEntry {
  nodeId: string;
  nodePath: string[];
  name: string;
  parentRegisteredKey: string;   // mapping key, 예: 'pesse_home'
}

interface AssetRefEntry {
  nodeId: string;
  nodePath: string[];
  kind: 'image';                  // v1은 image만. v2에서 'instance-swap' | 'component-instance' 추가.
  paintIndex: number;             // fills array의 index
  ref: string;                    // imageRef
}

interface SnapshotNodeEntry {
  // ... 기존 필드 (textHash, propsHash, componentPropsHash, ...)
  detachedStyles: DetachedStyleEntry[];
  descendantFrames: DescendantFrameEntry[];
  assetRefs: AssetRefEntry[];
}

interface ClassifiedChange {
  // ... 기존 필드 (key, nodeId, classes, decision, ...)
  subcategory: 'text-change' | 'props-change' | 'image-change' | 'detached-style' | 'new-frame';
}
```

## 8-5. Stage 분해 (Codex 검증 반영)

| Stage | 내용 | 시간 |
|:-:|---|---|
| **0** | **필수 게이트** — Figma REST `/v1/files/<key>/nodes?ids=7:3,7:4,7:5,10:62` 실응답 sample 수집 + 분석. `boundVariables` / `fillStyleId` / `textStyleId` / `IMAGE.imageRef` / `INSTANCE_SWAP` 필드 존재성 확인. 판정 기준 confirm. | 30분 |
| **1** | Schema contract — `lib/compliance-types.ts` + JSON 예시 1-2개. SnapshotNodeEntry / ClassifiedChange 확장 정의. (코덱스 1차 검토 권장) | 30분 |
| **2** | Deep traversal extraction — `snapshot-node.ts`에 `extractDetachedStyles`, `extractDescendantFrames`, `extractImageRefs` 추가. **root 노드 hash만 보는 게 아니라 자손 트리 전체 순회**. ignore list 옵션 (`_`, `wrapper`, `Auto layout`류 이름). | 1.5-2시간 |
| **3** | Diff stable-key comparison — `diff.ts`에 `newDetachedStyles` (`nodeId+kind+property`), `newFrames` (`nodeId`), `changedImageRefs` (`nodeId+paintIndex+imageRef`). baseline vs head list comparison. | 45분 |
| **4** | Classify + Report integrated — classify에 `subcategory` 추가, 모두 report-only. report에 `## Detached Styles` / `## New Frames in Tracked Screens` / `## Image Changes` 섹션. parent grouping ("New frame contains detached styles"). figma 직접 가는 URL 포함. | 1시간 |
| **5** | Fixture + Unit tests — 최소 4 fixture: detached color / detached typography / nested imageRef change / nested new frame. `snapshot-node.test.ts`, `classify-diff.test.ts` 확장. | 1시간 |
| **6** | 실 figma 자연 트리거 검증 — push 후 cron 또는 수동 트리거. cs report 새 섹션 의도대로 채워지는지 + noise/false positive 점검. | 30분 |
| **7** | 문서화 + commit/push — 본 doc 완료 기록 + phase-plan-6 갱신 + plan/TODO 갱신. | 30분 |

**총**: 7-9시간 (1일 작업 분량).

## 8-6. 위험 / 미정

| # | 위험 | 완화책 |
|:-:|---|---|
| 1 | Figma REST `boundVariables` 필드가 라이브러리 미공개 시 비어 있을 수 있음 | Stage 0에서 실응답으로 확정. `boundVariables` 없으면 "bound style 정보 부족 — bound 판정 보수적" 모드로 fallback. |
| 2 | suggestedToken 자동 매핑이 잘못된 추천을 만들 위험 | v1에서 항상 `null`. v2에서 tokens.json 기반 best-effort 도입 + UI에서 "추천(beta)" 표기. |
| 3 | auto-layout이 자동 생성하는 wrapper frame이 `new-frame`으로 잡혀 noise | Stage 2에서 ignore list (`_`, `Wrapper`, `Auto layout`, `Container` 이름 prefix/exact match). |
| 4 | 자식 트리 전체 깊이 추적 → 큰 화면(Pesse Cards 등) snapshot 응답 크기 증가 | Figma API 응답이 이미 자손 트리 다 가져오므로 추가 네트워크 비용 없음. 처리 시간만 증가 — fixture로 100ms 이내 확인. |
| 5 | 같은 노드가 `new-frame` + `detached-style` 동시 분류 | report parent grouping으로 표시: "New frame `X` contains detached styles: …" |
| 6 | 등록 화면 밖에 새 top-level frame 만들면 못 잡음 | 본 task 범위 외. 별도 task (figma file watcher 강화) — Phase 7 후보 또는 task-10. |
| 7 | 아이콘 교체가 INSTANCE_SWAP/component 경로면 imageRef로 못 잡힘 | v1은 imageRef만 명시적으로 한정. cs report에 "v1 scope: image only" 명시. INSTANCE_SWAP은 v2. |

## 8-7. 검증

### 단위 (Stage 5)
4 fixture 모두 PASS:
- detached color: hex fill, no boundVariables → DetachedStyleEntry 1건 추출
- detached typography: 직접 fontFamily/fontSize, no textStyleId → DetachedStyleEntry 1건
- nested imageRef change: 자손 노드 IMAGE fill의 imageRef baseline→head 변경 → AssetRefEntry diff 1건
- nested new frame: 자손 트리에 신규 FRAME node id 등장 → DescendantFrameEntry 1건

### 통합 (Stage 6)
실 figma 파일에서 다음 4종 직접 수정 후 cron 1회 또는 수동 트리거:
1. Pesse Home 안에 색상 fill을 hex 직접 입력 → cs report `## Detached Styles` 에 1건
2. Pesse Send CTA 아이콘 imageRef 변경 → `## Image Changes` 에 1건
3. Pesse Cards 안에 새 FRAME 추가 → `## New Frames in Tracked Screens` 에 1건
4. 새 FRAME 안에 hex 색상 → `## New Frames` 안에 sub-bullet으로 detached 표시

성공: 4종 모두 정확히 분류 + figma URL 작동 + false positive 0건.

## 8-8. Codex 1차 검증 요약 (2026-05-20)

GO 판정. 주요 조정 사항:
- Stage 0 필수 게이트 (Figma API 실응답 확보 없이는 detached 판정 흔들림).
- Schema contract를 Stage 1로 별도 분리 (코드 작성 전 타입 고정).
- Stage 2 = root hash 확장이 아니라 **deep traversal**.
- Stage 3에 stable key 정의 강제.
- Stage 4에서 classify subcategory + report section을 같은 contract로 함께 설계.
- task-8 / task-9 분리: detection core (본 task) vs report UX + labels (다음 task).
- 시간 견적 5-6h → 7-9h 보강.

위험 7개 중 #6 (등록 밖 새 top-level frame), #7 (INSTANCE_SWAP / component path)은 task-8 v1 범위 외임을 명시.

## 8-9. 다음 단계

1. 운영 관찰 기간 (~2026-05-23) 통과 확인.
2. 사용자 진입 승인 시 Stage 0 시작 (figma API 실응답 sample 수집).
3. Stage 1 schema contract 확정 후 코덱스 2차 검증 권장.
4. Stage 2-7 진행.
5. task-9 (Report UX + Labels)로 이어짐.
