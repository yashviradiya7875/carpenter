import { useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, Field, Select, Textarea, TextInput } from '../../../shared/ui'
import type { ShareClient } from '../dashboardService'

const NEW_CLIENT = ''

/** What the form collects; the page delivers the share and records the attempt. */
export type ShareDraft = {
  /** Set when an existing client was picked. */
  clientId?: string
  clientName: string
  whatsapp: string
  /** `YYYY-MM-DD`, or empty. */
  followUpDate: string
  message: string
}

type ShareDialogProps = {
  open: boolean
  onClose: () => void
  clients: ShareClient[]
  isLoadingClients: boolean
  /** The account's saved share message, used to start the Message field. */
  defaultMessage?: string
  /** `copy` where the device has no share sheet: the message is copied instead. */
  mode: 'share' | 'copy'
  /** Delivers and records the share. Reject with a user-facing Error to keep the dialog open. */
  onShare: (draft: ShareDraft) => Promise<void>
}

type FormState = { clientId: string; clientName: string; whatsapp: string; followUpDate: string; message: string }

function emptyForm(message = ''): FormState {
  return { clientId: NEW_CLIENT, clientName: '', whatsapp: '', followUpDate: '', message }
}

/** Optional, but when given it has to look like a phone number (7–15 digits). */
function whatsappProblem(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '').length
  return /^\+?[\d\s().-]+$/.test(trimmed) && digits >= 7 && digits <= 15
    ? undefined
    : 'Enter a phone number with its country code, e.g. +91 98765 43210.'
}

/**
 * Share a render with a client: pick or add the client, set a follow-up, review the
 * message, then share. Stays mounted so it can close with the Dialog's exit animation;
 * what was typed is kept until the share goes through.
 */
export function ShareDialog({ open, onClose, clients, isLoadingClients, defaultMessage = '', mode, onShare }: ShareDialogProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultMessage))
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  // After a share goes through, start clean the next time the dialog opens (not while it fades out).
  const [resetOnOpen, setResetOnOpen] = useState(false)
  if (open && resetOnOpen) {
    setResetOnOpen(false)
    setForm(emptyForm(defaultMessage))
    setHasSubmitted(false)
    setError('')
  }

  const selectedClient = clients.find((client) => client.id === form.clientId)
  const isNewClient = !selectedClient
  const nameError = isNewClient && !form.clientName.trim() ? 'Enter the client’s name.' : undefined
  const whatsappError = isNewClient ? whatsappProblem(form.whatsapp) : undefined

  const update = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }))

  // Picking an existing client fills in what is already known, so a repeat share is quick.
  const pickClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId)
    update(client
      ? { clientId, clientName: client.name, whatsapp: client.whatsapp ?? '', followUpDate: client.followUpDate ?? '' }
      : { clientId: NEW_CLIENT, clientName: '', whatsapp: '', followUpDate: '' })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSending) return
    setHasSubmitted(true)
    if (nameError || whatsappError) return
    setIsSending(true)
    setError('')
    try {
      await onShare({
        clientId: selectedClient?.id,
        clientName: form.clientName.trim(),
        whatsapp: form.whatsapp.trim(),
        followUpDate: form.followUpDate,
        message: form.message.trim(),
      })
      setResetOnOpen(true)
    } catch (shareFailure) {
      setError(shareFailure instanceof Error ? shareFailure.message : 'The share couldn’t be completed. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share with a client"
      description="Recorded as a share attempt, not a confirmed delivery."
      size="sm"
      className="share-dialog"
      dismissible={!isSending}
      onSubmit={(event) => void handleSubmit(event)}
      footer={(
        <>
          <Button shape="pill" disabled={isSending} onClick={onClose}>Cancel</Button>
          <Button variant="primary" shape="pill" type="submit" icon="share" loading={isSending} loadingLabel="Sharing…">
            {mode === 'copy' ? 'Copy message' : 'Share'}
          </Button>
        </>
      )}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field label="Client">
        <Select value={selectedClient ? form.clientId : NEW_CLIENT} disabled={isLoadingClients || isSending} onChange={(event) => pickClient(event.target.value)}>
          <option value={NEW_CLIENT}>{isLoadingClients ? 'Loading clients…' : 'New client'}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}{client.whatsapp ? ` · ${client.whatsapp}` : ''}</option>
          ))}
        </Select>
      </Field>

      {isNewClient ? (
        <>
          <Field label="Client name" required error={hasSubmitted ? nameError : undefined}>
            <TextInput
              value={form.clientName}
              autoComplete="off"
              disabled={isSending}
              onChange={(event) => update({ clientName: event.target.value })}
            />
          </Field>
          <Field label="WhatsApp" error={hasSubmitted ? whatsappError : undefined}>
            <TextInput
              type="tel"
              inputMode="tel"
              value={form.whatsapp}
              autoComplete="off"
              placeholder="+91 98765 43210"
              disabled={isSending}
              onChange={(event) => update({ whatsapp: event.target.value })}
            />
          </Field>
        </>
      ) : (
        <p className="share-client-summary app-enter">
          <strong>{selectedClient.name}</strong>
          <span>{selectedClient.whatsapp || 'No WhatsApp number'}</span>
        </p>
      )}

      <Field label="Follow-up date">
        <TextInput type="date" value={form.followUpDate} disabled={isSending} onChange={(event) => update({ followUpDate: event.target.value })} />
      </Field>

      <Field
        label="Message"
        hint={mode === 'copy' ? 'This device has no share sheet, so the message and the render link are copied for you to paste.' : undefined}
      >
        <Textarea rows={3} value={form.message} disabled={isSending} onChange={(event) => update({ message: event.target.value })} />
      </Field>
    </Dialog>
  )
}
