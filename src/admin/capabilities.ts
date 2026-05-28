/**
 * Capability strings — compose roles server-side; mirror in Supabase RLS / Edge Functions.
 * Super admin includes all; admin gets moderation + events; member gets none of these.
 */
export const CAPABILITY_KEYS = [
  'moderate_posts',
  'manage_events',
  'issue_refunds',
  'view_analytics',
  'check_in_attendees',
  'manage_billing',
  'assign_roles',
] as const;

export type Capability = (typeof CAPABILITY_KEYS)[number];

export type AppRole = 'member' | 'admin' | 'super_admin';

const ALL: Capability[] = [...CAPABILITY_KEYS];

const BY_ROLE: Record<AppRole, Capability[]> = {
  member: [],
  admin: ['moderate_posts', 'manage_events', 'check_in_attendees', 'view_analytics'],
  super_admin: ALL,
};

export function capabilitiesForRole(role: AppRole): Set<Capability> {
  return new Set(BY_ROLE[role] ?? []);
}

export function can(role: AppRole, cap: Capability): boolean {
  return capabilitiesForRole(role).has(cap);
}
