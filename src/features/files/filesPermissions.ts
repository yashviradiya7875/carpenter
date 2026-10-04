// Drive resource roles: owner > admin > editor > viewer.

/** Editors and above can rename, move and add content. */
export function canEdit(role?: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

/** Shared with this user by someone else, or opened up by its owner to the organization or the public. */
export function isShared(resource: { myRole?: string; visibility?: string }): boolean {
  if (resource.myRole && resource.myRole !== 'owner') return true
  return resource.visibility === 'organization' || resource.visibility === 'public'
}

/** Owners and admins can change sharing and delete folders. */
export function canManage(role?: string): boolean {
  return role === 'owner' || role === 'admin'
}
