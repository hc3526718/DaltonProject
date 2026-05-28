import {
  getScreenshotConversationIdForPeer,
  getScreenshotMessagesForConversation,
  isScreenshotSampleConversationId,
  isScreenshotSamplePeerId,
  mergeScreenshotConversationSummaries,
} from '../data/appStoreScreenshotSamples';
import { uploadMessageMedia } from '../lib/messageMediaUpload';
import type { ComposerMedia } from '../lib/mediaComposer';
import { isAppStoreScreenshotMode } from '../lib/env';
import { getSupabase } from '../lib/supabase';
import { fetchUserPrefsDoc, patchUserPrefsDoc } from './userSettingsService';
import type { ConversationRow, MessageRow } from './types';

export type ConversationSummary = {
  conversation_id: string;
  peer_user_id: string;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  last_body: string | null;
  last_at: string | null;
  /** Latest message author — used to badge only when someone else messaged you. */
  last_sender_id: string | null;
};

/** Requires `get_or_create_dm` in backend/rpc_get_or_create_dm.sql + conversation RLS. */
export async function getOrCreateConversationId(peerUserId: string): Promise<string | null> {
  if (isAppStoreScreenshotMode() && isScreenshotSamplePeerId(peerUserId)) {
    return getScreenshotConversationIdForPeer(peerUserId);
  }
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_or_create_dm', { other_user_id: peerUserId });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('dm_not_allowed')) return null;
    return null;
  }
  if (data == null) return null;
  return typeof data === 'string' ? data : String(data);
}

/** Surfaces server-side DM policy (`can_message_peer` RPC). */
export async function canMessagePeer(peerUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('can_message_peer', { other_user_id: peerUserId });
  if (error) return false;
  return data === true;
}

export async function listConversationSummaries(userId: string): Promise<ConversationSummary[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return isAppStoreScreenshotMode() ? mergeScreenshotConversationSummaries([]) : [];
  }
  const { data: mine, error: e1 } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);
  if (e1 || !mine?.length) {
    return isAppStoreScreenshotMode() ? mergeScreenshotConversationSummaries([]) : [];
  }
  const convIds = [...new Set(mine.map((m: { conversation_id: string }) => m.conversation_id))];
  const { data: allParts, error: e2 } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds);
  if (e2 || !allParts?.length) return [];

  const membersByConv = new Map<string, Set<string>>();
  for (const row of allParts as { conversation_id: string; user_id: string }[]) {
    if (!membersByConv.has(row.conversation_id)) membersByConv.set(row.conversation_id, new Set());
    membersByConv.get(row.conversation_id)!.add(row.user_id);
  }
  const peerByConv = new Map<string, string>();
  for (const [cid, users] of membersByConv) {
    if (users.size !== 2 || !users.has(userId)) continue;
    const [a, b] = [...users];
    peerByConv.set(cid, a === userId ? b : a);
  }

  const summaries: ConversationSummary[] = [];
  const peerIds = [...new Set(peerByConv.values())];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', peerIds);
  const profMap = new Map(
    (profs ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [
      p.id,
      p,
    ]),
  );

  const { data: msgs } = await supabase
    .from('messages')
    .select('conversation_id, body, created_at, sender_id')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })
    .limit(300);

  const lastByConv = new Map<
    string,
    { body: string | null; created_at: string; sender_id: string }
  >();
  for (const m of (msgs ?? []) as {
    conversation_id: string;
    body: string | null;
    created_at: string;
    sender_id: string;
  }[]) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, {
        body: m.body,
        created_at: m.created_at,
        sender_id: m.sender_id,
      });
    }
  }

  for (const [conversationId, peerId] of peerByConv) {
    const pr = profMap.get(peerId);
    const last = lastByConv.get(conversationId);
    summaries.push({
      conversation_id: conversationId,
      peer_user_id: peerId,
      peer_display_name: pr?.display_name ?? null,
      peer_avatar_url: pr?.avatar_url ?? null,
      last_body: last?.body ?? null,
      last_at: last?.created_at ?? null,
      last_sender_id: last?.sender_id ?? null,
    });
  }
  summaries.sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? ''));
  if (!isAppStoreScreenshotMode()) return summaries;
  return mergeScreenshotConversationSummaries(summaries);
}

export async function listMyConversations(userId: string): Promise<ConversationRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const summaries = await listConversationSummaries(userId);
  return summaries.map((s) => ({
    id: s.conversation_id,
    created_at: s.last_at ?? new Date().toISOString(),
  }));
}

export async function listMessages(
  conversationId: string,
  limit = 50,
  viewingUserId?: string,
): Promise<MessageRow[]> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleConversationId(conversationId)) {
    let uid = viewingUserId;
    if (!uid) {
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id;
      }
    }
    if (!uid) uid = '00000000-0000-4000-8000-000000000099';
    return getScreenshotMessagesForConversation(conversationId, uid, limit);
  }
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, media_asset_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const rawRows = data as MessageRow[];
  const assetIds = [...new Set(rawRows.map((r) => r.media_asset_id).filter(Boolean))] as string[];
  const assetMap = new Map<string, { public_url: string | null; kind: string | null }>();
  if (assetIds.length > 0) {
    const { data: assets } = await supabase
      .from('media_assets')
      .select('id, public_url, kind')
      .in('id', assetIds);
    for (const a of (assets ?? []) as { id: string; public_url: string | null; kind: string | null }[]) {
      assetMap.set(a.id, { public_url: a.public_url, kind: a.kind });
    }
  }

  const rows = rawRows.map((row) => {
    const asset = row.media_asset_id ? assetMap.get(row.media_asset_id) : undefined;
    return {
      ...row,
      media_public_url: asset?.public_url ?? null,
      media_kind: (asset?.kind as MessageRow['media_kind']) ?? null,
    };
  });
  return rows.reverse();
}

export type SendMessageResult =
  | { ok: true; message: MessageRow }
  | { ok: false; error: string };

export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<SendMessageResult> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleConversationId(conversationId)) {
    return { ok: false, error: 'Messages are disabled in screenshot mode.' };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Message is empty.' };
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select('id, conversation_id, sender_id, body, created_at, media_asset_id')
    .single();
  if (error || !data) {
    const msg = error?.message?.trim() || 'Could not send this message.';
    if (__DEV__ && error) {
      console.warn('[sendTextMessage]', error.code, error.message, error.details);
    }
    return { ok: false, error: msg };
  }
  return { ok: true, message: data as MessageRow };
}

export async function sendMediaMessage(
  conversationId: string,
  senderId: string,
  media: ComposerMedia,
  caption?: string,
): Promise<MessageRow | null> {
  if (isAppStoreScreenshotMode() && isScreenshotSampleConversationId(conversationId)) {
    return null;
  }
  const uploaded = await uploadMessageMedia(senderId, conversationId, media);
  if (!uploaded) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const body = (caption ?? '').trim() || (media.kind === 'video' ? 'Video' : 'Photo');
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      media_asset_id: uploaded.assetId,
    })
    .select('id, conversation_id, sender_id, body, created_at, media_asset_id')
    .single();
  if (error || !data) return null;
  return {
    ...(data as MessageRow),
    media_public_url: uploaded.publicUrl,
    media_kind: media.kind,
  };
}

/** Delete all messages in a conversation (participant policy). */
export async function clearConversationMessages(conversationId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('messages').delete().eq('conversation_id', conversationId);
  return !error;
}

export async function listBlockedUserIds(userId: string): Promise<string[]> {
  const doc = await fetchUserPrefsDoc(userId);
  return doc.blocked_user_ids ?? [];
}

export async function blockUser(userId: string, blockedUserId: string): Promise<boolean> {
  if (!userId || !blockedUserId || userId === blockedUserId) return false;
  const doc = await fetchUserPrefsDoc(userId);
  const set = new Set(doc.blocked_user_ids ?? []);
  set.add(blockedUserId);
  return patchUserPrefsDoc(userId, { blocked_user_ids: [...set] });
}

export async function isUserBlocked(viewerId: string, peerUserId: string): Promise<boolean> {
  const ids = await listBlockedUserIds(viewerId);
  return ids.includes(peerUserId);
}
