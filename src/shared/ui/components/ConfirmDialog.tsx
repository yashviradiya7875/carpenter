import { useRef, type ReactNode } from 'react'
import { Alert } from './Alert'
import { Button } from '../primitives/Button'
import { Dialog } from './Dialog'
import type { IconName } from '../primitives/Icon'

export type ConfirmDialogProps = {
  open: boolean
  title: ReactNode
  description?: ReactNode
  /** Extra content, e.g. an option checkbox. */
  children?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  /** 'danger' for destructive or irreversible actions. */
  tone?: 'primary' | 'danger'
  loading?: boolean
  loadingLabel?: ReactNode
  error?: ReactNode
  icon?: IconName
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  loadingLabel,
  error,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Focus the safe choice first.
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isDanger = tone === 'danger'

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      dismissible={!loading}
      hideCloseButton
      icon={icon ?? (isDanger ? 'trash' : undefined)}
      iconTone={isDanger ? 'danger' : 'accent'}
      initialFocusRef={cancelRef}
      footer={(
        <>
          <Button ref={cancelRef} variant="secondary" shape="pill" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={isDanger ? 'destructive' : 'primary'} shape="pill" loading={loading} loadingLabel={loadingLabel} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      {error || children ? (
        <>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {children}
        </>
      ) : null}
    </Dialog>
  )
}
