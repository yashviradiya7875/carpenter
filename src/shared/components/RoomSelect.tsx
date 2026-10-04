import { useId, useRef, useState, type ChangeEvent, type ReactNode, type Ref } from 'react'
import { Alert, Button, cx, EmptyState, Icon, LoadingState, Tabs } from '../ui'
import { StepPanel } from './StepPanel'
import { fileToRoomImage, type CustomRoom, type RoomCategory, type RoomScene, type RoomSelection } from './roomImage'
import './RoomSelect.css'

export type RoomSelectProps = {
  /** Returns to the previous step. The selection made so far is kept while this stays mounted. */
  onBack: () => void
  backLabel?: ReactNode
  /** Library categories, in display order. */
  categories: RoomCategory[]
  /** Library rooms across all categories. */
  scenes: RoomScene[]
  isLoading?: boolean
  /** Shown when the library couldn't be loaded. Uploading a room still works. */
  error?: string
  onRetry?: () => void
  /** Preselects a room, e.g. the one chosen last time. */
  initialSelection?: RoomSelection | null
  /** Confirm button content, e.g. "Continue · 2 credits". */
  confirmLabel?: ReactNode
  onConfirm: (selection: RoomSelection) => void
  /** Offered when the library has no rooms to choose from, e.g. to continue with a generated room. */
  onSkip?: () => void
  skipLabel?: ReactNode
  title?: ReactNode
  description?: ReactNode
  /** Hides the step without unmounting it, so the selection survives moving between steps. */
  hidden?: boolean
  /** The step's root; focus it when the step is shown. */
  ref?: Ref<HTMLElement>
  className?: string
}

/**
 * Room selection step for a generation flow: pick a predefined room by category, or
 * upload / photograph a custom one. Renders inline, inside the page that hosts the flow.
 * Purely presentational — the caller supplies the library and receives the confirmed selection.
 */
export function RoomSelect({
  onBack,
  backLabel = 'Back',
  categories,
  scenes,
  isLoading = false,
  error,
  onRetry,
  initialSelection = null,
  confirmLabel = 'Continue',
  onConfirm,
  onSkip,
  skipLabel = 'Continue without a room',
  title = 'Choose where it lives',
  description = 'Pick a room for your laminate, or upload a photo of your own space.',
  hidden = false,
  ref,
  className,
}: RoomSelectProps) {
  const panelId = useId()
  const [selection, setSelection] = useState<RoomSelection | null>(initialSelection)
  const [customRoom, setCustomRoom] = useState<CustomRoom | null>(initialSelection?.kind === 'custom' ? initialSelection.room : null)
  const [activeCategory, setActiveCategory] = useState(initialSelection?.kind === 'scene' ? initialSelection.scene.category : '')
  const [isPreparing, setIsPreparing] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const uploadInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  // The library may arrive after the step opens; fall back to the first category.
  const category = categories.some((item) => item.id === activeCategory) ? activeCategory : categories[0]?.id ?? ''
  const visibleScenes = categories.length ? scenes.filter((scene) => scene.category === category) : scenes
  const hasLibraryRooms = scenes.length > 0

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setUploadError('')
    setIsPreparing(true)
    try {
      const room = await fileToRoomImage(file)
      setCustomRoom(room)
      setSelection({ kind: 'custom', room })
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'This image couldn’t be used. Try another photo.')
    } finally {
      setIsPreparing(false)
    }
  }

  const isCustomSelected = selection?.kind === 'custom'
  const selectedSceneId = selection?.kind === 'scene' ? selection.scene.id : null

  return (
    <StepPanel
      ref={ref}
      className={cx('room-select', className)}
      hidden={hidden}
      title={title}
      description={description}
      onBack={onBack}
      backLabel={backLabel}
      footer={(
        <>
          <span className="step-panel-summary" role="status">
            {selection
              ? `${selection.kind === 'custom' ? 'Your room' : selection.scene.name} selected`
              : 'Select a room to continue'}
          </span>
          <Button variant="primary" size="sm" shape="pill" disabled={!selection || isPreparing} onClick={() => selection && onConfirm(selection)}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <input ref={uploadInput} className="room-select-input" type="file" accept="image/*" onChange={(event) => void handleFile(event)} tabIndex={-1} />
      {/* `capture` opens the rear camera on phones; elsewhere it behaves like a normal picker. */}
      <input ref={cameraInput} className="room-select-input" type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event)} tabIndex={-1} />

      <div className="room-select-toolbar">
        {categories.length ? (
          <Tabs
            className="room-select-tabs"
            label="Room categories"
            panelId={panelId}
            value={category}
            onChange={setActiveCategory}
            tabs={categories.map((item) => ({ id: item.id, label: item.label }))}
          />
        ) : <span />}
        <div className="room-select-upload">
          <Button
            className="room-select-camera"
            size="sm"
            shape="pill"
            icon="camera"
            disabled={isPreparing}
            onClick={() => cameraInput.current?.click()}
          >
            Take photo
          </Button>
          <Button
            size="sm"
            shape="pill"
            icon="upload"
            loading={isPreparing}
            loadingLabel="Preparing photo…"
            onClick={() => uploadInput.current?.click()}
          >
            Upload custom room
          </Button>
        </div>
      </div>

      {uploadError ? <Alert tone="error" className="room-select-alert" onDismiss={() => setUploadError('')}>{uploadError}</Alert> : null}

      <div className="room-select-panel" id={panelId} role={categories.length ? 'tabpanel' : undefined} aria-label={categories.length ? undefined : 'Rooms'}>
        {isLoading ? (
          <LoadingState label="Loading rooms…" />
        ) : (
          <>
            {customRoom || visibleScenes.length ? (
              <ul className="room-grid">
                {customRoom ? (
                  <li>
                    <RoomTile
                      name="Your room"
                      imageUrl={customRoom.previewUrl}
                      selected={isCustomSelected}
                      onSelect={() => setSelection({ kind: 'custom', room: customRoom })}
                    />
                  </li>
                ) : null}
                {visibleScenes.map((scene) => (
                  <li key={scene.id}>
                    <RoomTile
                      name={scene.name}
                      imageUrl={scene.thumbUrl || scene.imageUrl}
                      selected={selectedSceneId === scene.id}
                      onSelect={() => setSelection({ kind: 'scene', scene })}
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <EmptyState
                compact
                icon="alert"
                headingLevel={3}
                title="The room library couldn’t be loaded"
                description={`${error} You can still upload a photo of your own room.`}
                actions={(
                  <>
                    {onRetry ? <Button shape="pill" icon="refresh" onClick={onRetry}>Try again</Button> : null}
                    {onSkip ? <Button variant="ghost" shape="pill" onClick={onSkip}>{skipLabel}</Button> : null}
                  </>
                )}
              />
            ) : !hasLibraryRooms ? (
              <EmptyState
                compact
                icon="image"
                headingLevel={3}
                title="No rooms in the library yet"
                description="Upload a photo of your own room to continue."
                actions={onSkip ? <Button variant="ghost" shape="pill" onClick={onSkip}>{skipLabel}</Button> : undefined}
              />
            ) : !visibleScenes.length && !customRoom ? (
              <EmptyState compact icon="image" headingLevel={3} title="No rooms in this category" description="Choose another category or upload your own room." />
            ) : null}
          </>
        )}
      </div>
    </StepPanel>
  )
}

type RoomTileProps = {
  name: string
  imageUrl?: string
  selected: boolean
  onSelect: () => void
}

function RoomTile({ name, imageUrl, selected, onSelect }: RoomTileProps) {
  return (
    <button className={cx('room-tile', selected && 'is-selected')} type="button" aria-pressed={selected} onClick={onSelect}>
      <span className="room-tile-media">
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <Icon name="image" />}
        {selected ? <span className="room-tile-check"><Icon name="check" /></span> : null}
      </span>
      <span className="room-tile-name">{name}</span>
    </button>
  )
}
