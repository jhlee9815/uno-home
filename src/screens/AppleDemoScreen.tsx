import { Button } from '../components/Button'
import { AppleCard } from '../components/AppleCard'

/**
 * AppleDemoScreen — Phase 4 산출물.
 *
 * Apple-inspired Design System Adapter 데모 화면.
 * UNO HOME 메인 앱과 격리된 외부 데모 라우트로, UNO DS 토큰을 전혀 건드리지 않는다.
 *
 * Apple-inspired only. Not official Apple Design System.
 * Not affiliated with Apple Inc.
 * Source: Markdown reference at awesome-design-md/design-md/apple/DESIGN.md
 */
export function AppleDemoScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        padding: '32px',
        background: 'var(--apple-color-white)',
        color: 'var(--apple-color-near-black)',
        fontFamily: 'var(--apple-font-text)',
        minHeight: '600px',
      }}
    >
      {/* Disclaimer pill (always visible) */}
      <span
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          padding: '7px 14px',
          borderRadius: 'var(--apple-radius-pill)',
          background: 'var(--apple-color-overlay-light)',
          color: 'var(--apple-color-black-48)',
          fontSize: '12px',
        }}
      >
        Apple-inspired only · Not affiliated with Apple Inc.
      </span>

      {/* Section 1: Button variants */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--apple-font-display)',
            fontSize: '40px',
            fontWeight: 600,
            letterSpacing: '-0.28px',
            lineHeight: 1.1,
          }}
        >
          Buttons
        </h2>
        <p style={{ margin: 0, color: 'var(--apple-color-black-80)' }}>
          Apple-inspired primary blue & pill link, sitting alongside the original UNO variants.
        </p>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <Button variant="apple-primary" size="md" label="Buy" />
          <Button variant="apple-pill-link" size="md" label="Learn more" />
        </div>
      </section>

      {/* Section 2: AppleCard */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--apple-font-display)',
            fontSize: '40px',
            fontWeight: 600,
            letterSpacing: '-0.28px',
            lineHeight: 1.1,
          }}
        >
          Product tiles
        </h2>
        <p style={{ margin: 0, color: 'var(--apple-color-black-80)' }}>
          Light gray surface, rare shadow, centered content. Dark variant uses surface-1.
        </p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <AppleCard
            surface="light"
            eyebrow="Phase 4 · light"
            title="Cinematic neutrals"
            body="Single accent. Premium spacing. Headlines that compress."
            cta={<Button variant="apple-pill-link" size="sm" label="Browse" />}
          />
          <AppleCard
            surface="dark"
            eyebrow="Phase 4 · dark"
            title="Focused moments"
            body="Black scenes for product showcase. Bright blue interactive accents."
            cta={<Button variant="apple-primary" size="sm" label="Continue" />}
          />
        </div>
      </section>

      <footer style={{ marginTop: 'auto', color: 'var(--apple-color-black-48)', fontSize: '12px' }}>
        Apple-inspired only. Not official Apple Design System. Not affiliated with Apple Inc.
        Source: Markdown reference at awesome-design-md/design-md/apple/DESIGN.md.
      </footer>
    </div>
  )
}
