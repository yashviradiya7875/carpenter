import type { MaterialChoice, Product, ProductDetails } from './dashboardTypes'

/** Largest single image accepted as a render material. */
export const MAX_RENDER_MATERIAL_BYTES = 20 * 1024 * 1024
/** Most product images accepted in one multi-product upload. */
export const MAX_MULTI_PRODUCT_FILES = 200

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
