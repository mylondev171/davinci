export type Permission =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'invite'
  | 'manage_roles'
  | 'manage_semrush'
  | 'manage_reportgarden'

export type Role = 'owner' | 'admin' | 'member'

const PERMISSION_MAP: Record<Permission, Role[]> = {
  read: ['owner', 'admin', 'member'],
  create: ['owner', 'admin', 'member'],
  update: ['owner', 'admin', 'member'],
  delete: ['owner', 'admin'],
  invite: ['owner', 'admin'],
  manage_roles: ['owner', 'admin'],
  manage_semrush: ['owner'],
  manage_reportgarden: ['owner'],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_MAP[permission].includes(role)
}
