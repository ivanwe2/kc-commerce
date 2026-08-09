'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'

/**
 * Cloudflare Turnstile widget, implicit rendering.
 *
 * Implicit rather than explicit — the widget is a `cf-turnstile` div and the
 * script finds and mounts it itself. The explicit `turnstile.render()` path was
 * tried first and is a poor fit here: it needs the API initialised before it is
 * called, and its `ready()` guard is unsupported when api.js carries `async`,
 * which next/script always adds. The failure is silent — script present,
 * window.turnstile defined, no widget — which is a thoroughly unpleasant thing
 * to debug.
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, and the server
 * treats an absent configuration the same way, so the two halves cannot
 * disagree about whether protection is on.
 */

declare global {
  interface Window {
    turnstile?: { reset: (container?: string | HTMLElement) => void }
  }
}

export function Turnstile({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void
  /** Increment to request a fresh token; a Turnstile token is single-use. */
  resetSignal?: number
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  // Reset only on an actual retry — resetting on mount would discard the token
  // the widget had just produced.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (containerRef.current && window.turnstile) {
      try {
        window.turnstile.reset(containerRef.current)
      } catch {
        // Nothing to reset yet.
      }
    }
  }, [resetSignal])

  /**
   * The callbacks are global functions because the widget is configured through
   * data attributes, which can only name a function on `window`.
   */
  useEffect(() => {
    const scope = window as unknown as Record<string, unknown>
    scope.__kcTurnstileCallback = (token: string) => onToken(token)
    scope.__kcTurnstileExpired = () => onToken(null)
    scope.__kcTurnstileError = () => onToken(null)

    return () => {
      delete scope.__kcTurnstileCallback
      delete scope.__kcTurnstileExpired
      delete scope.__kcTurnstileError
    }
  }, [onToken])

  if (!siteKey) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div
        ref={containerRef}
        className="cf-turnstile mt-4"
        data-sitekey={siteKey}
        data-callback="__kcTurnstileCallback"
        data-expired-callback="__kcTurnstileExpired"
        data-error-callback="__kcTurnstileError"
        data-theme="light"
      />
    </>
  )
}
