import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './env';
import { supabaseAuthStorage } from './supabaseAuthStorage';

let client: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

/**
 * Shared Supabase client. Null when URL/key env is not configured.
 * Recreates the client if URL/key change (e.g. after Metro loads app config).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    client = null;
    cachedUrl = '';
    cachedKey = '';
    return null;
  }
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (client && (cachedUrl !== url || cachedKey !== key)) {
    client = null;
  }
  if (!client) {
    cachedUrl = url;
    cachedKey = key;
    client = createClient(url, key, {
      auth: {
        storage: supabaseAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Web OAuth callback is handled explicitly in oauthSupabase.ts (avoids double PKCE exchange).
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}
