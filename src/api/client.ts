import { getSupabase } from '../lib/supabase';
import { getApiBaseUrl } from '../lib/env';

export type ApiError = { status: number; body: string };

/**
 * Typed fetch to your backend. Requires EXPO_PUBLIC_API_BASE_URL.
 * Sends Supabase access_token when session exists.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set — configure your API base URL in .env',
    );
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
