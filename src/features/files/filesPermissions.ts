// Drive resource roles: owner > admin > editor > viewer.

/** Editors and above can rename, move and add content. */
export function canEdit(role?: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

/** Owners and admins can change sharing and delete folders. */
export function canManage(role?: string): boolean {
  return role === 'owner' || role === 'admin'
}
