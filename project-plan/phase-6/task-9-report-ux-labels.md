# Task 6-9 — Report UX + Labels (post-task-8)

> **목표**: task-8이 만든 구조화된 detection JSON을 디자이너 + 개발자 둘 다 친화적으로 표시. cs-{id}.md 시각 보강 + 코드 path 매핑 + 자동 라벨 추가 + (선택) Slack 메시지 풍부화.
> **예상 시간**: 2-3시간
> **선행**: task-8 (classify JSON schema 안정화 필요)
> **상태**: ↘ 범위 축소/흡수 권장 — task-8 v1은 완료·merged. report 섹션은 이미 들어갔고, 큰 UX 흐름은 task-10 Phase A가 담당. 본 task는 label/Slack summary 보강이 필요할 때만 독립 실행.

## 9-1. 현재 범위 판단

Task 8 merge 이후 `cs-{id}.md`에는 이미 compliance 섹션(`Detached Styles`, `New Frames in Tracked Screens`, `Image Changes`)이 들어간다. Task 10 Phase A는 viewer URL, designer-approved/rejected labels, immutable cs manifest까지 포함하므로 원래 Task 9의 큰 UX 범위를 대부분 대체한다.

| 산출물 | 현재 판단 |
|---|---|
| cs-{id}.md report 보강 | ✅ Task 8에서 1차 완료. before/after 시각화는 Task 10 Stage 2로 이동. |
| 자동 라벨 | 선택. `detached-style`, `new-frame`, `image-change` 라벨이 Issue triage에 실제 필요하면 Task 10과 함께 추가. |
| labels.yml 갱신 | 선택. label 추가 시 task-4 패턴으로 반영. |
| post-run-actions 코드 | 선택. classified JSON의 subcategory 기반 label/Slack summary가 필요할 때만 수정. |
| Slack 메시지 풍부화 | Task 10 Stage 2/3/4/5 inline hook에 흡수 권장. |

## 9-2. 위험 / 미정

- task-10과 병행하지 않고 별도 task-9로 진행하면 label/Slack summary가 Task 10 manifest/viewer 설계와 중복될 수 있음 → 기본은 Task 10에 흡수.
- 라벨 4종 추가 → repo 라벨 인플레이션. labels.yml에 spec 명시 + branch protection rule (task-5 이후) 적용 시점에 동기화.
- 디자이너 한국어 vs 개발자 영어 — cs report는 디자이너 친화 한국어 + 코드 path는 영어 path. 혼재 OK.

## 9-3. 다음

기본은 Task 10 Phase A로 진행한다. 별도 Task 9를 열어야 하는 경우는 “GitHub label/Slack summary만 빠르게 추가하고 viewer/manifest는 아직 하지 않는다”는 의사결정이 있을 때다.
