import { getSupabase } from '../lib/supabase';

const EMOJI = {
  fire: '🔥',
  clap: '👏',
  lightbulb: '💡',
} as const;

export type ReactionSummary = { emoji: string; count: number };

export async function getTopPostReactions(postId: string, limit = 3): Promise<ReactionSummary[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('post_reactions')
    .select('emoji')
    .eq('post_id', postId);
  if (error || !data?.length) return [];
  const counts = new Map<string, number>();
  for (const row of data as { emoji: string }[]) {
    const e = row.emoji;
    counts.set(e, (counts.get(e) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function setPostReaction(postId: string, userId: string, kind: keyof typeof EMOJI): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const emoji = EMOJI[kind];
  await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
  const { error } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, emoji });
  return !error;
}

export type PostCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_username: string | null;
  author_avatar_url: string | null;
};

export async function listPostComments(postId: string): Promise<PostCommentRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: comments, error } = await supabase
    .from('post_comments')
    .select('id, post_id, author_id, body, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error || !comments?.length) return [];
  const ids = [...new Set((comments as { author_id: string }[]).map((c) => c.author_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, username, avatar_url')
    .in('id', ids);
  type Prof = {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username?: string | null;
    avatar_url: string | null;
  };
  const map = new Map(
    (profs ?? []).map((p: Prof) => [
      p.id,
      {
        username: p.username?.trim() ? `@${p.username.trim()}` : null,
        avatar_url: p.avatar_url,
      },
    ]),
  );
  return (comments as { id: string; post_id: string; author_id: string; body: string; created_at: string }[]).map(
    (c) => {
      const pr = map.get(c.author_id);
      return {
        ...c,
        author_username: pr?.username ?? null,
        author_avatar_url: pr?.avatar_url ?? null,
      };
    },
  );
}

export async function addPostComment(postId: string, authorId: string, body: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const trimmed = body.trim();
  if (!trimmed) return false;
  const { error } = await supabase.from('post_comments').insert({
    post_id: postId,
    author_id: authorId,
    body: trimmed,
  });
  return !error;
}

export async function getPostLikeCount(postId: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (error || typeof count !== 'number') return 0;
  return count;
}

export async function getUserHasLikedPost(postId: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function likePost(postId: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  return !error;
}

export async function unlikePost(postId: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  return !error;
}

export async function getPostCommentCount(postId: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('post_comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (error || typeof count !== 'number') return 0;
  return count;
}

export type PostReportReason = 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'other';

export async function submitPostReport(
  postId: string,
  reporterId: string,
  reason: PostReportReason,
  details?: string | null,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('post_reports').insert({
    post_id: postId,
    reporter_id: reporterId,
    reason,
    details: details?.trim() || null,
  });
  return !error;
}

