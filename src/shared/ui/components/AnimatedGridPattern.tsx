import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { cx } from '../utils/cx'
import { usePrefersReducedMotion } from '../utils/usePrefersReducedMotion'
import './AnimatedGridPattern.css'

type Size = { width: number; height: number }
type Square = { id: number; col: number; row: number }

export type AnimatedGridPatternProps = {
  /** Cell size in px. */
  width?: number
  height?: number
  /** Grid offset in px. */
  x?: number
  y?: number
  strokeDasharray?: number | string
  /** How many cells glow at a time. */
  numSquares?: number
  /** Peak opacity of a glowing cell. Defaults to the theme token `--effect-grid-opacity`. */
  maxOpacity?: number
  /** Seconds for one fade in (and again for the fade out). */
  duration?: number
  /** Fade the pattern out toward the edges. Override the shape with `--grid-mask`. */
  fade?: boolean
  className?: string
}

function randomCell(size: Size, cellWidth: number, cellHeight: number) {
  return {
    col: Math.floor((Math.random() * size.width) / cellWidth),
    row: Math.floor((Math.random() * size.height) / cellHeight),
  }
}

/**
 * Decorative background: a fine grid where random cells softly fade in and out.
 * Pure SVG + CSS animation (no animation library). Fills its positioned parent,
 * ignores the pointer and is hidden from assistive technology. With reduced motion
 * the cells hold still at a lower opacity.
 *
 * Adapted from Magic UI's AnimatedGridPattern (dillionverma), without framer-motion.
 */
export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  maxOpacity,
  duration = 4,
  fade = true,
  className,
}: AnimatedGridPatternProps) {
  const patternId = `app-grid-${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [squares, setSquares] = useState<Square[]>([])
  const reducedMotion = usePrefersReducedMotion()

  // Measure the container and scatter the cells; re-scatter when it resizes.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height }
      setSize(next)
      setSquares(next.width && next.height
        ? Array.from({ length: numSquares }, (_, id) => ({ id, ...randomCell(next, width, height) }))
        : [])
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [numSquares, width, height])

  // After a cell fades out, it reappears somewhere else.
  const moveSquare = (id: number) => {
    setSquares((current) => current.map((square) => (
      square.id === id ? { id, ...randomCell(size, width, height) } : square
    )))
  }

  const style = maxOpacity === undefined ? undefined : ({ '--grid-max-opacity': maxOpacity } as CSSProperties)

  return (
    <svg
      ref={svgRef}
      className={cx('app-grid-pattern', fade && 'app-grid-pattern--fade', className)}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={patternId} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      <svg x={x} y={y} overflow="visible">
        {squares.map(({ id, col, row }, index) => (
          <rect
            // A new key restarts the fade at the new position.
            key={`${col}-${row}-${index}`}
            className="app-grid-square"
            width={width - 1}
            height={height - 1}
            x={col * width + 1}
            y={row * height + 1}
            style={{ '--grid-delay': `${index * 0.1}s`, '--grid-duration': `${duration}s` } as CSSProperties}
            onAnimationEnd={reducedMotion ? undefined : () => moveSquare(id)}
          />
        ))}
      </svg>
    </svg>
  )
}
