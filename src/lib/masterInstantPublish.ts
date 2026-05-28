import { uploadProposalAttachment } from './proposalAttachmentUpload';
import { insertCommunityEvent, insertSubscriptionOfferPage } from '../roadmap/liveDataService';
import { getSupabase } from './supabase';
import { combineDateAndTime } from './scheduleValidation';
import type { ProposalKind } from '../roadmap/proposalService';
import type { EntryPaymentMode } from './eventEntryPayment';
import { entryPaymentBlockForDescription } from './eventEntryPayment';

type EventPayload = {
  title?: string;
  pitch?: string;
  proposed_date?: string;
  venue?: string;
  level?: string;
  agenda?: { title: string; time: string }[];
  max_attendance?: number | string;
  entry_payment_mode?: EntryPaymentMode;
  entry_payment_amount?: string;
  entry_payment_note?: string;
};

type SponsorPayload = {
  brand_name?: string;
  contact_email?: string;
  hook?: string;
  helps_athletes?: string;
  website_url?: string;
  video_url?: string;
  logo_url?: string;
  gallery_urls?: string[];
  external_links?: { label: string; url: string }[];
  promo_codes?: { code: string; details: string }[];
};

type MediaPayload = {
  title?: string;
  pitch?: string;
  category?: string;
  tags?: string[];
};

export type MasterPublishResult =
  | { ok: true; eventId?: string; sponsorPageId?: string; mediaAssetId?: string }
  | { ok: false; error: string };

function parseProposedDate(proposedDate?: string): { starts: string; ends: string } | null {
  if (!proposedDate?.trim()) return null;
  const dt = new Date(proposedDate.trim());
  if (Number.isNaN(dt.getTime())) return null;
  const ends = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
  return { starts: dt.toISOString(), ends: ends.toISOString() };
}

function buildEventDescription(payload: EventPayload): string {
  const parts: string[] = [];
  if (payload.pitch?.trim()) parts.push(payload.pitch.trim());
  if (payload.level) parts.push('', `Level: ${payload.level}`);
  const agenda = Array.isArray(payload.agenda)
    ? payload.agenda.filter((a) => a.title?.trim() && a.time?.trim())
    : [];
  if (agenda.length) {
    parts.push('', 'Agenda:', ...agenda.map((a) => `• ${a.time.trim()} — ${a.title.trim()}`));
  }
  const cap = payload.max_attendance;
  if (cap != null && String(cap).trim() !== '') {
    parts.push('', `Capacity: ${String(cap).trim()}`);
  }
  const mode = payload.entry_payment_mode ?? 'none';
  parts.push(
    entryPaymentBlockForDescription(mode, payload.entry_payment_amount, payload.entry_payment_note),
  );
  return parts.join('\n').trim() || 'Community event';
}

export async function publishEventFromProposalPayload(
  userId: string,
  payload: EventPayload,
  attachmentUrls: string[],
): Promise<MasterPublishResult> {
  const schedule = parseProposedDate(payload.proposed_date);
  if (!schedule) {
    return { ok: false, error: 'Could not read event date and time.' };
  }
  const mode = payload.entry_payment_mode ?? 'none';
  const row = await insertCommunityEvent({
    title: (payload.title ?? 'Community event').trim(),
    description: buildEventDescription(payload),
    starts_at: schedule.starts,
    ends_at: schedule.ends,
    venue: payload.venue?.trim() || null,
    hero_image_url: attachmentUrls.find((u) => /\.(jpe?g|png|webp|gif)/i.test(u)) ?? null,
    requires_payment: false,
    created_by: userId,
    entry_payment_mode: mode,
    entry_payment_amount: mode === 'payment_on_arrival' ? payload.entry_payment_amount?.trim() || null : null,
    entry_payment_note: mode === 'internal_costs' ? payload.entry_payment_note?.trim() || null : null,
  });
  if (!row) return { ok: false, error: 'Could not publish event.' };
  return { ok: true, eventId: row.id };
}

export async function publishSponsorFromProposalPayload(
  userId: string,
  payload: SponsorPayload,
  attachmentUrls: string[],
): Promise<MasterPublishResult> {
  const hook = payload.hook?.trim() ?? '';
  const helps = payload.helps_athletes?.trim() ?? '';
  const contact = payload.contact_email?.trim() ?? '';
  const descParts = [
    hook,
    helps ? `How this helps athletes:\n${helps}` : '',
    contact ? `Contact: ${contact}` : '',
  ].filter(Boolean);
  const heroUrl =
    attachmentUrls.find((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) ??
    payload.gallery_urls?.[0] ??
    null;
  const videoUrl =
    payload.video_url?.trim() ||
    attachmentUrls.find((u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)) ||
    null;
  const website = payload.website_url?.trim() || null;
  const social_links = {
    external_links: Array.isArray(payload.external_links) ? payload.external_links : [],
    promo_codes: Array.isArray(payload.promo_codes) ? payload.promo_codes : [],
    gallery_urls: Array.isArray(payload.gallery_urls) ? payload.gallery_urls : [],
    logo_url: payload.logo_url?.trim() || null,
    contact_email: contact || null,
  };
  const row = await insertSubscriptionOfferPage({
    created_by: userId,
    business_name: (payload.brand_name ?? 'Partner').trim(),
    description: descParts.join('\n\n') || null,
    hero_image_url: heroUrl,
    website_url: website,
    video_url: videoUrl,
    social_links,
  });
  if (!row) return { ok: false, error: 'Could not publish sponsor page.' };
  return { ok: true, sponsorPageId: row.id };
}

export async function publishMediaFromProposalPayload(
  userId: string,
  payload: MediaPayload,
  attachmentUrls: string[],
  localFiles: { uri: string; name: string }[],
): Promise<MasterPublishResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };

  const title = (payload.title ?? 'Media').trim();
  const description = [payload.pitch?.trim(), payload.category ? `Category: ${payload.category}` : '']
    .filter(Boolean)
    .join('\n\n');
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : [];
  const tagSuffix =
    Array.isArray(payload.tags) && payload.tags.length
      ? `tags-${payload.tags
          .map((t) => String(t).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
          .filter(Boolean)
          .slice(0, 6)
          .join('-')}`
      : '';

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);

  let published = 0;
  let firstId: string | undefined;

  const insertMedia = async (row: Record<string, unknown>) => {
    const { data, error } = await supabase.from('media_assets').insert(row).select('id').single();
    if (!error && data?.id) return { ok: true as const, id: data.id as string };
    return { ok: false as const, error };
  };

  const shouldRetryWithoutMeta = (err: unknown) => {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message ?? '') : '';
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
    return (
      // PostgREST errors vary across versions. Treat any "unknown column" or schema-cache miss as a reason to retry.
      (code === 'PGRST204' || code === '42703') ||
      (msg.includes('column') &&
        (msg.includes('title') ||
          msg.includes('description') ||
          msg.includes('tags') ||
          msg.includes('thumbnail_url'))) ||
      (msg.toLowerCase().includes('schema cache') &&
        (msg.includes('title') || msg.includes('description') || msg.includes('tags') || msg.includes('thumbnail_url')))
    );
  };

  const thumbnailUrl =
    attachmentUrls.find((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) ?? null;

  for (let i = 0; i < localFiles.length; i++) {
    const f = localFiles[i]!;
    const publicUrl =
      attachmentUrls[i] ??
      (await uploadProposalAttachment(userId, 'media', f.uri, f.name));
    if (!publicUrl) continue;
    const isVideo = /\.(mp4|mov|webm|m4v)/i.test(f.name) || f.name.toLowerCase().includes('video');
    if (!isVideo) continue;
    const ext = (f.name.split('.').pop() || 'mp4').toLowerCase();
    const rowWithMeta = {
        owner_id: userId,
        kind: 'video',
        storage_path: `library/${userId}/${Date.now()}-${slug || 'video'}${tagSuffix ? `-${tagSuffix}` : ''}-${i}.${ext}`,
        public_url: publicUrl,
        mime_type: `video/${ext === 'mov' ? 'quicktime' : ext}`,
        visibility: 'public',
        title,
        description: description || null,
        tags,
        thumbnail_url: thumbnailUrl,
      } as const;
    const rowNoMeta = {
      owner_id: userId,
      kind: 'video',
      storage_path: rowWithMeta.storage_path,
      public_url: rowWithMeta.public_url,
      mime_type: rowWithMeta.mime_type,
      visibility: rowWithMeta.visibility,
    } as const;

    let ins = await insertMedia(rowWithMeta);
    if (!ins.ok && shouldRetryWithoutMeta(ins.error)) {
      ins = await insertMedia(rowNoMeta);
    }
    if (ins.ok) {
      published += 1;
      firstId ??= ins.id;
    }
  }

  for (const url of attachmentUrls.slice(localFiles.length)) {
    const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
    if (!isVideo) continue;
    const ext = (url.split('?')[0]?.split('.').pop() || 'mp4').toLowerCase();
    const rowWithMeta = {
        owner_id: userId,
        kind: 'video',
        storage_path: `library/${userId}/${Date.now()}-${slug || 'video'}${tagSuffix ? `-${tagSuffix}` : ''}-link.${ext}`,
        public_url: url,
        visibility: 'public',
        title,
        description: description || null,
        tags,
        thumbnail_url: thumbnailUrl,
      } as const;
    const rowNoMeta = {
      owner_id: userId,
      kind: 'video',
      storage_path: rowWithMeta.storage_path,
      public_url: rowWithMeta.public_url,
      visibility: rowWithMeta.visibility,
    } as const;

    let ins = await insertMedia(rowWithMeta);
    if (!ins.ok && shouldRetryWithoutMeta(ins.error)) {
      ins = await insertMedia(rowNoMeta);
    }
    if (ins.ok) {
      published += 1;
      firstId ??= ins.id;
    }
  }

  if (published === 0 && attachmentUrls.length === 0 && localFiles.length === 0) {
    const { data, error } = await supabase
      .from('media_assets')
      .insert({
        owner_id: userId,
        kind: 'file',
        storage_path: `library/${userId}/${Date.now()}-meta`,
        public_url: null,
        visibility: 'public',
      })
      .select('id')
      .single();
    if (error || !data?.id) return { ok: false, error: 'Could not publish media entry.' };
    firstId = data.id as string;
  } else if (published === 0 && (attachmentUrls.length > 0 || localFiles.length > 0)) {
    return { ok: false, error: 'Could not publish media files.' };
  }

  void title;
  void description;
  return { ok: true, mediaAssetId: firstId };
}

export async function masterInstantPublish(
  userId: string,
  kind: ProposalKind,
  payload: Record<string, unknown>,
  attachmentUrls: string[],
  localFiles: { uri: string; name: string }[] = [],
): Promise<MasterPublishResult> {
  switch (kind) {
    case 'event':
      return publishEventFromProposalPayload(userId, payload as EventPayload, attachmentUrls);
    case 'sponsor':
      return publishSponsorFromProposalPayload(userId, payload as SponsorPayload, attachmentUrls);
    case 'media':
      return publishMediaFromProposalPayload(
        userId,
        payload as MediaPayload,
        attachmentUrls,
        localFiles,
      );
    default:
      return { ok: false, error: 'Unknown content type.' };
  }
}

/** Build ISO schedule string from separate date + time pickers. */
export function proposedDateIsoFromPickers(eventDate: Date, eventTime: Date): string {
  return combineDateAndTime(eventDate, eventTime).toISOString();
}
