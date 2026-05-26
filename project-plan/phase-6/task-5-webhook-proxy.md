# Task 6-5 — Cloudflare Worker: Figma Webhook → GitHub Dispatch

> 🔵 **상태 (2026-05-26)**: 이 repo 운영자(jhlee9815)는 이 옵션을 사용하지 않기로 결정. 기본 2시간 cron으로 충분히 운영. 이 문서는 adopter(다른 팀 fork)가 즉시 트리거가 필요할 때 그대로 따라 셋업할 수 있도록 보존됨.
>
> **목표**: Figma `FILE_UPDATE` webhook을 받아 GitHub repository_dispatch 호출
> **예상 시간**: 1~2시간 (옵션 `/slack` 엔드포인트 추가 시 +30분)
> **선행**: task-2 (workflow가 `repository_dispatch: [figma-file-update]` 받음)
> **블록 해제**: branch protection rule 적용 (외부 webhook 들어오기 시작하는 시점)
> **관련**: [`slack-integration.md`](./slack-integration.md) — 경로 B(`/slack` 엔드포인트)를 본 task에 합칠지 분리할지 결정.

## 설계 의도

```
Figma 편집 → Figma webhook POST → Cloudflare Worker → GitHub /repos/.../dispatches
                                       ↑
                                       └─ signature 검증 + rate limit
```

Cloudflare Worker 선택 이유:
- 무료 (10만 req/일)
- cold start ~5ms
- TypeScript 네이티브
- Vercel Edge / AWS Lambda도 동일 패턴 가능

## 사전 준비

```bash
npm install -g wrangler
wrangler login
wrangler init figma-webhook-proxy --type=javascript
cd figma-webhook-proxy
```

## 파일: `src/index.ts`

```typescript
export interface Env {
  GITHUB_TOKEN: string;          // fine-grained PAT (repo:write)
  GITHUB_REPO: string;           // "owner/uno-home"
  FIGMA_WEBHOOK_SECRET: string;  // Figma webhook passcode
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // 1. Method check
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    // 2. Read body for signature verification
    const body = await req.text();
    const payload = JSON.parse(body);

    // 3. Figma signature verification (passcode-based)
    const passcode = req.headers.get('X-Figma-Passcode') ?? payload.passcode;
    if (passcode !== env.FIGMA_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 4. Event filter — only FILE_UPDATE
    if (payload.event_type !== 'FILE_UPDATE') {
      return new Response(`Ignored event: ${payload.event_type}`, { status: 200 });
    }

    // 5. Trigger GitHub workflow via repository_dispatch
    const [owner, repo] = env.GITHUB_REPO.split('/');
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'figma-webhook-proxy',
      },
      body: JSON.stringify({
        event_type: 'figma-file-update',
        client_payload: {
          file_key: payload.file_key,
          file_name: payload.file_name,
          timestamp: payload.timestamp,
          triggered_by: payload.triggered_by ?? null,
        },
      }),
    });

    if (!ghResp.ok) {
      const errText = await ghResp.text();
      console.error('GitHub dispatch failed:', ghResp.status, errText);
      return new Response(`GitHub dispatch failed: ${ghResp.status}`, { status: 502 });
    }

    return new Response('OK', { status: 200 });
  },
};
```

## 파일: `wrangler.toml`

```toml
name = "figma-webhook-proxy"
main = "src/index.ts"
compatibility_date = "2026-05-01"

[vars]
GITHUB_REPO = "<your-owner>/uno-home"

# secrets는 wrangler secret put으로
```

## 배포

```bash
# 1. Secrets 등록 (Cloudflare 측)
wrangler secret put GITHUB_TOKEN       # GitHub fine-grained PAT, repo:write
wrangler secret put FIGMA_WEBHOOK_SECRET   # 본인이 정한 랜덤 문자열 (32+ chars)

# 2. 배포
wrangler deploy

# 출력에 endpoint URL 확인. 예:
# https://figma-webhook-proxy.<your-subdomain>.workers.dev
```

## Figma webhook 등록

```bash
# Figma API로 webhook 등록 (file_id별 1개)
# https://www.figma.com/developers/api#webhooks-v2

set -a && source .env && set +a
FILE_KEY=9cevQvPHlQ5vZv5Pz3QaLL
TEAM_ID=<your-team-id>  # Figma 팀 ID
WORKER_URL=https://figma-webhook-proxy.<your-subdomain>.workers.dev
PASSCODE=<위 wrangler secret put에서 쓴 동일 값>

curl -X POST "https://api.figma.com/v2/webhooks" \
  -H "X-Figma-Token: $FIGMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event_type\": \"FILE_UPDATE\",
    \"team_id\": \"$TEAM_ID\",
    \"endpoint\": \"$WORKER_URL\",
    \"passcode\": \"$PASSCODE\",
    \"description\": \"uno-home pipeline trigger\"
  }"

# 등록된 webhook 확인
curl "https://api.figma.com/v2/teams/$TEAM_ID/webhooks" -H "X-Figma-Token: $FIGMA_TOKEN"
```

## 검증

```bash
# 1. Worker 단독 테스트
curl -X POST $WORKER_URL \
  -H "Content-Type: application/json" \
  -d "{\"event_type\":\"FILE_UPDATE\",\"passcode\":\"$PASSCODE\",\"file_key\":\"$FILE_KEY\",\"file_name\":\"test\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
# 응답 200 OK 기대

# 2. GitHub workflow trigger 확인
gh run list --workflow=figma-pipeline.yml --limit 3
# 가장 최근에 trigger=repository_dispatch 보여야 함

# 3. End-to-end: Figma에서 텍스트 1자 수정
# 5분 내 figma-pipeline workflow가 자동 실행되어야 함
gh run watch
```

## 함정

- **Figma webhook passcode**: signature보다 약함. Cloudflare Worker는 무료 티어라 추가 검증층 권장 (`Cf-Connecting-Ip` 화이트리스트, rate limit).
- **GitHub PAT 권한 최소화**: fine-grained PAT으로 이 repo의 `actions:write`만. classic PAT 쓰지 말 것.
- **재시도**: Figma는 webhook 실패 시 자동 재시도하지 않음 (최선 노력). cron 안전망 필수.
- **이벤트 중복**: 같은 파일 짧은 시간 여러 번 편집 시 webhook 여러 번. workflow의 `concurrency` 그룹이 이걸 큐잉.
- **Figma webhook v2 endpoint**: v1 deprecated. URL `/v2/webhooks`인지 확인.
- **CORS**: webhook은 server-to-server라 CORS 무관. 걱정 없음.

## 후속

webhook 동작 확인 후, task-2 워크플로의 cron 빈도를 `0 */2 * * *` → `0 */6 * * *`로 줄여도 됨 (webhook이 주, cron이 안전망).

## 비용

- Cloudflare Workers 무료: 10만 req/일 (Figma 변경량 대비 충분)
- 유료 전환 ($5/월): 1000만 req/일 (절대 안 닿을 양)
