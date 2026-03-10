export type Permission =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'invite'
  | 'manage_roles'
  | 'manage_integrations'

export type Role = 'owner' | 'admin' | 'member'

const PERMISSION_MAP: Record<Permission, Role[]> = {
  read: ['owner', 'admin', 'member'],
  create: ['owner', 'admin', 'member'],
  update: ['owner', 'admin', 'member'],
  delete: ['owner', 'admin'],
  invite: ['owner', 'admin'],
  manage_roles: ['owner', 'admin'],
  manage_integrations: ['owner', 'admin'],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_MAP[permission].includes(role)
}
