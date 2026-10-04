import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../utils/cx'
import './Skeleton.css'

export type SkeletonVariant = 'text' | 'block' | 'circle'

export type SkeletonProps = {
  /** `text` is one line of copy, `block` a card, image or control, `circle` an avatar or icon. */
  variant?: SkeletonVariant
  /** Any CSS length; numbers are pixels. Leave out to let a class or the layout decide. */
  width?: number | string
  height?: number | string
  className?: string
  style?: CSSProperties
}

/**
 * A placeholder shape for content that is still loading. Give it the size of what it stands
 * in for, ideally by reusing that component's own layout classes, so nothing moves when the
 * content arrives. Decorative on its own: wrap a set of them in `SkeletonGroup`.
 */
export function Skeleton({ variant = 'block', width, height, className, style }: SkeletonProps) {
  return <span className={cx('app-skeleton', `app-skeleton--${variant}`, className)} style={{ width, height, ...style }} aria-hidden="true" />
}

// Line lengths that read as a paragraph rather than a block.
const LINE_WIDTHS = ['92%', '76%', '84%', '58%']

export type SkeletonTextProps = {
  lines?: number
  className?: string
}

/** A few lines of placeholder text. Needs a parent with a width of its own. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cx('app-skeleton-text', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} variant="text" width={LINE_WIDTHS[index % LINE_WIDTHS.length]} />
      ))}
    </span>
  )
}

export type SkeletonGroupProps = {
  /** Announced once to assistive technology, e.g. "Loading files…". */
  label: string
  /** Lays the children out as a column with the standard gap. */
  stack?: boolean
  /** The layout class of the content being loaded (a list, a grid), so the placeholders sit where it will. */
  className?: string
  children: ReactNode
}

/**
 * A region that is loading: announces `label`, and fades in after a short delay so fast
 * responses never flash placeholders. Its children are `Skeleton` shapes.
 */
export function SkeletonGroup({ label, stack = false, className, children }: SkeletonGroupProps) {
  return (
    <div className={cx('app-skeleton-group', stack && 'app-skeleton-group--stack', className)} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
