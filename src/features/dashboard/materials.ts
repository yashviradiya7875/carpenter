import type { MaterialChoice, PlacementPlan, Product, ProductDetails, UploadType } from './dashboardTypes'

/** Largest single image accepted as a render material. */
export const MAX_RENDER_MATERIAL_BYTES = 20 * 1024 * 1024
/** Most product images accepted in one multi-product upload. */
export const MAX_MULTI_PRODUCT_FILES = 200

const IMAGE_EXTENSION = /\.(avif|bmp|gif|jpe?g|png|tiff?|webp)$/i
const VIDEO_EXTENSION = /\.(avi|m4v|mkv|mov|mp4|webm)$/i

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || (!file.type && IMAGE_EXTENSION.test(file.name))
}

function isVideo(file: File): boolean {
  return file.type.startsWith('video/') || (!file.type && VIDEO_EXTENSION.test(file.name))
}

export type UploadSelection =
  | { ok: true; kind: UploadType; files: File[] }
  | { ok: false; message: string }

/**
 * Works out what the user uploaded, so they never have to pick a type first:
 * one image is a single render, several images are one render each, video is a reel.
 * Returns a message instead when the selection can't be used.
 */
export function classifyUpload(files: File[]): UploadSelection {
  if (!files.length) return { ok: false, message: 'Choose an image to continue.' }

  const unsupported = files.find((file) => !isImage(file) && !isVideo(file))
  if (unsupported) return { ok: false, message: `${unsupported.name} isn’t an image or a video.` }

  const videos = files.filter(isVideo)
  if (videos.length && videos.length !== files.length) {
    return { ok: false, message: 'Upload images or a video, not both at once.' }
  }
  if (videos.length) return { ok: true, kind: 'reel', files: videos }

  if (files.length > MAX_MULTI_PRODUCT_FILES) {
    return { ok: false, message: `Choose no more than ${MAX_MULTI_PRODUCT_FILES} product images at a time.` }
  }
  const oversized = files.find((file) => file.size > MAX_RENDER_MATERIAL_BYTES)
  if (oversized) {
    return {
      ok: false,
      message: files.length === 1 ? 'Keep the image size under 20 MB.' : `${oversized.name} is over 20 MB. Keep each image under 20 MB.`,
    }
  }
  return { ok: true, kind: files.length === 1 ? 'single' : 'multi', files }
}

/** Reads an uploaded image into a material the render API accepts (base64 + MIME type). */
export function fileToMaterial(file: File): Promise<MaterialChoice> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      const base64 = reader.result.split(',')[1]
      if (!base64) {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      resolve({
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        base64,
        mimeType: file.type || 'image/jpeg',
        imageUrl: reader.result,
        source: 'upload',
      })
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

/** A catalog product as a render material, using its first face. */
export function productToMaterial(details: ProductDetails, listed: Product): MaterialChoice {
  const image = details.product?.images?.[0]
  if (!details.product || !image) throw new Error('This material does not have a usable image.')
  return {
    id: `product-${details.product.id}`,
    name: details.product.name,
    imageId: image.id,
    imageUrl: image.thumbUrl || image.url || listed.thumbUrl || listed.coverThumbUrl || listed.imageUrl,
    source: 'library',
  }
}

/** A material's name without its file extension, for showing it to the user. */
export function materialLabel(material: MaterialChoice): string {
  return material.name.replace(/\.[a-z0-9]{2,5}$/i, '')
}

/**
 * Turns the areas marked for two materials into what the render API takes: one laminate
 * for the furniture as a whole and a second (the accent) for marked boxes. The material
 * with marked areas becomes the accent; when both have areas, the second material's are
 * sent and the first covers everything else, which includes its own marked areas.
 */
export function planPlacement(
  materials: [MaterialChoice, MaterialChoice],
  areas: Array<{ material: 0 | 1; x: number; y: number; w: number; h: number }>,
): PlacementPlan {
  const round = (value: number) => Math.round(value * 1000) / 1000
  const marked = areas.some((area) => area.material === 1) ? 1 : 0
  return {
    primary: materials[marked === 1 ? 0 : 1],
    accent: materials[marked],
    accentRegions: areas
      .filter((area) => area.material === marked)
      .map((area) => ({ x: round(area.x), y: round(area.y), w: round(area.w), h: round(area.h) })),
  }
}
