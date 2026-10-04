import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from 'react'
import { Alert, Button, cx, EmptyState, Icon, LoadingState } from '../ui'
import { StepPanel } from './StepPanel'
import './MaterialPlacement.css'

/** A box on the room photo, as 0–1 fractions of its width and height. */
export type PlacementBox = { x: number; y: number; w: number; h: number }

/** A marked part of the room and which of the two materials (0 or 1) goes there. */
export type PlacementArea = PlacementBox & { id: number; material: 0 | 1 }

export type PlacementMaterial = { name: string; imageUrl?: string }

export type MaterialPlacementProps = {
  /** The room photo to mark; shown whole, so a point on screen is a point on the photo. */
  roomImageUrl: string
  /** The two materials being placed, in upload order. */
  materials: [PlacementMaterial, PlacementMaterial]
  onBack: () => void
  backLabel?: ReactNode
  /** Confirm button content, e.g. "Generate · 2 credits". */
  confirmLabel?: ReactNode
  onConfirm: (areas: PlacementArea[]) => void
  /** Why confirming isn't possible right now (e.g. not enough credits); shown in place of the summary. */
  blockedReason?: string
  /** Offered when the room photo can't be shown, to continue without marking areas. */
  onSkip?: () => void
  skipLabel?: ReactNode
  title?: ReactNode
  description?: ReactNode
  /** Hides the step without unmounting it, so the marked areas survive moving between steps. */
  hidden?: boolean
  /** The step's root; focus it when the step is shown. */
  ref?: Ref<HTMLElement>
  className?: string
}

/** A drag shorter than this on either side is a stray tap, not an area. */
const MIN_SIDE = 0.02
/** How far one arrow key press moves or resizes an area. */
const KEY_STEP = 0.01
/** Boxes may touch; they only conflict once they overlap by more than this. */
const OVERLAP_TOLERANCE = 0.004
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const

type Point = { x: number; y: number }

/** What a press on the photo is doing until it is released. */
type Interaction =
  | { kind: 'draw'; start: Point }
  | { kind: 'move'; id: number; from: Point; box: PlacementBox; before: PlacementArea[] }
  /** `anchor` is the corner opposite the one being dragged; it stays put. */
  | { kind: 'resize'; id: number; anchor: Point; before: PlacementArea[] }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function boxBetween(a: Point, b: Point): PlacementBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

function overlaps(a: PlacementBox, b: PlacementBox): boolean {
  return a.x < b.x + b.w - OVERLAP_TOLERANCE && a.x + a.w > b.x + OVERLAP_TOLERANCE
    && a.y < b.y + b.h - OVERLAP_TOLERANCE && a.y + a.h > b.y + OVERLAP_TOLERANCE
}

function boxStyle(box: PlacementBox): CSSProperties {
  return { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'area' : 'areas'}`
}

/**
 * Placement step for a render that uses two materials: choose a material, then drag over
 * the room photo to mark where it goes. Its areas can then be dragged to move them, resized
 * from their corners, or removed. One material's areas can't overlap the other's.
 * Whatever is left unmarked on the furniture takes the other material, so marking for
 * one of them is enough. Purely presentational: the caller receives the marked areas.
 */
export function MaterialPlacement({
  roomImageUrl,
  materials,
  onBack,
  backLabel,
  confirmLabel = 'Continue',
  onConfirm,
  blockedReason,
  onSkip,
  skipLabel = 'Continue without marking',
  title = 'Place your materials',
  description = 'Choose a material, then drag over the room to mark where it goes.',
  hidden = false,
  ref,
  className,
}: MaterialPlacementProps) {
  const [areas, setAreas] = useState<PlacementArea[]>([])
  // Earlier states of `areas`, newest last, for Undo.
  const [history, setHistory] = useState<PlacementArea[][]>([])
  const [active, setActive] = useState<0 | 1>(0)
  const [draft, setDraft] = useState<PlacementBox | null>(null)
  const [problem, setProblem] = useState('')
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const interaction = useRef<Interaction | null>(null)
  const nextId = useRef(1)
  // The area being adjusted from the keyboard: its key presses share one undo step.
  const adjustingId = useRef<number | null>(null)

  const counts = [areas.filter((area) => area.material === 0).length, areas.filter((area) => area.material === 1).length]
  // The material that also takes everything left unmarked: the one without areas, or Material 1 when both have some.
  const restIndex = counts[1] > 0 ? 0 : counts[0] > 0 ? 1 : null
  const other = active === 0 ? 1 : 0

  const conflictsWith = (box: PlacementBox, material: 0 | 1, ignoreId?: number) => (
    areas.some((area) => area.material !== material && area.id !== ignoreId && overlaps(area, box))
  )
  const overlapMessage = (material: 0 | 1) => (
    `That overlaps an area of Material ${material === 0 ? 2 : 1}. Each part of the room can take only one material.`
  )

  const commit = (next: PlacementArea[]) => {
    setHistory((current) => [...current, areas])
    setAreas(next)
    setProblem('')
    adjustingId.current = null
  }

  const addArea = (box: PlacementBox) => {
    if (conflictsWith(box, active)) {
      setProblem(overlapMessage(active))
      return
    }
    commit([...areas, { ...box, id: nextId.current++, material: active }])
  }

  // For keyboards and anyone who would rather not drag: drop in a box, then adjust it.
  const addDefaultArea = () => {
    const size = 0.3
    const starts = [0.35, 0.05, 0.65]
    for (const y of starts) {
      for (const x of starts) {
        const box = { x, y, w: size, h: size }
        const isTaken = areas.some((area) => area.material === active && Math.abs(area.x - x) < 0.01 && Math.abs(area.y - y) < 0.01)
        if (!isTaken && !conflictsWith(box, active)) {
          addArea(box)
          return
        }
      }
    }
    setProblem('There’s no free space for another area. Remove or resize one first.')
  }

  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setAreas(previous)
    setHistory((current) => current.slice(0, -1))
    setProblem('')
    adjustingId.current = null
  }

  /*
   * Pointer work, for mouse, pen and touch alike. A press on empty photo draws a new area;
   * on an area of the active material it moves it; on one of its corners it resizes it.
   */

  const pointAt = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button')) return // an area's remove button
    // Keeps the drag going when the pointer leaves the photo. Not essential, so never fatal.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // The pointer is already gone; the drag just ends at the photo's edge.
    }
    const point = pointAt(event)
    const areaId = Number(target.closest<HTMLElement>('[data-area-id]')?.dataset.areaId)
    const area = areas.find((item) => item.id === areaId)
    const corner = target.dataset.corner
    if (area && corner) {
      const anchor = { x: corner.includes('w') ? area.x + area.w : area.x, y: corner.includes('n') ? area.y + area.h : area.y }
      interaction.current = { kind: 'resize', id: area.id, anchor, before: areas }
    } else if (area) {
      interaction.current = { kind: 'move', id: area.id, from: point, box: area, before: areas }
    } else {
      interaction.current = { kind: 'draw', start: point }
      setDraft({ ...point, w: 0, h: 0 })
    }
    setProblem('')
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = interaction.current
    if (!current) return
    const point = pointAt(event)
    if (current.kind === 'draw') {
      setDraft(boxBetween(current.start, point))
      return
    }
    let next: PlacementBox
    if (current.kind === 'move') {
      const { box, from } = current
      next = { ...box, x: clamp(box.x + point.x - from.x, 0, 1 - box.w), y: clamp(box.y + point.y - from.y, 0, 1 - box.h) }
    } else {
      // Never smaller than a stray tap, and never past the photo's edge.
      const { anchor } = current
      const w = Math.max(Math.abs(point.x - anchor.x), MIN_SIDE)
      const h = Math.max(Math.abs(point.y - anchor.y), MIN_SIDE)
      const x = point.x < anchor.x ? Math.max(0, anchor.x - w) : anchor.x
      const y = point.y < anchor.y ? Math.max(0, anchor.y - h) : anchor.y
      next = { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) }
    }
    setAreas((items) => items.map((item) => (item.id === current.id ? { ...item, ...next } : item)))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = interaction.current
    interaction.current = null
    if (!current) return
    if (current.kind === 'draw') {
      setDraft(null)
      const box = boxBetween(current.start, pointAt(event))
      if (box.w >= MIN_SIDE && box.h >= MIN_SIDE) addArea(box)
      return
    }
    // A moved or resized area that ends up on the other material's goes back where it was.
    const adjusted = areas.find((item) => item.id === current.id)
    const original = current.before.find((item) => item.id === current.id)
    if (!adjusted || !original) return
    if (conflictsWith(adjusted, adjusted.material, adjusted.id)) {
      setAreas(current.before)
      setProblem(overlapMessage(adjusted.material))
    } else if (adjusted.x !== original.x || adjusted.y !== original.y || adjusted.w !== original.w || adjusted.h !== original.h) {
      setHistory((items) => [...items, current.before])
      adjustingId.current = null
    }
  }

  const cancelInteraction = () => {
    const current = interaction.current
    interaction.current = null
    setDraft(null)
    if (current && current.kind !== 'draw') setAreas(current.before)
  }

  // Arrow keys move an area, Shift + arrows resize it, Delete removes it.
  const handleAreaKeyDown = (event: KeyboardEvent<HTMLDivElement>, area: PlacementArea) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      commit(areas.filter((item) => item.id !== area.id))
      return
    }
    const dx = event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP : 0
    const dy = event.key === 'ArrowDown' ? KEY_STEP : event.key === 'ArrowUp' ? -KEY_STEP : 0
    if (!dx && !dy) return
    event.preventDefault()
    const next: PlacementArea = event.shiftKey
      ? { ...area, w: clamp(area.w + dx, MIN_SIDE, 1 - area.x), h: clamp(area.h + dy, MIN_SIDE, 1 - area.y) }
      : { ...area, x: clamp(area.x + dx, 0, 1 - area.w), y: clamp(area.y + dy, 0, 1 - area.h) }
    if (conflictsWith(next, area.material, area.id)) {
      setProblem(overlapMessage(area.material))
      return
    }
    if (adjustingId.current !== area.id) setHistory((current) => [...current, areas])
    adjustingId.current = area.id
    setAreas(areas.map((item) => (item.id === area.id ? next : item)))
    setProblem('')
  }

  const coverage = (index: 0 | 1) => {
    if (!counts[index]) return restIndex === index ? 'Rest of the furniture' : 'No areas yet'
    return restIndex === index ? `${countLabel(counts[index])} + the rest` : countLabel(counts[index])
  }

  const summary = restIndex === null
    ? 'Mark at least one area to continue'
    : `Material ${restIndex === 0 ? 2 : 1} on ${countLabel(counts[restIndex === 0 ? 1 : 0])} · Material ${restIndex + 1} on the rest`

  return (
    <StepPanel
      ref={ref}
      className={cx('material-placement', className)}
      hidden={hidden}
      title={title}
      description={description}
      onBack={onBack}
      backLabel={backLabel}
      footer={(
        <>
          <span className={cx('step-panel-summary', blockedReason && 'is-blocked')} role="status">{blockedReason ?? summary}</span>
          <Button variant="primary" size="sm" shape="pill" icon="spark" disabled={!areas.length || Boolean(blockedReason)} onClick={() => onConfirm(areas)}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <div className="placement-toolbar">
        <div className="placement-materials" role="group" aria-label="Material to place">
          {materials.map((material, index) => (
            <button
              key={index}
              type="button"
              className={cx('placement-material', `placement-material--${index + 1}`, active === index && 'is-active')}
              aria-pressed={active === index}
              title={material.name}
              onClick={() => setActive(index as 0 | 1)}
            >
              <span className="placement-material-swatch">
                {material.imageUrl ? <img src={material.imageUrl} alt="" /> : <Icon name="image" />}
                <span className="placement-tag" aria-hidden="true">{index + 1}</span>
              </span>
              <span className="placement-material-copy">
                <strong>Material {index + 1}</strong>
                <small>{coverage(index as 0 | 1)}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="placement-actions">
          <Button variant="ghost" size="sm" shape="pill" icon="plus" disabled={imageStatus !== 'ready'} onClick={addDefaultArea}>Add area</Button>
          <Button variant="ghost" size="sm" shape="pill" icon="undo" disabled={!history.length} onClick={undo}>Undo</Button>
          <Button
            variant="ghost"
            size="sm"
            shape="pill"
            icon="trash"
            disabled={!counts[active]}
            aria-label={`Clear Material ${active + 1} areas`}
            onClick={() => commit(areas.filter((area) => area.material !== active))}
          >
            Clear
          </Button>
        </div>
      </div>

      {problem ? <Alert tone="warning" className="placement-problem" onDismiss={() => setProblem('')}>{problem}</Alert> : null}

      <div className="placement-body">
        {imageStatus === 'failed' ? (
          <EmptyState
            compact
            icon="alert"
            headingLevel={3}
            title="The room photo couldn’t be loaded"
            description="Go back and choose the room again."
            actions={onSkip ? <Button variant="ghost" shape="pill" onClick={onSkip}>{skipLabel}</Button> : undefined}
          />
        ) : (
          <>
            {imageStatus === 'loading' ? <LoadingState compact label="Loading the room…" /> : null}
            <div className={cx('placement-canvas', imageStatus === 'ready' && 'is-ready')}>
              <img
                src={roomImageUrl}
                alt="The room to place the materials in"
                draggable={false}
                onLoad={() => setImageStatus('ready')}
                onError={() => setImageStatus('failed')}
              />
              <div
                className={cx('placement-surface', `placement-surface--${active + 1}`)}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={cancelInteraction}
              >
                {areas.map((area) => {
                  const isActive = area.material === active
                  const position = areas.filter((item) => item.material === area.material).indexOf(area) + 1
                  const name = `Material ${area.material + 1} area ${position}`
                  return (
                    <div
                      key={area.id}
                      className={cx(
                        'placement-area',
                        `placement-area--${area.material + 1}`,
                        isActive && 'is-active',
                        isActive && conflictsWith(area, area.material, area.id) && 'is-invalid',
                      )}
                      style={boxStyle(area)}
                      data-area-id={area.id}
                      role="group"
                      aria-label={isActive ? `${name}. Drag to move it, or use the arrow keys; Shift with arrow keys resizes it, Delete removes it.` : name}
                      tabIndex={isActive ? 0 : -1}
                      onKeyDown={isActive ? (event) => handleAreaKeyDown(event, area) : undefined}
                      onBlur={() => { adjustingId.current = null }}
                    >
                      <span className="placement-tag" aria-hidden="true">{area.material + 1}</span>
                      {isActive ? CORNERS.map((corner) => (
                        <span key={corner} className={`placement-handle placement-handle--${corner}`} data-corner={corner} aria-hidden="true" />
                      )) : null}
                      {isActive ? (
                        <button
                          type="button"
                          className="placement-area-remove"
                          aria-label={`Remove ${name}`}
                          onClick={() => commit(areas.filter((item) => item.id !== area.id))}
                        >
                          <Icon name="close" />
                        </button>
                      ) : null}
                    </div>
                  )
                })}
                {draft ? (
                  <div
                    className={cx('placement-area placement-draft', `placement-area--${active + 1}`, conflictsWith(draft, active) && 'is-invalid')}
                    style={boxStyle(draft)}
                  />
                ) : null}
              </div>
            </div>
            {imageStatus === 'ready' ? (
              <p className="placement-hint">
                Drag on the photo to mark where Material {active + 1} goes
                {counts[active] ? '; drag an area to move it, or a corner to resize it' : ''}.{' '}
                {restIndex === null
                  ? `Material ${other + 1} then covers the rest of the furniture.`
                  : `Material ${restIndex + 1} covers the rest of the furniture.`}
              </p>
            ) : null}
          </>
        )}
      </div>
    </StepPanel>
  )
}
