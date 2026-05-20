---
name: Designer review request
about: report-only 항목 (자동 적용 안 됨) — 사람이 손으로 열 때 사용
title: "[designer-review] cs-<id> — <n> item(s) need review"
labels: ["designer-review", "report-only"]
---

<!--
NOTE: 이 템플릿은 사람이 직접 Issue를 열 때만 사용됩니다.
post-run-actions.ts가 자동 만드는 Issue는 GitHub API로 cs-{id}.md 리포트 본문을 body로 직접 사용하므로 이 템플릿이 적용되지 않습니다.
자동 생성 Issue를 받은 디자이너/개발자는 코멘트로 아래 항목을 채워주세요.
-->

## Detected change
<!-- 변경 노드 / 사유 요약. -->

## Why not auto-applied
<!-- 가능한 사유:
- 마커 없음 (`figma:text` / `figma:prop` 화이트리스트 미부착)
- allowedClasses 차단 (text/prop OK, layout/structure 차단)
- 화면 정책 (등록 frame 밖)
-->

## Manual action needed
<!-- 보통 다음 중 하나:
- 디자이너: 의도 확인 + 마커 부착 요청
- 개발자: 코드 수동 반영 + 동일 노드에 마커 부착으로 다음부터 auto-apply 가능
-->

## Designer notes
<!-- 디자이너 의도 메모. -->

