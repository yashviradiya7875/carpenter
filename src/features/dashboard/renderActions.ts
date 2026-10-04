import type { MaterialChoice } from './dashboardTypes'
import type { ShareChannel } from './dashboardService'

/* ----------------------------------------------------------------- download */

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function fileBaseName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
  return base || 'render'
}

/**
 * Saves a render to the device. If the image can't be fetched for download (e.g. the
 * image host blocks it), it opens in a new tab instead so it can be saved from there.
 */
export async function downloadImage(url: string, name: string): Promise<'downloaded' | 'opened'> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Image request failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `carpenter-${fileBaseName(name)}.${IMAGE_EXTENSIONS[blob.type] ?? 'png'}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    return 'downloaded'
  } catch {
    window.open(url, '_blank', 'noopener')
    return 'opened'
  }
}

/* -------------------------------------------------------------------- share */

export type ShareDelivery = { channel: ShareChannel; status: 'attempted' | 'cancelled' }

/** The OS share sheet; missing on desktop Firefox and older browsers. */
export function hasShareSheet(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Hands the message to the device share sheet, or copies it where there is none.
 * Call it directly from the user's click: browsers only open the share sheet then.
 * A dismissed sheet is still an attempt, reported as `cancelled`.
 */
export async function deliverShare(options: {
  text: string
  url?: string
  allowShareSheet: boolean
  allowCopy: boolean
}): Promise<ShareDelivery> {
  const { text, url, allowShareSheet, allowCopy } = options

  if (allowShareSheet && hasShareSheet()) {
    try {
      await navigator.share({ title: 'Carpenter Pro', text, url })
      return { channel: 'device_share', status: 'attempted' }
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return { channel: 'device_share', status: 'cancelled' }
      // The sheet couldn't open at all; fall through to copying.
      if (!allowCopy) throw new Error('Sharing isn’t available on this device.', { cause: error })
    }
  }

  if (allowCopy) {
    try {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text)
    } catch (error) {
      throw new Error('The message couldn’t be copied in this browser.', { cause: error })
    }
    return { channel: 'copy', status: 'attempted' }
  }
  return { channel: 'device_share', status: 'attempted' }
}

/* ------------------------------------------------------------ save to Files */

/** Longest edge of the laminate preview stored with a saved render. */
const SOURCE_TEXTURE_EDGE = 512

/**
 * The laminate a render was made from, as the URL Files stores beside it. A library
 * laminate already has one; an uploaded laminate becomes a small preview so the whole
 * upload isn't stored a second time.
 */
export async function sourceTextureUrl(material: MaterialChoice): Promise<string | undefined> {
  const url = material.imageUrl
  if (!url || !url.startsWith('data:')) return url

  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('unreadable'))
      image.src = url
    })
  } catch {
    return undefined
  }
  const scale = Math.min(1, SOURCE_TEXTURE_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}
