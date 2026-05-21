# Task 6-8 Execution Goal — DS Compliance Detection Core

> 생성: 2026-05-20 KST
> 브랜치: `feature/task-8-ds-compliance`
> 공유 대상: Claude / Codex 공용 핸드오프
> 정식 설계 문서: [`task-8-ds-compliance-detection.md`](./task-8-ds-compliance-detection.md)

## 목표

Figma 등록 화면 내부에서 다음 3종을 구조화해 감지하는 detection core를 만든다. 자동 코드 반영은 하지 않고 모두 report-only로 보낸다.

1. DS 토큰/스타일 미사용 색상·타이포(detached style)
2. 이미지 fill의 `imageRef` 변경
3. 등록 화면 내부에 새로 추가된 descendant `FRAME`

## 현재 진행 지점

2026-05-21 10:43 KST 기준 Stage 0-6 구현과 검증을 완료했다. Draft PR #9가 열려 있으며 merge 전 review/CI 확인만 남았다.

## 진행 단계

| Stage | 산출물 | 상태 |
|:-:|---|:-:|
| 0 | Figma Nodes API 실응답 field summary + 판정 기준 확인 | ✅ 완료 |
| 1 | `lib/compliance-types.ts` schema contract | ✅ 완료 |
| 2 | `snapshot-node.ts` deep traversal extractor | ✅ 완료 |
| 3 | `diff-snapshot.ts` stable-key comparison | ✅ 완료 |
| 4 | classify subcategories + report section 통합 | ✅ 완료 |
| 5 | fixture/unit/full local tests | ✅ 완료 |
| 6 | 실 Figma trigger 검증 | ✅ 완료 |
| 7 | 문서화 + plan/TODO 갱신 | ✅ local 완료 |


## 바로 다음 작업 — PR Review / Merge Gate

다음 담당자가 바로 시작할 작업은 PR #9 review/CI 확인이다. Stage 6은 완료됐다.

### Stage 6 evidence

- 최종 cs: `cs-2026-05-21T01-42-28`
- Figma temp probe: 생성 후 삭제 완료 (`probeCount: 0`)
- 감지 class: `detached-style`, `new-frame`, `image-change`
- apply: noop
- verify: build/lint passed
- rollout 보강: old-schema approved baseline은 compliance diff를 skip해 첫 운영 run flood를 방지한다.

### Merge 전 확인

- Draft PR #9 CI/review 확인
- merge 후 schema-compatible baseline refresh/promote 운영 절차 확인

## Stage 0 실행 명령

```bash
npm run figma:task8:stage0
```

기본 sample node:
- `7:3` — Pesse Home
- `7:4` — Pesse Cards
- `7:5` — Pesse Send Money
- `10:62` — Pesse Send CTA text descendant

커스텀 sample:

```bash
TASK8_SAMPLE_NODE_IDS="7:3,7:4,7:5,10:62" npm run figma:task8:stage0
```

## Stage 0 판정 기준

- `boundVariables` 존재 여부 확인
- `fillStyleId` / `strokeStyleId` / `textStyleId` / `effectStyleId` 존재 여부 확인
- `IMAGE` paint의 `imageRef` 존재 여부 확인
- `INSTANCE_SWAP` component property 존재 여부 확인
- 요청한 모든 node id가 Figma Nodes API에서 반환되는지 확인

## 다음 핸드오프 규칙

- Stage 0 결과가 없으면 Stage 1+ 코드를 시작하지 않는다.
- token/style binding field가 sample에 없으면 detached-style v1은 보수적 heuristic으로 설계한다.
- `INSTANCE_SWAP`은 sample에서 보이더라도 task-8 v1 범위에 넣지 않고 v2/task-10 후보로 둔다.

## 진행 기록

- 2026-05-20 22:26 KST — Codex가 `npm run figma:task8:stage0` 실행 완료. 결과는 [`task-8-stage0-field-summary.md`](./task-8-stage0-field-summary.md)에 요약. Stage 1 진행 가능.
- 2026-05-20 22:34 KST — Stage 1 schema contract 작성 완료. 코드: `scripts/pipeline/lib/compliance-types.ts`, 문서: [`task-8-schema-contract.md`](./task-8-schema-contract.md).

- 2026-05-21 10:33 KST — Stage 2-5 local 완료. full figma test loop(`diff classify report-only designer-review snapshot api token-css apply-token apply-code apply-report verify-report visual-diff promote-gate marker-candidates`) exit 0, `npm run lint` exit 0, `npm run build` exit 0. Stage 6 실 Figma trigger 검증 대기.

- 2026-05-21 10:43 KST — Stage 6 real Figma trigger validation 완료. 최종 cs `cs-2026-05-21T01-42-28`, report-only 2건, compliance sections 확인, apply noop, verify passed. Figma probe cleanup 완료.
