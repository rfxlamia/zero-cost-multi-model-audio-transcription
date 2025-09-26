'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, type JSX } from 'react'

type Props = {
  siteKey: string
  onToken: (token: string | null) => void
  theme?: 'auto' | 'light' | 'dark'
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
  }
}

export default function TurnstileWidget({ siteKey, onToken, theme = 'auto' }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    const el = containerRef.current
    if (!el || !window.turnstile) return
    // Cleanup previous instance if any
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current)
      } catch {
        /* noop */
      }
      widgetIdRef.current = null
    }
    const id = window.turnstile.render(el, {
      sitekey: siteKey,
      theme,
      callback: (t: unknown) => {
        onToken(typeof t === 'string' ? t : null)
      },
      'expired-callback': () => {
        onToken(null)
      },
      'error-callback': () => {
        onToken(null)
      },
    }) as unknown as string
    widgetIdRef.current = id
  }, [onToken, siteKey, theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.turnstile) renderWidget()
  }, [renderWidget])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => {
          if (typeof window !== 'undefined' && window.turnstile) renderWidget()
        }}
      />
      <div ref={containerRef} className="mt-3" />
    </>
  )
}
