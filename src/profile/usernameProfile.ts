import type { SupabaseClient } from '@supabase/supabase-js';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Normalize typing to lowercase slug (letters, digits, underscore only). */
export function normalizeUsernameTyping(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function isValidUsernameFormat(normalized: string): boolean {
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) return false;
  return /^[a-z0-9_]+$/.test(normalized);
}

export function slugifyFirstNameForUsername(firstName: string): string {
  const base = firstName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const shortened = base.slice(0, Math.max(1, USERNAME_MAX - 4));
  return shortened || 'user';
}

/** Four-digit suffix for auto-assigned usernames. */
export function randomFourDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function checkUsernameAvailable(
  supabase: SupabaseClient,
  normalizedUsername: string,
  excludeUserId: string,
): Promise<boolean> {
  if (!isValidUsernameFormat(normalizedUsername)) return false;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalizedUsername)
    .neq('id', excludeUserId)
    .maybeSingle();
  return !data;
}

/**
 * Try username = slug(firstName) + 4 random digits until unique (collision-safe).
 */
export async function allocateAutoUsername(
  supabase: SupabaseClient,
  firstName: string,
  excludeUserId: string,
): Promise<string> {
  const slug = slugifyFirstNameForUsername(firstName);
  const suffixLen = 4;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const suffix = randomFourDigits();
    const maxBase = USERNAME_MAX - suffixLen;
    let base = slug.slice(0, maxBase);
    if (!base) base = 'user';
    base = base.slice(0, maxBase);
    const candidate = `${base}${suffix}`;
    if (!isValidUsernameFormat(candidate)) continue;
    const ok = await checkUsernameAvailable(supabase, candidate, excludeUserId);
    if (ok) return candidate;
  }
  throw new Error('Could not assign a unique username. Try again.');
}
