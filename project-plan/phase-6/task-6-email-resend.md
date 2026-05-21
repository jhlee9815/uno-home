# Task 6-6 — Resend Email 통합 ⏭ SKIPPED (2026-05-21)

> **상태**: 영구 스킵. Slack 알림 두 채널 (`notifySlack()` webhook + GitHub 공식 Slack 앱)이 이미 디자이너/PM에 도달하고 있어 이메일 백업 채널 불필요.
> **부활 조건**: Slack 도달이 끊기거나 이메일 수신이 명시적 요구사항이 될 때. 아래 설계 그대로 복원 가능.

---

> **목표**: cs 리포트 요약을 디자이너/PM에 메일 발송
> **예상 시간**: 1시간
> **선행**: task-3 (`post-run-actions.ts`에서 호출 지점)
> **블록 해제**: 없음

## 설계 의도

Slack/Discord는 채널에 떨어지지만, 디자이너/PM이 항상 보고 있지 않을 수 있음.
주요 변경(auto-apply ≥1건 OR report-only ≥3건)일 때만 메일 발송 (스팸 방지).

## 의존성

```bash
npm install resend
```

## 환경변수

```bash
# .env (로컬)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=design-bot@yourdomain.com    # 검증된 도메인 필요
RESEND_TO_EMAILS=designer@team.com,pm@team.com

# GitHub Secrets/Vars (CI)
gh secret set RESEND_API_KEY --body "re_..."
gh variable set RESEND_FROM_EMAIL --body "design-bot@yourdomain.com"
gh variable set RESEND_TO_EMAILS --body "designer@team.com,pm@team.com"
```

Resend 도메인 검증 절차:
1. resend.com에서 도메인 추가
2. DNS에 TXT/MX 레코드 등록
3. 검증 완료 후 발송 가능

(검증 안 된 도메인은 무료 티어 `onboarding@resend.dev` from 주소로 발송 가능 — 테스트용)

## 파일 변경 — `post-run-actions.ts`의 `sendEmail` 구현

```typescript
import { Resend } from 'resend';

async function sendEmail(args: {
  csId: string;
  autoApply: number;
  reportOnly: number;
  prUrl?: string;
  issueUrl?: string;
  csReport: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.RESEND_TO_EMAILS?.split(',').map(s => s.trim()) ?? [];
  if (!apiKey || !from || to.length === 0) {
    console.log('Email: skipped (env missing)');
    return;
  }

  // 스팸 방지 — 의미 있는 변경일 때만
  const significant = args.autoApply >= 1 || args.reportOnly >= 3;
  if (!significant) {
    console.log('Email: skipped (not significant)');
    return;
  }

  const resend = new Resend(apiKey);
  const subject = `🎨 Figma 변경 — ${args.csId} (auto:${args.autoApply}, report:${args.reportOnly})`;

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1d1d1f;">Figma 변경 감지</h2>
      <p style="color:#6e6e73;">${args.csId} · ${new Date().toLocaleString('ko-KR')}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr style="background:#f5f5f7;">
          <td style="padding:12px;border:1px solid #d2d2d7;"><b>자동 반영</b></td>
          <td style="padding:12px;border:1px solid #d2d2d7;">${args.autoApply}건</td>
        </tr>
        <tr>
          <td style="padding:12px;border:1px solid #d2d2d7;"><b>수동 검토 필요</b></td>
          <td style="padding:12px;border:1px solid #d2d2d7;">${args.reportOnly}건</td>
        </tr>
      </table>
      ${args.prUrl ? `<p>📝 자동 PR: <a href="${args.prUrl}">${args.prUrl}</a></p>` : ''}
      ${args.issueUrl ? `<p>📋 검토 Issue: <a href="${args.issueUrl}">${args.issueUrl}</a></p>` : ''}
      <hr style="border:none;border-top:1px solid #d2d2d7;margin:24px 0;">
      <details>
        <summary style="cursor:pointer;color:#007aff;">전체 리포트 보기</summary>
        <pre style="background:#f5f5f7;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;">${escapeHtml(args.csReport)}</pre>
      </details>
      <p style="color:#6e6e73;font-size:12px;margin-top:24px;">
        🤖 figma-pipeline · uno-home repo · 이 메일은 자동 발송됩니다.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
  } else {
    console.log(`Email sent to ${to.join(', ')}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
}
```

## 검증

```bash
# 로컬 테스트 (검증된 도메인 또는 onboarding@resend.dev 사용)
RESEND_API_KEY=re_xxx \
RESEND_FROM_EMAIL=onboarding@resend.dev \
RESEND_TO_EMAILS=your@email.com \
npx tsx scripts/pipeline/post-run-actions.ts cs-2026-05-20T05-48-54

# 인박스에서 메일 수신 확인
```

성공 기준:
- significant 조건 통과 시 메일 발송
- 미통과 시 skip 로그
- HTML 렌더링 정상
- PR/Issue URL 링크 동작

## 함정

- **Resend 무료 티어**: 월 3,000건. 충분.
- **검증 안 된 도메인**: `from: onboarding@resend.dev`만 가능. 실 운영 전 도메인 검증 필수.
- **수신자 동의**: 회사 정책에 따라 디자이너/PM에 사전 동의 필요할 수 있음.
- **이메일 spam 방지**: `significant` 임계값 조정 가능. 너무 자주 오면 디자이너가 무시함.
- **HTML escape**: cs-*.md 내용에 `<>&` 있으면 깨짐. `escapeHtml` 적용 필수.

## 대안

- SendGrid: Free tier 100건/일, 더 엄격
- Postmark: 100건/월 free, 트랜잭션 메일 강점
- AWS SES: 60,000건/월 free, 셋업 복잡
- 회사 SMTP: 가장 안전하지만 SMTP 라이브러리 필요 (`nodemailer`)
