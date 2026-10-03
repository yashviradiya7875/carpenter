import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../utils/cx'
import './GeneratingLoader.css'

export type GeneratingLoaderProgress = {
  /** Units finished so far, e.g. renders completed. */
  value: number
  max: number
  /** Accessible name for the bar, e.g. "2 of 5 renders complete". */
  label?: string
}

export type GeneratingLoaderProps = {
  /** The animated word inside the orb. */
  label?: string
  /** One status line under the orb. Takes precedence over `messages`. */
  message?: ReactNode
  /**
   * Status lines shown in order as time passes; the last one stays. They describe what is
   * happening, not measured progress, so keep them free of "almost done" claims.
   */
  messages?: string[]
  /** Milliseconds each of `messages` is shown before the next. */
  messageInterval?: number
  /** Measured progress only. Omit when the operation reports none; the orb is the indeterminate state. */
  progress?: GeneratingLoaderProgress
  /** Quiet line under the status, e.g. how long this usually takes. */
  hint?: ReactNode
  /** Shows the real time elapsed since the loader appeared. */
  showElapsed?: boolean
  size?: 'md' | 'lg'
  className?: string
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Loading state for long AI operations (renders, generations): a softly lit rotating orb
 * around an animated word, with an optional status line, measured progress and elapsed time.
 * Fills no space of its own; center it in the region it stands in for.
 */
export function GeneratingLoader({
  label = 'Generating',
  message,
  messages,
  messageInterval = 9000,
  progress,
  hint,
  showElapsed = false,
  size = 'lg',
  className,
}: GeneratingLoaderProps) {
  const [elapsed, setElapsed] = useState(0)
  const needsClock = showElapsed || (message === undefined && (messages?.length ?? 0) > 1)

  useEffect(() => {
    if (!needsClock) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [needsClock])

  const timedMessage = messages?.length
    ? messages[Math.min(messages.length - 1, Math.floor((elapsed * 1000) / messageInterval))]
    : undefined
  const currentMessage = message ?? timedMessage
  const progressRatio = progress && progress.max > 0 ? Math.min(1, Math.max(0, progress.value / progress.max)) : 0

  return (
    <div className={cx('app-generating', `app-generating--${size}`, className)}>
      <div className="app-generating-orb" aria-hidden="true">
        <span className="app-generating-halo" />
        <span className="app-generating-ring" />
        <span className="app-generating-ring app-generating-ring--trail" />
        <span className="app-generating-word">
          {Array.from(label).map((letter, index) => (
            <span key={index} className="app-generating-letter" style={{ '--i': index } as CSSProperties}>{letter}</span>
          ))}
        </span>
      </div>

      <div className="app-generating-status" role="status">
        <span className="sr-only">{label}…</span>
        {currentMessage ? (
          <p key={typeof currentMessage === 'string' ? currentMessage : 'message'} className="app-generating-message app-enter">
            {currentMessage}
          </p>
        ) : null}
      </div>

      {progress ? (
        <div
          className="app-generating-progress"
          role="progressbar"
          aria-label={progress.label ?? 'Progress'}
          aria-valuemin={0}
          aria-valuemax={progress.max}
          aria-valuenow={progress.value}
        >
          <span className="app-generating-progress-fill" style={{ '--progress': progressRatio } as CSSProperties} />
        </div>
      ) : null}

      {/* Outside the live region, so the ticking clock isn't announced every second. */}
      {hint || showElapsed ? (
        <p className="app-generating-meta">
          {hint}
          {hint && showElapsed ? ' · ' : null}
          {showElapsed ? <span className="app-generating-elapsed">{formatElapsed(elapsed)} elapsed</span> : null}
        </p>
      ) : null}
    </div>
  )
}
