import { useState, type Ref } from 'react'
import { Alert, Button, cx, EmptyState, GeneratingLoader, Spinner } from '../../../shared/ui'
import type { GenerationResult } from '../dashboardService'

export type GenerationStageView = 'loading' | 'result' | 'error'

// What a render is doing, in order. The API reports no progress, so these advance on time
// alone and the last one stays: none of them may claim the render is nearly finished.
const RENDER_MESSAGES = ['Preparing your room', 'Applying your laminate', 'Rendering the visualization']

/** Feedback for a result action (download, share, save), shown above the action bar. */
export type ResultNotice = {
  tone: 'success' | 'info' | 'error'
  message: string
  action?: { label: string; onClick: () => void }
}

type GenerationStageProps = {
  view: GenerationStageView
  /** Renders finished out of the batch, when several images are rendered in turn. */
  batchProgress: { done: number; total: number } | null
  render: GenerationResult | null
  renderName: string
  completedRenders: number
  error: string
  canRetry: boolean
  onRetry: () => void
  /** Returns to the studio. A render that is still running keeps going. */
  onBack: () => void
  /** Result actions. Download, Share and Save to Files are left out when the account isn't allowed them. */
  onDownload?: () => void
  isDownloading: boolean
  onShare?: () => void
  onSaveToFiles?: () => void
  saveStatus: 'idle' | 'saving' | 'saved'
  notice: ResultNotice | null
  onDismissNotice: () => void
  ref?: Ref<HTMLElement>
}

/**
 * Takes the place of the studio content from the moment a render starts until the user
 * leaves the result: generating, then the finished render or what went wrong.
 */
export function GenerationStage({
  view,
  batchProgress,
  render,
  renderName,
  completedRenders,
  error,
  canRetry,
  onRetry,
  onBack,
  onDownload,
  isDownloading,
  onShare,
  onSaveToFiles,
  saveStatus,
  notice,
  onDismissNotice,
  ref,
}: GenerationStageProps) {
  return (
    <section ref={ref} className="generation-stage app-enter-fade" tabIndex={-1} aria-label="Render generation">
      <p className="sr-only" role="status">
        {view === 'result' ? (completedRenders > 1 ? `${completedRenders} renders are ready.` : 'Your render is ready.') : ''}
      </p>

      {/* Keyed, so each state enters with its own animation. */}
      <div key={view} className="generation-stage-view">
        {view === 'loading' ? (
          <>
            <GeneratingLoader
              message={batchProgress ? `Render ${Math.min(batchProgress.done + 1, batchProgress.total)} of ${batchProgress.total}` : undefined}
              messages={batchProgress ? undefined : RENDER_MESSAGES}
              progress={batchProgress
                ? { value: batchProgress.done, max: batchProgress.total, label: `${batchProgress.done} of ${batchProgress.total} renders complete` }
                : undefined}
              hint={batchProgress ? 'Each render can take a few minutes' : 'This can take a few minutes'}
              showElapsed
            />
            <Button variant="ghost" size="sm" shape="pill" icon="back" onClick={onBack} tooltip="Your render keeps going">
              Back to studio
            </Button>
          </>
        ) : view === 'error' ? (
          <div role="alert">
            <EmptyState
              icon="alert"
              title="The render couldn’t be completed"
              description={error}
              actions={(
                <>
                  <Button variant="primary" shape="pill" icon="refresh" disabled={!canRetry} onClick={onRetry}>Try again</Button>
                  <Button shape="pill" icon="back" onClick={onBack}>Back to studio</Button>
                </>
              )}
            />
          </div>
        ) : (
          <article className="generation-result">
            <div className="generation-result-frame">
              {render?.imageUrl ? <RenderImage key={render.imageUrl} src={render.imageUrl} /> : null}
            </div>
            {notice ? (
              <Alert key={notice.message} tone={notice.tone} className="generation-result-notice" onDismiss={onDismissNotice}>
                {notice.message}
                {notice.action ? (
                  <>
                    {' '}
                    <Button variant="link" size="xs" className="dashboard-message-action" onClick={notice.action.onClick}>{notice.action.label}</Button>
                  </>
                ) : null}
              </Alert>
            ) : null}
            <footer className="generation-result-bar">
              <div className="generation-result-copy">
                <span>{completedRenders > 1 ? `Latest of ${completedRenders} renders` : 'Render ready'}</span>
                <h2>{renderName || 'Carpenter preview'}</h2>
              </div>
              <div className="generation-result-actions">
                {onDownload ? (
                  <Button size="sm" shape="pill" icon="download" loading={isDownloading} loadingLabel="Downloading…" onClick={onDownload}>
                    Download
                  </Button>
                ) : null}
                {onShare ? (
                  <Button variant="primary" size="sm" shape="pill" icon="share" onClick={onShare}>Share</Button>
                ) : null}
                {onSaveToFiles ? (
                  <Button
                    size="sm"
                    shape="pill"
                    icon={saveStatus === 'saved' ? 'check' : 'folder'}
                    disabled={saveStatus === 'saved'}
                    loading={saveStatus === 'saving'}
                    loadingLabel="Saving…"
                    onClick={onSaveToFiles}
                  >
                    {saveStatus === 'saved' ? 'Saved to Files' : 'Save to Files'}
                  </Button>
                ) : null}
                {/* The main action when sharing isn't available to this account. */}
                <Button variant={onShare ? 'secondary' : 'primary'} size="sm" shape="pill" icon="plus" onClick={onBack}>New render</Button>
              </div>
            </footer>
          </article>
        )}
      </div>
    </section>
  )
}

/** The finished render; fades in once the image itself has loaded. */
function RenderImage({ src }: { src: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading')

  if (status === 'failed') return <p className="generation-result-missing">The preview couldn’t be loaded.</p>
  return (
    <>
      {status === 'loading' ? <Spinner className="generation-result-spinner" label="Loading your render" /> : null}
      <img
        className={cx(status === 'loaded' && 'is-loaded')}
        src={src}
        alt="Your generated Carpenter material preview"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('failed')}
      />
    </>
  )
}
