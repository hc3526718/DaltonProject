import { getSupabase } from '../lib/supabase';

export type FollowRequestRow = {
  id: string;
  requester_id: string;
  target_id: string;
  status: string;
  created_at: string;
};

export type FollowRequestWithProfile = FollowRequestRow & {
  requester_display_name: string | null;
  requester_avatar_url: string | null;
};

async function enrichRequesters(rows: FollowRequestRow[]): Promise<FollowRequestWithProfile[]> {
  if (!rows.length) return [];
  const supabase = getSupabase();
  if (!supabase) return rows.map((r) => ({ ...r, requester_display_name: null, requester_avatar_url: null }));
  const ids = [...new Set(rows.map((x) => x.requester_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);
  const map = new Map(
    (profs ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [
      p.id,
      p,
    ]),
  );
  return rows.map((r) => {
    const p = map.get(r.requester_id);
    return {
      ...r,
      requester_display_name: p?.display_name ?? null,
      requester_avatar_url: p?.avatar_url ?? null,
    };
  });
}

export async function listIncomingFollowRequests(userId: string): Promise<FollowRequestWithProfile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('follow_requests')
    .select('*')
    .eq('target_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return enrichRequesters(data as FollowRequestRow[]);
}

export async function listOutgoingFollowRequests(userId: string): Promise<FollowRequestRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('follow_requests')
    .select('*')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as FollowRequestRow[];
}

export async function sendFollowRequest(requesterUserId: string, targetUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || requesterUserId === targetUserId) return false;
  const { error } = await supabase.from('follow_requests').insert({
    requester_id: requesterUserId,
    target_id: targetUserId,
  });
  return !error;
}

export async function acceptFollowRequest(requestId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc('accept_follow_request', { p_request_id: requestId });
  return !error;
}

export async function rejectFollowRequest(requestId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc('reject_follow_request', { p_request_id: requestId });
  return !error;
}

export async function cancelFollowRequest(requestId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc('cancel_follow_request', { p_request_id: requestId });
  return !error;
}

export async function getFollowCounts(
  profileUserId: string,
): Promise<{ followers: number; following: number }> {
  const supabase = getSupabase();
  if (!supabase) return { followers: 0, following: 0 };
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', profileUserId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileUserId),
  ]);
  return { followers: followerCount ?? 0, following: followingCount ?? 0 };
}

export async function isUserFollowing(viewerId: string, targetUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || viewerId === targetUserId) return false;
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('followee_id', targetUserId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/** Inserts an accepted follow edge (RLS: follower must be auth.uid()). */
export async function followUserDirect(viewerId: string, targetUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || viewerId === targetUserId) return false;
  const { error } = await supabase.from('follows').insert({
    follower_id: viewerId,
    followee_id: targetUserId,
  });
  return !error;
}

export async function unfollowUserDirect(viewerId: string, targetUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', viewerId)
    .eq('followee_id', targetUserId);
  return !error;
}

export type FollowListMember = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export async function listFollowersProfiles(profileUserId: string): Promise<FollowListMember[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: edges, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', profileUserId);
  if (error || !edges?.length) return [];
  const ids = [...new Set(edges.map((e: { follower_id: string }) => e.follower_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, username, avatar_url')
    .in('id', ids);
  return (profs ?? []) as FollowListMember[];
}

export async function listFollowingProfiles(profileUserId: string): Promise<FollowListMember[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: edges, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', profileUserId);
  if (error || !edges?.length) return [];
  const ids = [...new Set(edges.map((e: { followee_id: string }) => e.followee_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, username, avatar_url')
    .in('id', ids);
  return (profs ?? []) as FollowListMember[];
}
