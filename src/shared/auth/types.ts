export type CarpenterCapabilities = {
  canUploadLaminate?: boolean
  laminateSource?: 'own' | 'files_or_upload' | 'sponsor_library' | 'none'
  /**
   * Files (Drive) access, set by the API per account type:
   * `full` (Manufacturer) and `unrestricted` (admin and other non-market roles) can manage
   * folders and files; `laminates` (Dealer Pro) is view-only; `none` has no Files.
   */
  filesAccess?: 'full' | 'unrestricted' | 'laminates' | 'none'
  canShare?: boolean
  /** How a share may leave the app; each defaults to allowed when the API omits it. */
  share?: { deviceShare?: boolean; copyMessageFallback?: boolean }
  canDownload?: boolean
  canSaveToFiles?: boolean
  brandingStrip?: boolean
}

export type AuthAccount = {
  username: string
  email?: string
  displayName?: string
  role: string
  credits?: number
  /** Render resolution tier (`1K` | `2K` | `4K`), set per account by an admin; it decides the cost per render. */
  resolution?: string
  accountStatus?: string
  /** The account's saved outgoing share message (set with `updateUserProfile`). */
  shareMessagePreset?: string
  allowedApps?: string[]
  capabilities?: CarpenterCapabilities
  token?: string
}