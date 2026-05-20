# Task 6-9 — Report UX + Labels (post-task-8)

> **목표**: task-8이 만든 구조화된 detection JSON을 디자이너 + 개발자 둘 다 친화적으로 표시. cs-{id}.md 시각 보강 + 코드 path 매핑 + 자동 라벨 추가 + (선택) Slack 메시지 풍부화.
> **예상 시간**: 2-3시간
> **선행**: task-8 (classify JSON schema 안정화 필요)
> **상태**: 🛠 설계 대기 — task-8 v1 완료 후 재설계.

## 9-1. 범위

| 산출물 | 내용 |
|---|---|
| cs-{id}.md report 보강 | 디자이너/개발자 두 시점 동시 표시. 디자이너: figma 직접 URL + 변경 의도 칸. 개발자: nodeId + code path mapping (mapping.yaml의 `code` 필드 활용). |
| 자동 라벨 | `detached-style`, `new-frame`, `image-change` 라벨 추가 (Issue 생성 시 subcategory 기반). |
| labels.yml 갱신 | 색상/설명 표준화 (task-4와 동일 패턴). |
| post-run-actions 코드 | classified JSON의 subcategory 보고 라벨 자동 부착. body 포맷은 cs report 그대로. |
| (선택) Slack 메시지 풍부화 | `notifySlack()`에서 subcategory 별 요약 한 줄 ("detached 3 / new-frame 1 / image 0") |

## 9-2. 위험 / 미정

- task-8 v1 schema가 task-9 진행 중 갱신되면 report 다시 수정 필요 → task-8 schema 안정화(`5-fixture PASS`) 후 진입.
- 라벨 4종 추가 → repo 라벨 인플레이션. labels.yml에 spec 명시 + branch protection rule (task-5 이후) 적용 시점에 동기화.
- 디자이너 한국어 vs 개발자 영어 — cs report는 디자이너 친화 한국어 + 코드 path는 영어 path. 혼재 OK.

## 9-3. 다음

task-8 v1 완료 후 schema 보면서 Stage 분해 확정.
