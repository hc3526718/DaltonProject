import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  getScreenshotEventById,
  getScreenshotOfferPageById,
  getScreenshotSampleCommunityPosts,
  getScreenshotSampleEvents,
  getScreenshotSampleMediaAssets,
  getScreenshotSampleOfferPages,
  mergeScreenshotCommunityPosts,
  mergeScreenshotEvents,
  mergeScreenshotMedia,
  mergeScreenshotSubscriptionPages,
  isScreenshotSampleEventId,
  isScreenshotSampleMediaId,
  isScreenshotSampleOfferPageId,
} from '../data/appStoreScreenshotSamples';
import { formatAuthorDisplayName } from '../lib/communityPostBody';
import { isAppStoreScreenshotMode } from '../lib/env';
import { getSupabase } from '../lib/supabase';
import type {
  EventReviewRow,
  EventRow,
  MediaAssetRow,
  PostRow,
  ProfileRow,
  SubscriptionOfferPageRow,
} from './types';

type Unsub = () => void;

function noopChannel(): Unsub {
  return () => undefined;
}

/** Post row plus author fields for community feed UI. */
export type CommunityPostFeedRow = PostRow & {
  author_display_name: string | null;
  author_avatar_url: string | null;
  /** Post media (resolved from `media_assets.post_id`) */
  attachments?: { kind: 'image' | 'video' | 'file'; uri: string; name?: string }[];
};

async function attachMediaForPosts(rows: CommunityPostFeedRow[]): Promise<CommunityPostFeedRow[]> {
  const supabase = getSupabase();
  if (!supabase) return rows;
  const postIds = [...new Set(rows.map((r) => r.id))];
  if (postIds.length === 0) return rows;
  const { data, error } = await supabase
    .from('media_assets')
    .select('kind, public_url, post_id, created_at')
    .in('post_id', postIds)
    .order('created_at', { ascending: true });
  if (error) {
    if (__DEV__) console.warn('[attachMediaForPosts]', error.message);
    return rows;
  }
  const assets = (data ?? []) as { kind: MediaAssetRow['kind']; public_url: string | null; post_id: string | null }[];
  const map = new Map<string, { kind: 'image' | 'video' | 'file'; uri: string }[]>();
  for (const a of assets) {
    if (!a.post_id) continue;
    const uri = a.public_url?.trim() || '';
    if (!uri) continue;
    const kind = a.kind === 'video' ? 'video' : a.kind === 'file' ? 'file' : 'image';
    const prev = map.get(a.post_id) ?? [];
    prev.push({ kind, uri });
    map.set(a.post_id, prev);
  }
  return rows.map((r) => ({ ...r, attachments: map.get(r.id) ?? [] }));
}

export type CommunityPostChange =
  | { event: 'INSERT' | 'UPDATE'; row: PostRow }
  | { event: 'DELETE'; id: string };

/** Subscribe to `public.posts` changes. Enable Realtime for `posts` in Supabase → Database → Replication. */
export function subscribeCommunityPosts(onPayload: (change: CommunityPostChange) => void): Unsub {
  const supabase = getSupabase();
  if (!supabase) return noopChannel();
  const channel: RealtimeChannel = supabase
    .channel('roadmap-posts')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'posts' },
      (p) => {
        const ev = p.eventType;
        if (ev === 'DELETE') {
          const old = p.old;
          const id = old && typeof old === 'object' && 'id' in old ? String((old as { id: string }).id) : '';
          if (id) onPayload({ event: 'DELETE', id });
          return;
        }
        if ((ev === 'INSERT' || ev === 'UPDATE') && p.new && typeof p.new === 'object') {
          onPayload({ event: ev, row: p.new as PostRow });
        }
      },
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export function subscribeEventsFeed(onPayload: (row: EventRow) => void): Unsub {
  const supabase = getSupabase();
  if (!supabase) return noopChannel();
  const channel = supabase
    .channel('roadmap-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      (p) => {
        if (p.new && typeof p.new === 'object') onPayload(p.new as EventRow);
      },
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export function subscribeMediaAssetsForOwner(ownerId: string, onPayload: (row: MediaAssetRow) => void): Unsub {
  const supabase = getSupabase();
  if (!supabase) return noopChannel();
  const channel = supabase
    .channel(`roadmap-media-${ownerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'media_assets', filter: `owner_id=eq.${ownerId}` },
      (p) => {
        if (p.new && typeof p.new === 'object') onPayload(p.new as MediaAssetRow);
      },
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export async function listRecentPosts(limit = 30): Promise<PostRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as PostRow[];
}

export async function enrichPostWithAuthor(row: PostRow): Promise<CommunityPostFeedRow> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ...row, author_display_name: null, author_avatar_url: null, attachments: [] };
  }
  const { data } = await supabase
    .from('profiles')
    .select('display_name, first_name, last_name, username, avatar_url')
    .eq('id', row.author_id)
    .maybeSingle();
  const withAuthor: CommunityPostFeedRow = {
    ...row,
    author_display_name: data
      ? formatAuthorDisplayName({
          display_name: data.display_name,
          first_name: data.first_name,
          last_name: data.last_name,
              username: (data as any).username,
        })
      : null,
    author_avatar_url: data?.avatar_url ?? null,
  };
  const [withMedia] = await attachMediaForPosts([withAuthor]);
  return withMedia ?? { ...withAuthor, attachments: [] };
}

export async function listRecentCommunityPosts(limit = 30): Promise<CommunityPostFeedRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return isAppStoreScreenshotMode()
      ? (getScreenshotSampleCommunityPosts() as CommunityPostFeedRow[]).slice(0, limit)
      : [];
  }
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  if (!posts?.length) {
    if (isAppStoreScreenshotMode()) {
      return (getScreenshotSampleCommunityPosts() as CommunityPostFeedRow[]).slice(0, limit);
    }
    return [];
  }
  const rows = posts as PostRow[];
  const authorIds = [...new Set(rows.map((p) => p.author_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, username, avatar_url')
    .in('id', authorIds);
  type Prof = {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username?: string | null;
    avatar_url: string | null;
  };
  const map = new Map(
    (profs ?? []).map((r: Prof) => [
      r.id,
      {
        display_name: formatAuthorDisplayName({
          display_name: r.display_name,
          first_name: r.first_name,
          last_name: r.last_name,
          username: (r as any).username,
        }),
        avatar_url: r.avatar_url,
      },
    ]),
  );
  const withAuthors = rows.map((p) => {
    const pr = map.get(p.author_id);
    return {
      ...p,
      author_display_name: pr?.display_name ?? null,
      author_avatar_url: pr?.avatar_url ?? null,
    };
  });
  const withMedia = await attachMediaForPosts(withAuthors);
  if (!isAppStoreScreenshotMode()) return withMedia;
  return (mergeScreenshotCommunityPosts(withMedia) as CommunityPostFeedRow[]).slice(0, limit);
}

export async function insertCommunityPost(
  authorId: string,
  body: string,
): Promise<{ row: PostRow } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Not connected.' };
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Caption is required.' };
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, body: trimmed })
    .select('*')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not create post.' };
  return { row: data as PostRow };
}

/** Deletes a post (RLS: author or master — see migrations 003 + 008). */
export async function deleteCommunityPost(postId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  // PostgREST often returns `{ error: null }` when RLS denies delete (0 rows);
  // only treat delete as successful when we get a returning row back.
  const { data, error } = await supabase.from('posts').delete().eq('id', postId).select('id');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Full-text-ish search on post body (live Supabase). */
export async function searchCommunityPosts(query: string, limit = 40): Promise<CommunityPostFeedRow[]> {
  const supabase = getSupabase();
  const q = query.trim();
  if (!q) return [];
  if (!supabase) {
    if (!isAppStoreScreenshotMode()) return [];
    const samples = getScreenshotSampleCommunityPosts() as CommunityPostFeedRow[];
    const qLower = q.toLowerCase();
    return samples.filter((row) => (row.body ?? '').toLowerCase().includes(qLower)).slice(0, limit);
  }
  const pattern = `%${escapeIlike(q)}%`;
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .ilike('body', pattern)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  const qLower = q.toLowerCase();
  if (!posts?.length) {
    if (!isAppStoreScreenshotMode()) return [];
    const samples = getScreenshotSampleCommunityPosts() as CommunityPostFeedRow[];
    return samples.filter((row) => (row.body ?? '').toLowerCase().includes(qLower)).slice(0, limit);
  }
  const rows = posts as PostRow[];
  const authorIds = [...new Set(rows.map((p) => p.author_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, username, avatar_url')
    .in('id', authorIds);
  type Prof = {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username?: string | null;
    avatar_url: string | null;
  };
  const map = new Map(
    (profs ?? []).map((r: Prof) => [
      r.id,
      {
        display_name: formatAuthorDisplayName({
          display_name: r.display_name,
          first_name: r.first_name,
          last_name: r.last_name,
          username: (r as Prof).username,
        }),
        avatar_url: r.avatar_url,
      },
    ]),
  );
  const withAuthors = rows.map((p) => {
    const pr = map.get(p.author_id);
    return {
      ...p,
      author_display_name: pr?.display_name ?? null,
      author_avatar_url: pr?.avatar_url ?? null,
    };
  });
  const withMedia = await attachMediaForPosts(withAuthors);
  if (!isAppStoreScreenshotMode()) return withMedia;
  const merged = mergeScreenshotCommunityPosts(withMedia) as CommunityPostFeedRow[];
  return merged.filter((row) => (row.body ?? '').toLowerCase().includes(qLower)).slice(0, limit);
}

export type CommunityUserSearchRow = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

/** Search profiles by username or display name (strip leading @). */
export async function searchCommunityUsers(
  query: string,
  limit = 25,
): Promise<CommunityUserSearchRow[]> {
  const supabase = getSupabase();
  const q = query.trim().replace(/^@+/, '');
  if (!q) return [];
  if (!supabase) return [];
  const pattern = `%${escapeIlike(q)}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, first_name, last_name, avatar_url')
    .or(
      `username.ilike.${pattern},display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
    )
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    display_name: formatAuthorDisplayName({
      display_name: row.display_name as string | null,
      first_name: row.first_name as string | null,
      last_name: row.last_name as string | null,
      username: row.username as string | null,
    }),
    username: typeof row.username === 'string' ? row.username.trim() || null : null,
    avatar_url: (row.avatar_url as string | null) ?? null,
  }));
}

export async function getEventsByIds(ids: string[]): Promise<Map<string, Pick<EventRow, 'id' | 'title'>>> {
  const out = new Map<string, Pick<EventRow, 'id' | 'title'>>();
  if (isAppStoreScreenshotMode()) {
    for (const id of ids) {
      const ev = getScreenshotEventById(id);
      if (ev) out.set(id, { id: ev.id, title: ev.title });
    }
  }
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return out;
  const unique = [...new Set(ids)];
  const { data, error } = await supabase.from('events').select('id, title').in('id', unique);
  if (error || !data) return out;
  for (const row of data as { id: string; title: string }[]) {
    out.set(row.id, { id: row.id, title: row.title });
  }
  return out;
}

export async function listUpcomingEvents(limit = 30): Promise<EventRow[]> {
  const sortAsc = (rows: EventRow[]) =>
    [...rows].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const supabase = getSupabase();
  if (!supabase) {
    return isAppStoreScreenshotMode() ? sortAsc(getScreenshotSampleEvents()).slice(0, limit) : [];
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error) return isAppStoreScreenshotMode() ? sortAsc(getScreenshotSampleEvents()).slice(0, limit) : [];
  const rows = (data ?? []) as EventRow[];
  const merged = isAppStoreScreenshotMode() ? mergeScreenshotEvents(rows) : rows;
  return sortAsc(merged).slice(0, limit);
}

/** All events for browse / filters (newest first — client can re-sort). */
export async function listAllEvents(limit = 80): Promise<EventRow[]> {
  const sortDesc = (rows: EventRow[]) =>
    [...rows].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const supabase = getSupabase();
  if (!supabase) {
    return isAppStoreScreenshotMode() ? sortDesc(getScreenshotSampleEvents()).slice(0, limit) : [];
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(limit);
  if (error) return isAppStoreScreenshotMode() ? sortDesc(getScreenshotSampleEvents()).slice(0, limit) : [];
  const rows = (data ?? []) as EventRow[];
  const merged = isAppStoreScreenshotMode() ? mergeScreenshotEvents(rows) : rows;
  return sortDesc(merged).slice(0, limit);
}

export async function getEventById(id: string): Promise<EventRow | null> {
  if (isAppStoreScreenshotMode()) {
    const sample = getScreenshotEventById(id);
    if (sample) return sample;
  }
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as EventRow;
}

export function subscribeEventById(eventId: string, onChange: () => void): Unsub {
  const supabase = getSupabase();
  if (!supabase) return noopChannel();
  const channel: RealtimeChannel = supabase
    .channel(`event-row-${eventId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
      () => onChange(),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

/** Fan-out push to booked users after an event edit (in-app rows come from DB trigger). */
export async function invokeNotifyEventAttendees(eventId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.functions.invoke('notify-event-attendees', { body: { event_id: eventId } });
  } catch {
    /* non-fatal */
  }
}

export type InsertCommunityEventInput = {
  title: string;
  description: string;
  event_details?: Record<string, unknown> | null;
  starts_at: string;
  ends_at: string | null;
  venue?: string | null;
  hero_image_url?: string | null;
  requires_payment: boolean;
  stripe_price_id?: string | null;
  created_by: string;
  entry_payment_mode?: 'none' | 'payment_on_arrival' | 'internal_costs' | null;
  entry_payment_amount?: string | null;
  entry_payment_note?: string | null;
};

/** Host publish — requires `events_insert_authenticated` (and Dalton verification in app). */
export async function insertCommunityEvent(row: InsertCommunityEventInput): Promise<EventRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: row.title.trim(),
      description: row.description.trim() || null,
      event_details: row.event_details ?? null,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      venue: row.venue?.trim() || null,
      hero_image_url: row.hero_image_url?.trim() || null,
      requires_payment: row.requires_payment,
      stripe_price_id: row.stripe_price_id?.trim() || null,
      created_by: row.created_by,
      entry_payment_mode: row.entry_payment_mode ?? 'none',
      entry_payment_amount: row.entry_payment_amount?.trim() || null,
      entry_payment_note: row.entry_payment_note?.trim() || null,
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as EventRow;
}

export async function deleteCommunityEvent(eventId: string): Promise<boolean> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleEventId(eventId)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return !error;
}

export type UpdateCommunityEventInput = Partial<{
  title: string;
  description: string;
  event_details: Record<string, unknown> | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  hero_image_url: string | null;
  entry_payment_mode: 'none' | 'payment_on_arrival' | 'internal_costs' | null;
  entry_payment_amount: string | null;
  entry_payment_note: string | null;
}>;

export async function updateCommunityEvent(
  eventId: string,
  patch: UpdateCommunityEventInput,
): Promise<EventRow | null> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleEventId(eventId)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('events')
    .update({
      ...(patch.title != null ? { title: patch.title.trim() } : {}),
      ...(patch.description != null ? { description: patch.description.trim() || null } : {}),
      ...(patch.event_details !== undefined ? { event_details: patch.event_details } : {}),
      ...(patch.starts_at != null ? { starts_at: patch.starts_at } : {}),
      ...(patch.ends_at !== undefined ? { ends_at: patch.ends_at } : {}),
      ...(patch.venue !== undefined ? { venue: patch.venue?.trim() || null } : {}),
      ...(patch.hero_image_url !== undefined ? { hero_image_url: patch.hero_image_url?.trim() || null } : {}),
      ...(patch.entry_payment_mode !== undefined ? { entry_payment_mode: patch.entry_payment_mode ?? 'none' } : {}),
      ...(patch.entry_payment_amount !== undefined ? { entry_payment_amount: patch.entry_payment_amount?.trim() || null } : {}),
      ...(patch.entry_payment_note !== undefined ? { entry_payment_note: patch.entry_payment_note?.trim() || null } : {}),
    })
    .eq('id', eventId)
    .select()
    .single();
  if (error || !data) return null;
  return data as EventRow;
}

export async function listSubscriptionOfferPages(limit = 100): Promise<SubscriptionOfferPageRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return isAppStoreScreenshotMode() ? getScreenshotSampleOfferPages().slice(0, limit) : [];
  }
  const { data, error } = await supabase
    .from('subscription_offer_pages')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error) {
    return isAppStoreScreenshotMode() ? getScreenshotSampleOfferPages().slice(0, limit) : [];
  }
  const rows = (data ?? []) as SubscriptionOfferPageRow[];
  if (!isAppStoreScreenshotMode()) return rows;
  return mergeScreenshotSubscriptionPages(rows).slice(0, limit);
}

export async function getSubscriptionOfferPageById(id: string): Promise<SubscriptionOfferPageRow | null> {
  if (isAppStoreScreenshotMode()) {
    const sample = getScreenshotOfferPageById(id);
    if (sample) return sample;
  }
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('subscription_offer_pages')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as SubscriptionOfferPageRow;
}

export type InsertSubscriptionOfferPageInput = {
  created_by: string;
  business_name: string;
  description?: string | null;
  hero_image_url?: string | null;
  video_url?: string | null;
  website_url?: string | null;
  social_links?: unknown;
};

export async function insertSubscriptionOfferPage(
  row: InsertSubscriptionOfferPageInput,
): Promise<SubscriptionOfferPageRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('subscription_offer_pages')
    .insert({
      created_by: row.created_by,
      business_name: row.business_name.trim(),
      description: row.description?.trim() || null,
      hero_image_url: row.hero_image_url?.trim() || null,
      video_url: row.video_url?.trim() || null,
      website_url: row.website_url?.trim() || null,
      social_links: row.social_links ?? [],
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as SubscriptionOfferPageRow;
}

export async function deleteSubscriptionOfferPage(id: string): Promise<boolean> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleOfferPageId(id)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('subscription_offer_pages').delete().eq('id', id);
  return !error;
}

export type UpdateSubscriptionOfferPagePatch = Partial<
  Pick<
    SubscriptionOfferPageRow,
    'business_name' | 'description' | 'hero_image_url' | 'video_url' | 'website_url' | 'social_links'
  >
>;

export async function updateSubscriptionOfferPage(
  id: string,
  patch: UpdateSubscriptionOfferPagePatch,
): Promise<SubscriptionOfferPageRow | null> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleOfferPageId(id)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('subscription_offer_pages')
    .update({
      ...(patch.business_name !== undefined ? { business_name: patch.business_name?.trim() || '' } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.hero_image_url !== undefined ? { hero_image_url: patch.hero_image_url?.trim() || null } : {}),
      ...(patch.video_url !== undefined ? { video_url: patch.video_url?.trim() || null } : {}),
      ...(patch.website_url !== undefined ? { website_url: patch.website_url?.trim() || null } : {}),
      ...(patch.social_links !== undefined ? { social_links: patch.social_links ?? [] } : {}),
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) return null;
  return data as SubscriptionOfferPageRow;
}

export async function getMediaAssetById(assetId: string): Promise<MediaAssetRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('media_assets').select('*').eq('id', assetId).maybeSingle();
  if (error || !data) return null;
  return data as MediaAssetRow;
}

export async function deleteMediaAsset(assetId: string): Promise<boolean> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleMediaId(assetId)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('media_assets').delete().eq('id', assetId);
  return !error;
}

export type UpdateMediaAssetPatch = Partial<
  Pick<
    MediaAssetRow,
    | 'title'
    | 'description'
    | 'tags'
    | 'thumbnail_url'
    | 'public_url'
    | 'mime_type'
    | 'kind'
    | 'series_title'
    | 'series_part'
    | 'featured_series'
  >
>;

export async function updateMediaAsset(assetId: string, patch: UpdateMediaAssetPatch): Promise<MediaAssetRow | null> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleMediaId(assetId)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('media_assets')
    .update({
      ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.tags !== undefined ? { tags: Array.isArray(patch.tags) ? patch.tags : [] } : {}),
      ...(patch.thumbnail_url !== undefined ? { thumbnail_url: patch.thumbnail_url?.trim() || null } : {}),
      ...(patch.public_url !== undefined ? { public_url: patch.public_url?.trim() || null } : {}),
      ...(patch.mime_type !== undefined ? { mime_type: patch.mime_type?.trim() || null } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.series_title !== undefined ? { series_title: patch.series_title?.trim() || null } : {}),
      ...(patch.series_part !== undefined
        ? { series_part: patch.series_part != null ? patch.series_part : null }
        : {}),
      ...(patch.featured_series !== undefined ? { featured_series: !!patch.featured_series } : {}),
    })
    .eq('id', assetId)
    .select()
    .single();
  if (error || !data) return null;
  return data as MediaAssetRow;
}

export type MediaSeriesOption = {
  seriesTitle: string;
  partCount: number;
  featured: boolean;
};

/** Distinct series titles for master featured-series picker. */
export async function listMediaSeriesOptions(): Promise<{
  options: MediaSeriesOption[];
  featuredSeriesTitle: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { options: [], featuredSeriesTitle: null };
  const { data, error } = await supabase
    .from('media_assets')
    .select('series_title, series_part, featured_series')
    .is('post_id', null)
    .not('series_title', 'is', null);
  if (error || !data?.length) return { options: [], featuredSeriesTitle: null };

  const byTitle = new Map<string, { count: number; featured: boolean }>();
  let featuredSeriesTitle: string | null = null;
  for (const row of data as Pick<MediaAssetRow, 'series_title' | 'featured_series'>[]) {
    const t = row.series_title?.trim();
    if (!t) continue;
    const cur = byTitle.get(t) ?? { count: 0, featured: false };
    cur.count += 1;
    if (row.featured_series) {
      cur.featured = true;
      featuredSeriesTitle = t;
    }
    byTitle.set(t, cur);
  }
  const options = [...byTitle.entries()]
    .map(([seriesTitle, v]) => ({
      seriesTitle,
      partCount: v.count,
      featured: v.featured,
    }))
    .sort((a, b) => a.seriesTitle.localeCompare(b.seriesTitle));
  return { options, featuredSeriesTitle };
}

/** Mark one series as featured (clears others). Pass null to clear featured hero. */
export async function setFeaturedMediaSeries(seriesTitle: string | null): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  await supabase.from('media_assets').update({ featured_series: false }).eq('featured_series', true);
  const title = seriesTitle?.trim();
  if (!title) return true;
  const { data: parts } = await supabase
    .from('media_assets')
    .select('id, series_part')
    .eq('series_title', title)
    .order('series_part', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1);
  const headId = (parts?.[0] as { id?: string } | undefined)?.id;
  if (!headId) return false;
  const { error } = await supabase
    .from('media_assets')
    .update({ featured_series: true })
    .eq('id', headId);
  return !error;
}

/** Other videos in the same series (ordered), excluding current id. */
export async function listMediaInSeries(
  seriesTitle: string,
  excludeMediaId?: string,
  limit = 12,
): Promise<MediaAssetRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const title = seriesTitle.trim();
  if (!title) return [];
  let q = supabase
    .from('media_assets')
    .select('*')
    .is('post_id', null)
    .eq('series_title', title)
    .order('series_part', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (excludeMediaId) q = q.neq('id', excludeMediaId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MediaAssetRow[];
}

/** Head video for the featured series hero, if configured. */
export async function getFeaturedSeriesHead(): Promise<MediaAssetRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .is('post_id', null)
    .eq('featured_series', true)
    .order('series_part', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as MediaAssetRow;
}

/** Latest media visible under RLS (public + own + master). */
export async function listBrowseMediaAssets(limit = 80): Promise<MediaAssetRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return isAppStoreScreenshotMode() ? getScreenshotSampleMediaAssets().slice(0, limit) : [];
  }
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .is('post_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    return isAppStoreScreenshotMode() ? getScreenshotSampleMediaAssets().slice(0, limit) : [];
  }
  const rows = ((data ?? []) as MediaAssetRow[]).filter((r) => !r.post_id);
  if (!isAppStoreScreenshotMode()) return rows;
  return mergeScreenshotMedia(rows).slice(0, limit);
}

export async function listProfilesBrief(
  limit = 200,
): Promise<Pick<ProfileRow, 'id' | 'display_name' | 'avatar_url'>[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .order('id', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Pick<ProfileRow, 'id' | 'display_name' | 'avatar_url'>[];
}

export type BookingWithEvent = {
  bookingId: string;
  reference: string;
  userId: string;
  eventId: string;
  checkedInAt: string | null;
  event: EventRow | null;
};

export async function findUserBookingForEvent(
  userId: string,
  eventId: string,
): Promise<BookingWithEvent | null> {
  const rows = await listBookingsWithEventsForUser(userId);
  return rows.find((b) => b.eventId === eventId) ?? null;
}

export async function listBookingsWithEventsForUser(userId: string): Promise<BookingWithEvent[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: bk, error } = await supabase
    .from('bookings')
    .select('id, reference, user_id, event_id, checked_in_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !bk?.length) return [];

  const eventIds = [...new Set((bk as { event_id: string }[]).map((b) => b.event_id))];
  const { data: events } = await supabase.from('events').select('*').in('id', eventIds);
  const evMap = new Map((events as EventRow[] | null)?.map((e) => [e.id, e]) ?? []);

  return (bk as { id: string; reference: string; user_id: string; event_id: string; checked_in_at: string | null }[]).map(
    (r) => ({
      bookingId: r.id,
      reference: r.reference,
      userId: r.user_id,
      eventId: r.event_id,
      checkedInAt: r.checked_in_at,
      event: evMap.get(r.event_id) ?? null,
    }),
  );
}

export async function hostCheckInByReference(reference: string): Promise<{
  ok: boolean;
  reason?: string;
  alreadyCheckedIn?: boolean;
  eventTitle?: string;
  eventId?: string;
  attendeeUserId?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'no_client' };
  const { data, error } = await supabase.rpc('host_check_in_booking', {
    p_reference: reference.trim(),
  });
  if (error) return { ok: false, reason: error.message };
  const j = data as Record<string, unknown> | null;
  if (!j || j.ok !== true) {
    return { ok: false, reason: String(j?.reason ?? 'rpc_failed') };
  }
  return {
    ok: true,
    alreadyCheckedIn: j.already_checked_in === true,
    eventTitle: typeof j.title === 'string' ? j.title : undefined,
    eventId: typeof j.event_id === 'string' ? j.event_id : undefined,
    attendeeUserId: typeof j.user_id === 'string' ? j.user_id : undefined,
  };
}

function parseScheduleLineToParts(scheduleLine: string): { datePart: string; timeStart: string } {
  const sep = ' • ';
  const i = scheduleLine.indexOf(sep);
  const datePart = (i === -1 ? scheduleLine : scheduleLine.slice(0, i)).trim() || new Date().toDateString();
  const rest = i === -1 ? '10:00 AM' : scheduleLine.slice(i + sep.length).trim();
  const timeStart = rest.split('-')[0]?.trim() || '10:00 AM';
  return { datePart, timeStart };
}

function parseEventStartsAtIso(scheduleLine: string): string {
  const { datePart, timeStart } = parseScheduleLineToParts(scheduleLine);
  const d = new Date(`${datePart} ${timeStart}`);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback.toISOString();
}

function newBookingReference(): string {
  const p1 = Math.random().toString(36).slice(2, 8).toUpperCase();
  const p2 = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DG-${p1}-${p2}`;
}

/**
 * Creates an `events` row from the attendee UI flow plus a `bookings` row.
 * Host-authored events can supersede this later (pass `event_id` only).
 */
export async function createEventAndBooking(
  userId: string,
  opts: {
    title: string;
    scheduleLine: string;
    heroImageUrl?: string | null;
    venue?: string | null;
  },
): Promise<{ reference: string; eventId: string; bookingId: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const starts_at = parseEventStartsAtIso(opts.scheduleLine);
  const { data: ev, error: evErr } = await supabase
    .from('events')
    .insert({
      created_by: userId,
      title: opts.title.trim().slice(0, 500) || 'Event',
      starts_at,
      venue: (opts.venue?.trim() || 'TBA').slice(0, 500),
      hero_image_url: opts.heroImageUrl?.trim() || null,
    })
    .select('id')
    .single();
  if (evErr || !ev?.id) return null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const reference = newBookingReference();
    const { data: bk, error: bkErr } = await supabase
      .from('bookings')
      .insert({
        event_id: ev.id,
        user_id: userId,
        reference,
      })
      .select('id, reference')
      .single();
    if (!bkErr && bk?.id && bk.reference) {
      return { reference: bk.reference, eventId: ev.id, bookingId: bk.id };
    }
    const msg = bkErr?.message ?? '';
    if (!msg.toLowerCase().includes('unique') && !msg.toLowerCase().includes('duplicate')) break;
  }
  return null;
}

/** Book an existing published event (does not create a duplicate event row). */
export async function bookExistingEvent(
  userId: string,
  eventId: string,
): Promise<{ reference: string; eventId: string; bookingId: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const reference = newBookingReference();
    const { data: bk, error: bkErr } = await supabase
      .from('bookings')
      .insert({
        event_id: eventId,
        user_id: userId,
        reference,
      })
      .select('id, reference')
      .single();
    if (!bkErr && bk?.id && bk.reference) {
      return { reference: bk.reference, eventId, bookingId: bk.id };
    }
    const msg = bkErr?.message ?? '';
    if (!msg.toLowerCase().includes('unique') && !msg.toLowerCase().includes('duplicate')) break;
  }
  return null;
}

export type HostEventDashboardRow = {
  eventId: string;
  title: string;
  startsAt: string;
  bookingCount: number;
  checkedInCount: number;
};

/** Events created by host with booking totals. */
export async function listHostEventDashboard(userId: string): Promise<HostEventDashboardRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: evs } = await supabase
    .from('events')
    .select('id, title, starts_at')
    .eq('created_by', userId)
    .order('starts_at', { ascending: false })
    .limit(40);
  if (!evs?.length) return [];
  const eventIds = (evs as { id: string }[]).map((e) => e.id);
  const { data: bks } = await supabase
    .from('bookings')
    .select('event_id, checked_in_at')
    .in('event_id', eventIds);
  const counts = new Map<string, { total: number; checked: number }>();
  for (const id of eventIds) counts.set(id, { total: 0, checked: 0 });
  for (const b of (bks ?? []) as { event_id: string; checked_in_at: string | null }[]) {
    const c = counts.get(b.event_id);
    if (!c) continue;
    c.total += 1;
    if (b.checked_in_at) c.checked += 1;
  }
  return (evs as { id: string; title: string; starts_at: string }[]).map((e) => {
    const c = counts.get(e.id) ?? { total: 0, checked: 0 };
    return {
      eventId: e.id,
      title: e.title,
      startsAt: e.starts_at,
      bookingCount: c.total,
      checkedInCount: c.checked,
    };
  });
}

export type HostBookingRosterRow = {
  bookingId: string;
  reference: string;
  userId: string;
  checkedInAt: string | null;
  attendeeDisplayName: string;
};

function attendeeNameFromProfile(
  p: Pick<ProfileRow, 'display_name' | 'first_name' | 'last_name'>,
): string {
  const d = p.display_name?.trim();
  if (d) return d;
  const parts = [p.first_name?.trim(), p.last_name?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return 'Member';
}

/** Bookings for an event roster (requires host SELECT policy — see migration 031). */
export async function listBookingsForEventHost(eventId: string): Promise<HostBookingRosterRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: bks, error } = await supabase
    .from('bookings')
    .select('id, reference, user_id, checked_in_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error || !bks?.length) return [];

  const userIds = [...new Set((bks as { user_id: string }[]).map((b) => b.user_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name')
    .in('id', userIds);
  const nameBy = new Map<string, string>();
  for (const pr of (profs ?? []) as (Pick<ProfileRow, 'id' | 'display_name' | 'first_name' | 'last_name'>)[]) {
    nameBy.set(pr.id, attendeeNameFromProfile(pr));
  }

  return (bks as { id: string; reference: string; user_id: string; checked_in_at: string | null }[]).map((b) => ({
    bookingId: b.id,
    reference: b.reference,
    userId: b.user_id,
    checkedInAt: b.checked_in_at,
    attendeeDisplayName: nameBy.get(b.user_id) ?? 'Member',
  }));
}

export function subscribeBookingsForEvent(eventId: string, onChange: () => void): Unsub {
  const supabase = getSupabase();
  if (!supabase) return noopChannel();
  const channel: RealtimeChannel = supabase
    .channel(`bookings-for-event-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings', filter: `event_id=eq.${eventId}` },
      () => onChange(),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export async function listEventReviewsForHost(eventId: string): Promise<EventReviewRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('event_reviews')
    .select('id, event_id, user_id, rating, comment, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as EventReviewRow[];
}

export async function fetchMyEventReview(eventId: string, userId: string): Promise<EventReviewRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('event_reviews')
    .select('id, event_id, user_id, rating, comment, created_at')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EventReviewRow;
}

export async function upsertEventReview(
  eventId: string,
  userId: string,
  rating: number,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'no_client' };
  const trimmed = comment.trim().slice(0, 2000);
  const { error } = await supabase.from('event_reviews').upsert(
    {
      event_id: eventId,
      user_id: userId,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      comment: trimmed.length > 0 ? trimmed : null,
    },
    { onConflict: 'event_id,user_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Live updates when host checks in this booking (Realtime on `bookings`). */
export function subscribeBookingByReference(reference: string, onChange: () => void): Unsub {
  const supabase = getSupabase();
  if (!supabase) return noopChannel();
  const trimmed = reference.trim();
  if (!trimmed) return noopChannel();
  const channel: RealtimeChannel = supabase
    .channel(`booking-ref-${trimmed}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `reference=eq.${trimmed}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
