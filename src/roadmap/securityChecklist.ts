/**
 * High-level security backlog — tick off in release reviews; pair with Dependabot + `npm audit`.
 * (No external “skills.sh” dependency — keep checklist in-repo.)
 */
export const SECURITY_CHECKLIST_ITEMS = [
  { id: 'rls', label: 'Supabase RLS enabled + tested for profiles, posts, messages, media, bookings' },
  { id: 'secrets', label: 'No service keys in client; only EXPO_PUBLIC_* anon + RevenueCat public SDK keys' },
  { id: 'oauth', label: 'OAuth redirect URIs locked to app scheme + Supabase callback allowlist' },
  { id: 'storage', label: 'Storage buckets private by default; signed URLs with short TTL for media' },
  { id: 'deps', label: 'Automated dependency updates + lockfile integrity on CI' },
  { id: 'mfa', label: 'Optional MFA for admin / creator accounts (Supabase Auth)' },
  { id: 'pinning', label: 'Consider SSL pinning for high-risk APIs (tradeoffs on Expo)' },
] as const;
