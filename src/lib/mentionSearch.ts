import { getSupabase } from './supabase';

export type MentionCandidate = {
  id: string;
  name: string;
};

/** Search profiles for @mention suggestions (username or display name). */
export async function searchMentionableUsers(keyword: string): Promise<MentionCandidate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const q = keyword.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(12);

  if (error || !data) return [];

  return data.map((row) => {
    const name =
      (typeof row.username === 'string' && row.username.trim()) ||
      (typeof row.display_name === 'string' && row.display_name.trim()) ||
      'member';
    return { id: row.id as string, name };
  });
}
