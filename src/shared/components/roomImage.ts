/** A room category from the scene library, e.g. Wardrobes or Kitchen. */
export type RoomCategory = { id: string; label: string; count?: number }

/** A predefined room from the scene library. */
export type RoomScene = {
  id: string
  name: string
  category: string
  aspectRatio?: string
  imageUrl?: string
  thumbUrl?: string
}

/** A room photo the user uploaded or captured, prepared for the render API. */
export type CustomRoom = {
  name: string
  /** JPEG data without the `data:` prefix. */
  base64: string
  mimeType: string
  previewUrl: string
  aspectRatio: string
}

export type RoomSelection =
  | { kind: 'scene'; scene: RoomScene }
  | { kind: 'custom'; room: CustomRoom }

/** Largest room photo accepted before resizing. */
export const MAX_ROOM_IMAGE_BYTES = 25 * 1024 * 1024

/** Longest edge sent to the API; the server stores scenes at this size too. */
const MAX_EDGE = 2048

const ASPECT_RATIOS: Array<[string, number]> = [
  ['1:1', 1],
  ['3:4', 3 / 4],
  ['4:3', 4 / 3],
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
]

/** The supported render ratio closest to the photo's own shape. */
export function nearestAspectRatio(width: number, height: number): string {
  const ratio = width / height
  return ASPECT_RATIOS.reduce((best, candidate) => (
    Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best
  ))[0]
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image couldn’t be read. Try a JPG or PNG photo.'))
    }
    image.src = url
  })
}

/**
 * Validates a room photo and prepares it for the render API: scaled so its longest
 * edge is at most 2048px and encoded as JPEG, which keeps phone photos small enough
 * to send alongside the laminate. Throws an Error with a user-facing message.
 */
export async function fileToRoomImage(file: File): Promise<CustomRoom> {
  if (!file.type.startsWith('image/') && !/\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('Choose an image file for the room.')
  }
  if (file.size > MAX_ROOM_IMAGE_BYTES) throw new Error('Keep the room photo under 25 MB.')

  const image = await loadImage(file)
  const { naturalWidth, naturalHeight } = image
  if (!naturalWidth || !naturalHeight) throw new Error('This image couldn’t be read. Try a JPG or PNG photo.')

  const scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight))
  const width = Math.round(naturalWidth * scale)
  const height = Math.round(naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser couldn’t prepare the photo. Try another image.')
  context.drawImage(image, 0, 0, width, height)

  const previewUrl = canvas.toDataURL('image/jpeg', 0.9)
  const base64 = previewUrl.split(',')[1]
  if (!base64) throw new Error('This image couldn’t be read. Try a JPG or PNG photo.')

  return {
    name: file.name || 'Your room',
    base64,
    mimeType: 'image/jpeg',
    previewUrl,
    aspectRatio: nearestAspectRatio(width, height),
  }
}
