import type { DriveFolder } from './filesService'

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function formatDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|tiff?|webp)$/i.test(file.name)
}

/** Whether `candidate` sits anywhere below `folderId` (prevents moving a folder into itself). */
export function isDescendant(folderId: string, candidate: DriveFolder, folders: DriveFolder[]): boolean {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  let parentId = candidate.parentId
  while (parentId) {
    if (parentId === folderId) return true
    parentId = foldersById.get(parentId)?.parentId ?? null
  }
  return false
}
