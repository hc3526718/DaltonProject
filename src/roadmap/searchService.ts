import { getSupabase } from '../lib/supabase';
import type { EventRow, PostRow } from './types';

/** Full-text / ilike search — replace with `pg_trgm` or `tsvector` RPC when indexes exist. */
export async function searchPosts(query: string, limit = 25): Promise<PostRow[]> {
  const q = query.trim().replace(/%/g, '');
  if (!q) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .ilike('body', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as PostRow[];
}

export async function searchEvents(query: string, limit = 25): Promise<EventRow[]> {
  const q = query.trim().replace(/%/g, '');
  if (!q) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .or(`title.ilike.%${q}%,venue.ilike.%${q}%`)
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as EventRow[];
}
