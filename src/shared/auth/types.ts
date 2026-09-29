export type CarpenterCapabilities = {
  canUploadLaminate?: boolean
  laminateSource?: 'own' | 'files_or_upload' | 'sponsor_library' | 'none'
  filesAccess?: 'full' | 'laminates' | 'none'
  canShare?: boolean
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
  accountStatus?: string
  allowedApps?: string[]
  capabilities?: CarpenterCapabilities
  token?: string
}