# Task 6-8 Stage 1 — Schema Contract

> 작성: 2026-05-20 22:34 KST
> 코드: [`scripts/pipeline/lib/compliance-types.ts`](../../scripts/pipeline/lib/compliance-types.ts)
> 선행 근거: [`task-8-stage0-field-summary.md`](./task-8-stage0-field-summary.md)

## Contract 요약

Stage 1은 task-8 detection core가 공유할 타입 경계를 고정한다.

| 타입 | 역할 |
|---|---|
| `DetachedStyleEntry` | DS token/style binding 없이 raw 색상·타이포·effect를 직접 사용한 노드 기록 |
| `DescendantFrameEntry` | 등록된 screen 아래 새로 발견된 descendant `FRAME` 기록 |
| `AssetRefEntry` | image fill의 `imageRef` 기록 |
| `ComplianceSnapshotFields` | snapshot node entry에 추가될 compliance 배열 3종 |
| `ComplianceDiffSummary` | baseline/head 비교 후 새 detached style, 새 frame, 변경 imageRef 묶음 |
| `ComplianceSubcategory` | classify/report에서 사용할 하위 분류 |

## Stable key

| 항목 | stable key | 이유 |
|---|---|---|
| detached style | `nodeId::kind::property` | raw value 변화는 같은 violation 업데이트로 보고 중복 Issue 폭주 방지 |
| descendant frame | `nodeId` | Figma node id 자체가 새 frame 식별자 |
| image ref | `nodeId::paintIndex` | 같은 paint slot의 `imageRef` 변경을 비교하기 위함 |

## v1 제약

- `suggestedToken`은 항상 `null`.
- `INSTANCE_SWAP`은 Stage 0 sample에서 관찰되지 않았으므로 v1 schema에 넣지 않는다.
- styleId 계열은 sample에서 0건이므로 evidence 필드에 `styleId: string | null`로만 보관한다.
- 실제 감지는 Stage 2에서 `boundVariables` 부재 + raw value 존재 기반으로 보수 구현한다.

## JSON 예시

```json
{
  "detachedStyles": [
    {
      "nodeId": "10:62",
      "nodeName": "Send money",
      "nodePath": ["Phone · Send Money", "CTA", "Send money"],
      "kind": "typography",
      "property": "fontSize",
      "rawValue": 16,
      "suggestedToken": null,
      "evidence": {
        "hasNodeBoundVariables": false,
        "styleId": null
      }
    }
  ],
  "descendantFrames": [
    {
      "nodeId": "99:1",
      "nodeName": "Promo Banner",
      "nodePath": ["Phone · Home — Balance", "Promo Banner"],
      "name": "Promo Banner",
      "parentRegisteredKey": "pesse_home"
    }
  ],
  "assetRefs": [
    {
      "nodeId": "20:9",
      "nodeName": "Card art",
      "nodePath": ["Phone · Home — Balance", "Card art"],
      "kind": "image",
      "paintIndex": 0,
      "ref": "abc123"
    }
  ]
}
```

## 다음 단계

Stage 2에서 `snapshot-node.ts`에 deep traversal extractor를 추가하고 `SnapshotNodeEntry`에 `ComplianceSnapshotFields`를 연결한다.
