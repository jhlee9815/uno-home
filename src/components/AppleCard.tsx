import { type ReactNode } from 'react'

/**
 * AppleCard — Apple-inspired product tile.
 *
 * Apple-inspired only. Not official Apple Design System.
 * Not affiliated with Apple Inc.
 *
 * Uses --apple-* tokens exclusively. Does NOT modify UNO DS tokens or screens.
 * Source-of-truth: design-systems/apple/apple-tokens.css.
 */

type AppleCardSurface = 'light' | 'dark'

interface AppleCardProps {
  surface?: AppleCardSurface
  eyebrow?: string
  title: ReactNode
  body?: ReactNode
  cta?: ReactNode
}

export function AppleCard({
  surface = 'light',
  eyebrow,
  title,
  body,
  cta,
}: AppleCardProps) {
  const isDark = surface === 'dark'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '32px 24px',
        borderRadius: 'var(--apple-radius-standard)',
        background: isDark
          ? 'var(--apple-color-dark-surface-1)'
          : 'var(--apple-color-light-gray)',
        color: isDark
          ? 'var(--apple-color-white)'
          : 'var(--apple-color-near-black)',
        fontFamily: 'var(--apple-font-text)',
        maxWidth: '320px',
      }}
    >
      {eyebrow && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: isDark
              ? 'var(--apple-color-white-48)'
              : 'var(--apple-color-black-48)',
          }}
        >
          {eyebrow}
        </span>
      )}

      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--apple-font-display)',
          fontSize: '28px',
          fontWeight: 400,
          lineHeight: 1.14,
          letterSpacing: '0.196px',
        }}
      >
        {title}
      </h3>

      {body && (
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: 1.43,
            letterSpacing: '-0.224px',
            color: isDark
              ? 'var(--apple-color-white-80)'
              : 'var(--apple-color-black-80)',
          }}
        >
          {body}
        </p>
      )}

      {cta && <div style={{ marginTop: '8px' }}>{cta}</div>}
    </div>
  )
}
