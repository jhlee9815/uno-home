// Shared outbound webhook helper. Extracted from post-run-actions.ts so the
// audit notifier can reuse the same masking / error-handling shape and the
// two surfaces don't drift apart over time.

export interface PostWebhookOptions {
  url: string;
  payload: object;
  label: string;
  dryRun?: boolean;
}

export async function postWebhook({ url, payload, label, dryRun = false }: PostWebhookOptions): Promise<void> {
  if (dryRun) {
    console.log(`[dry-run ${label}] POST ${url.replace(/[A-Za-z0-9_-]{20,}/g, '<redacted>')}`);
    return;
  }
  // Guard a malformed secret (whitespace, missing scheme, paste of an OAuth
  // token instead of an Incoming Webhook URL) from killing the caller. Webhook
  // failures must not roll back the surrounding pipeline step.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn(`[${label}] skipped — webhook URL is not a valid URL. Fix the secret.`);
    return;
  }
  try {
    const res = await fetch(parsed, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[${label}] webhook returned ${res.status} ${res.statusText}`);
    } else {
      console.log(`[${label}] notified`);
    }
  } catch (err) {
    console.warn(`[${label}] webhook fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
