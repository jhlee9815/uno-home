# Task 6-8 Stage 0 — Figma API Field Summary

> 실행: 2026-05-20 22:26 KST
> 브랜치: `feature/task-8-ds-compliance`
> 명령: `npm run figma:task8:stage0`
> 원본 local artifact: `.automation/task-8-stage0/latest-summary.json` (git 미추적)

## Sample 대상

| nodeId | 반환 | 이름 | descendant 수 |
|---|:-:|---|---:|
| `7:3` | ✅ | Phone · Home — Balance | 112 |
| `7:4` | ✅ | Phone · Cards — Select Card | 49 |
| `7:5` | ✅ | Phone · Send Money | 74 |
| `10:62` | ✅ | Send money | 1 |

## Field 관찰 결과

| nodeId | boundVariables | styleId 계열 | imageRef | INSTANCE_SWAP | raw color paint | TEXT style object |
|---|---:|---:|---:|---:|---:|---:|
| `7:3` | 59 | 0 | 9 | 0 | 71 | 27 |
| `7:4` | 32 | 0 | 0 | 0 | 37 | 19 |
| `7:5` | 50 | 0 | 1 | 0 | 56 | 21 |
| `10:62` | 1 | 0 | 0 | 0 | 1 | 1 |
| **합계** | **142** | **0** | **10** | **0** | **165** | **68** |

## 결론

1. `boundVariables`가 실응답에 존재한다. 따라서 detached-style v1은 **boundVariables 부재**를 주요 신호로 사용할 수 있다.
2. `fillStyleId` / `strokeStyleId` / `textStyleId` / `effectStyleId`는 sample에서 관찰되지 않았다. style id 기반 token name resolve는 v1 범위 밖으로 유지한다.
3. `IMAGE` paint의 `imageRef`가 10건 관찰됐다. v1 image-change detection은 image fill 기준으로 구현 가능하다.
4. `INSTANCE_SWAP`은 sample에서 관찰되지 않았다. task-8 v1은 기존 설계대로 image-only로 제한하고 INSTANCE_SWAP/component path는 v2/task-10 후보로 둔다.
5. 요청 node 4개가 모두 Figma Nodes API에서 반환됐다. Stage 1 schema contract로 진행 가능하다.

## Stage 1 반영 지침

- `DetachedStyleEntry`는 `boundVariables`/paint `boundVariables` 부재 + raw value 존재를 기반으로 보수적으로 생성한다.
- style id가 없을 수 있으므로 `suggestedToken`은 v1에서 계속 `null`로 둔다.
- `AssetRefEntry`는 `nodeId + paintIndex + imageRef` stable key로 비교한다.
- `INSTANCE_SWAP` 필드는 지금 구현하지 말고 schema 주석 또는 후속 task로만 남긴다.
