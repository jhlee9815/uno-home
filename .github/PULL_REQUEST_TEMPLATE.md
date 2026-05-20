<!--
NOTE: 이 템플릿은 사람이 손으로 PR을 열 때 사용됩니다.
designer-bot이 만든 자동 PR은 `scripts/pipeline/post-run-actions.ts`가 GitHub API로 body를 직접 채우므로 이 템플릿이 적용되지 않습니다. (post-run-actions는 cs-{id}.md 리포트 본문을 body로 그대로 사용)
designer-bot PR 리뷰 시 아래 reviewer checklist만 참고하세요.
-->

## What changed
<!-- 한 줄 요약. -->

## Why
<!-- 변경 의도 / 관련 이슈 / 마커 부착 여부 등. -->

## Verification
- [ ] `npm run build` 통과
- [ ] `npm run lint` 통과
- [ ] visual diff 검토 (수동, 필요 시)

## Reviewer checklist (dev) — designer-bot PR에도 동일 적용
- [ ] 변경된 노드 ID와 코드 위치 일치 확인
- [ ] 마커가 의도된 영역인지 확인 (`figma:text` / `figma:prop` 화이트리스트)
- [ ] 자동 변경이 디자인 시스템 토큰만 건드렸는지 확인
- [ ] Draft → **Ready for review** 전환 후 머지
