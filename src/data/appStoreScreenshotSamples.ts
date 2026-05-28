/**
 * Fictional in-app content for App Store / marketing screenshots.
 * Merged at read time when `EXPO_PUBLIC_APP_STORE_SCREENSHOTS=1` (see `lib/env.ts`).
 * IDs are stable so detail screens can resolve rows without hitting Supabase.
 */

import type { EventRow, MediaAssetRow, MessageRow, PostRow, SubscriptionOfferPageRow } from '../roadmap/types';

/** Matches `ConversationSummary` in `messagingService` (kept here to avoid circular imports). */
export type ScreenshotConversationSummary = {
  conversation_id: string;
  peer_user_id: string;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  last_body: string | null;
  last_at: string | null;
  last_sender_id?: string | null;
};

/** Same shape as `CommunityPostFeedRow` in `liveDataService` (avoid circular import). */
export type SampleCommunityPostFeedRow = PostRow & {
  author_display_name: string | null;
  author_avatar_url: string | null;
  attachments?: { kind: 'image' | 'video' | 'file'; uri: string; name?: string }[];
};

/** Namespace UUIDs — never collide with real DB rows from random UUIDs. */
const S = {
  offer1: 'a0000001-0001-4000-8000-000000000001',
  offer2: 'a0000001-0001-4000-8000-000000000002',
  offer3: 'a0000001-0001-4000-8000-000000000003',
  offer4: 'a0000001-0001-4000-8000-000000000004',
  ev1: 'a0000002-0001-4000-8000-000000000001',
  ev2: 'a0000002-0001-4000-8000-000000000002',
  ev3: 'a0000002-0001-4000-8000-000000000003',
  ev4: 'a0000002-0001-4000-8000-000000000004',
  media1: 'a0000003-0001-4000-8000-000000000001',
  media2: 'a0000003-0001-4000-8000-000000000002',
  media3: 'a0000003-0001-4000-8000-000000000003',
  media4: 'a0000003-0001-4000-8000-000000000004',
  media5: 'a0000003-0001-4000-8000-000000000005',
  media6: 'a0000003-0001-4000-8000-000000000006',
  post1: 'a0000004-0001-4000-8000-000000000001',
  post2: 'a0000004-0001-4000-8000-000000000002',
  post3: 'a0000004-0001-4000-8000-000000000003',
  post4: 'a0000004-0001-4000-8000-000000000004',
  author: 'a0000005-0001-4000-8000-000000000001',
  peerCoach: 'a0000006-0001-4000-8000-000000000001',
  peerSarah: 'a0000006-0001-4000-8000-000000000002',
  peerMarcus: 'a0000006-0001-4000-8000-000000000003',
  peerEmma: 'a0000006-0001-4000-8000-000000000004',
  convCoach: 'a0000007-0001-4000-8000-000000000001',
  convSarah: 'a0000007-0001-4000-8000-000000000002',
  convMarcus: 'a0000007-0001-4000-8000-000000000003',
  convEmma: 'a0000007-0001-4000-8000-000000000004',
} as const;

const IMG = {
  ring: 'https://images.unsplash.com/photo-1549719386-74dfcbf7a31e?w=1200&q=80&auto=format&fit=crop',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80&auto=format&fit=crop',
  gloves: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=1200&q=80&auto=format&fit=crop',
  crowd: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80&auto=format&fit=crop',
  training: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80&auto=format&fit=crop',
  portrait: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop',
  portrait2: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80&auto=format&fit=crop',
  portrait3: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80&auto=format&fit=crop',
  shoe: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&auto=format&fit=crop',
} as const;

const now = () => new Date().toISOString();

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(18, 30, 0, 0);
  return d.toISOString();
}

function hoursAfter(startIso: string, hours: number): string {
  const d = new Date(startIso);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

function minutesAgo(minutes: number): string {
  const d = new Date();
  d.setUTCMinutes(d.getUTCMinutes() - minutes);
  return d.toISOString();
}

const DEMO_CREATED_BY = S.author;

export function getScreenshotSampleOfferPages(): SubscriptionOfferPageRow[] {
  const t = now();
  return [
    {
      id: S.offer1,
      created_by: DEMO_CREATED_BY,
      business_name: 'IronPulse Nutrition',
      description:
        'Official recovery partner for Dalton athletes. Electrolytes, clean protein, and ringside-ready hydration.',
      hero_image_url: IMG.gym,
      video_url: null,
      website_url: 'https://example.com/ironpulse',
      social_links: [{ label: 'Instagram', url: 'https://instagram.com' }],
      sort_order: 0,
      created_at: t,
      updated_at: t,
    },
    {
      id: S.offer2,
      created_by: DEMO_CREATED_BY,
      business_name: 'Vertex Tape & Wrap',
      description: 'Hand wraps, tape, and cutman supplies trusted by amateur and pro corners.',
      hero_image_url: IMG.gloves,
      video_url: null,
      website_url: 'https://example.com/vertex',
      social_links: [],
      sort_order: 1,
      created_at: t,
      updated_at: t,
    },
    {
      id: S.offer3,
      created_by: DEMO_CREATED_BY,
      business_name: 'Northline Athletics',
      description: 'Performance footwear and sprint drills.',
      hero_image_url: IMG.shoe,
      video_url: null,
      website_url: 'https://example.com/northline',
      social_links: [],
      sort_order: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: S.offer4,
      created_by: DEMO_CREATED_BY,
      business_name: 'Dalton Community Fund',
      description: 'Scholarships for young boxers and travel grants for regional championships.',
      hero_image_url: IMG.crowd,
      video_url: null,
      website_url: 'https://example.com/fund',
      social_links: [],
      sort_order: 3,
      created_at: t,
      updated_at: t,
    },
  ];
}

export function getScreenshotSampleEvents(): EventRow[] {
  const t = now();
  const ev1Start = daysFromNow(12);
  return [
    {
      id: S.ev1,
      organization_id: null,
      created_by: DEMO_CREATED_BY,
      title: 'Dalton Winter Sparring Showcase',
      description: 'Matched rounds, certified officials, and live DJ. All weights welcome.',
      starts_at: ev1Start,
      ends_at: hoursAfter(ev1Start, 4),
      venue: 'Riverfront Athletic Center, Hall A',
      hero_image_url: IMG.ring,
      requires_payment: false,
      stripe_price_id: null,
      created_at: t,
    },
    {
      id: S.ev2,
      organization_id: null,
      created_by: DEMO_CREATED_BY,
      title: 'Coach Certification — Level 1',
      description: 'Safety, wrapping, and corner protocol. Certificate issued same day.',
      starts_at: daysFromNow(26),
      ends_at: null,
      venue: 'Dalton HQ Training Room',
      hero_image_url: IMG.training,
      requires_payment: true,
      stripe_price_id: null,
      created_at: t,
    },
    {
      id: S.ev3,
      organization_id: null,
      created_by: DEMO_CREATED_BY,
      title: 'Open Mat: Footwork Lab',
      description: 'Ladders, mirrors, and timed drills. Bring indoor shoes only.',
      starts_at: daysFromNow(5),
      ends_at: null,
      venue: 'Eastside Boxing Club',
      hero_image_url: IMG.gym,
      requires_payment: false,
      stripe_price_id: null,
      created_at: t,
    },
    {
      id: S.ev4,
      organization_id: null,
      created_by: DEMO_CREATED_BY,
      title: 'Youth Fight Night (Exhibition)',
      description: 'Headgear, three 1-minute rounds, medals for all participants.',
      starts_at: daysFromNow(40),
      ends_at: null,
      venue: 'Civic Arena — Gate 4',
      hero_image_url: IMG.crowd,
      requires_payment: false,
      stripe_price_id: null,
      created_at: t,
    },
  ];
}

export function getScreenshotSampleMediaAssets(): MediaAssetRow[] {
  const t = now();
  return [
    {
      id: S.media1,
      owner_id: DEMO_CREATED_BY,
      kind: 'video',
      storage_path: 'dalton-screenshots/footwork-lab-masterclass.mp4',
      public_url: IMG.training,
      thumbnail_url: IMG.training,
      mime_type: 'video/mp4',
      visibility: 'public',
      created_at: t,
    },
    {
      id: S.media2,
      owner_id: DEMO_CREATED_BY,
      kind: 'video',
      storage_path: 'dalton-screenshots/defense-checklist-rounds.mp4',
      public_url: IMG.ring,
      thumbnail_url: IMG.ring,
      mime_type: 'video/mp4',
      visibility: 'public',
      created_at: t,
    },
    {
      id: S.media3,
      owner_id: DEMO_CREATED_BY,
      kind: 'image',
      storage_path: 'dalton-screenshots/camp-week-recap-stills.jpg',
      public_url: IMG.gloves,
      thumbnail_url: IMG.gloves,
      mime_type: 'image/jpeg',
      visibility: 'public',
      created_at: t,
    },
    {
      id: S.media4,
      owner_id: DEMO_CREATED_BY,
      kind: 'video',
      storage_path: 'dalton-screenshots/strength-for-strikers.mp4',
      public_url: IMG.gym,
      thumbnail_url: IMG.gym,
      mime_type: 'video/mp4',
      visibility: 'public',
      created_at: t,
    },
    {
      id: S.media5,
      owner_id: DEMO_CREATED_BY,
      kind: 'image',
      storage_path: 'dalton-screenshots/behind-the-scenes-weigh-in.jpg',
      public_url: IMG.crowd,
      thumbnail_url: IMG.crowd,
      mime_type: 'image/jpeg',
      visibility: 'public',
      created_at: t,
    },
    {
      id: S.media6,
      owner_id: DEMO_CREATED_BY,
      kind: 'video',
      storage_path: 'dalton-screenshots/pad-work-combinations.mp4',
      public_url: IMG.ring,
      thumbnail_url: IMG.ring,
      mime_type: 'video/mp4',
      visibility: 'public',
      created_at: t,
    },
  ];
}

export function getScreenshotSampleCommunityPosts(): SampleCommunityPostFeedRow[] {
  const t = now();
  return [
    {
      id: S.post1,
      author_id: DEMO_CREATED_BY,
      organization_id: null,
      body: 'Eight weeks out — switched to morning roadwork + evening bag. Feeling sharp. Who else is stacking miles this winter?',
      created_at: t,
      updated_at: t,
      author_display_name: 'Maya Chen',
      author_avatar_url: IMG.portrait2,
      attachments: [{ kind: 'image', uri: IMG.training, name: 'training.jpg' }],
    },
    {
      id: S.post2,
      author_id: DEMO_CREATED_BY,
      organization_id: null,
      body: 'Shout-out to our corner crew last night. Best hand-wrap game in the city.',
      created_at: t,
      updated_at: t,
      author_display_name: 'Jordan Miles',
      author_avatar_url: IMG.portrait,
      attachments: [{ kind: 'image', uri: IMG.gloves, name: 'wraps.jpg' }],
    },
    {
      id: S.post3,
      author_id: DEMO_CREATED_BY,
      organization_id: null,
      body: 'Clip from sparring: working the check hook off the back foot. Feedback welcome.',
      created_at: t,
      updated_at: t,
      author_display_name: 'Alex Rivera',
      author_avatar_url: IMG.portrait3,
      attachments: [
        { kind: 'image', uri: IMG.ring, name: 'still.jpg' },
        { kind: 'video', uri: IMG.training, name: 'clip.mp4' },
      ],
    },
    {
      id: S.post4,
      author_id: DEMO_CREATED_BY,
      organization_id: null,
      body: 'Tickets drop Friday for the Winter Showcase — posting the matchups here first.',
      created_at: t,
      updated_at: t,
      author_display_name: 'Sam Okonkwo',
      author_avatar_url: IMG.portrait,
      attachments: [{ kind: 'image', uri: IMG.crowd, name: 'arena.jpg' }],
    },
  ];
}

type MsgTemplate = { from: 'me' | 'them'; body: string; minutesAgo: number };

function buildScreenshotMessages(
  conversationId: string,
  viewerUserId: string,
  peerUserId: string,
  templates: MsgTemplate[],
  idPrefix: string,
): MessageRow[] {
  return templates.map((t, i) => ({
    id: `${idPrefix}-${String(i + 1).padStart(2, '0')}`,
    conversation_id: conversationId,
    sender_id: t.from === 'me' ? viewerUserId : peerUserId,
    body: t.body,
    created_at: minutesAgo(t.minutesAgo),
  }));
}

const COACH_MSG_TEMPLATES: MsgTemplate[] = [
  {
    from: 'them',
    minutesAgo: 180,
    body: 'Morning — how did bag work feel after yesterday’s footwork session?',
  },
  {
    from: 'me',
    minutesAgo: 175,
    body: 'Much better. Hip rotation is finally clicking on the cross. Thanks for the cue on the pivot.',
  },
  {
    from: 'them',
    minutesAgo: 170,
    body: 'That’s what I like to hear. Your pace in the last round was controlled, not rushed.',
  },
  {
    from: 'them',
    minutesAgo: 45,
    body: 'Great progress on your technique today! Keep it up 💪',
  },
  {
    from: 'me',
    minutesAgo: 42,
    body: 'Thank you coach! The breathing drills before sparring made a huge difference.',
  },
  {
    from: 'them',
    minutesAgo: 38,
    body: 'Tomorrow we’ll add interval rounds on the mitts. Bring wraps and mouthguard.',
  },
  {
    from: 'me',
    minutesAgo: 35,
    body: 'Absolutely — what time should I be in?',
  },
  {
    from: 'them',
    minutesAgo: 2,
    body: '6 AM sharp. Hydrate tonight and sleep with intention.',
  },
];

const SARAH_MSG_TEMPLATES: MsgTemplate[] = [
  { from: 'them', minutesAgo: 20, body: 'Still good for open mat tonight?' },
  { from: 'me', minutesAgo: 18, body: 'Yes — I’ll bring the new headgear.' },
  { from: 'them', minutesAgo: 15, body: 'Thanks! See you at practice tomorrow 🥊' },
];

const MARCUS_MSG_TEMPLATES: MsgTemplate[] = [
  { from: 'them', minutesAgo: 65, body: 'Did you see the Winter Showcase matchups posted in Events?' },
  { from: 'me', minutesAgo: 60, body: 'Just booked my slot — Riverfront Hall looks packed.' },
];

const EMMA_MSG_TEMPLATES: MsgTemplate[] = [
  { from: 'them', minutesAgo: 200, body: 'Reminder: strength block at 6 AM tomorrow, not 6:30.' },
  { from: 'me', minutesAgo: 195, body: "Perfect! I'll be there at 6 AM." },
];

/** Inbox row extras (unread badge, online dot) keyed by conversation id. */
export const SCREENSHOT_INBOX_EXTRAS: Record<
  string,
  { online?: boolean; unread?: number; selected?: boolean }
> = {
  [S.convCoach]: { online: true, unread: 3, selected: true },
  [S.convSarah]: { online: true },
  [S.convMarcus]: { unread: 1, selected: true },
  [S.convEmma]: { online: true },
};

export function getScreenshotSampleConversationSummaries(): ScreenshotConversationSummary[] {
  return [
    {
      conversation_id: S.convCoach,
      peer_user_id: S.peerCoach,
      peer_display_name: 'Coach Williams',
      peer_avatar_url: IMG.portrait3,
      last_body: COACH_MSG_TEMPLATES[COACH_MSG_TEMPLATES.length - 1]!.body,
      last_at: minutesAgo(2),
    },
    {
      conversation_id: S.convSarah,
      peer_user_id: S.peerSarah,
      peer_display_name: 'Sarah Chen',
      peer_avatar_url: IMG.portrait2,
      last_body: SARAH_MSG_TEMPLATES[SARAH_MSG_TEMPLATES.length - 1]!.body,
      last_at: minutesAgo(15),
    },
    {
      conversation_id: S.convMarcus,
      peer_user_id: S.peerMarcus,
      peer_display_name: 'Marcus Johnson',
      peer_avatar_url: IMG.portrait,
      last_body: MARCUS_MSG_TEMPLATES[MARCUS_MSG_TEMPLATES.length - 1]!.body,
      last_at: minutesAgo(60),
    },
    {
      conversation_id: S.convEmma,
      peer_user_id: S.peerEmma,
      peer_display_name: 'Emma Rodriguez',
      peer_avatar_url: IMG.portrait2,
      last_body: EMMA_MSG_TEMPLATES[EMMA_MSG_TEMPLATES.length - 1]!.body,
      last_at: minutesAgo(195),
    },
  ];
}

export function getScreenshotMessagesForConversation(
  conversationId: string,
  viewingUserId: string,
  limit = 100,
): MessageRow[] {
  const peerMap: Record<string, { peerId: string; templates: MsgTemplate[]; prefix: string }> = {
    [S.convCoach]: { peerId: S.peerCoach, templates: COACH_MSG_TEMPLATES, prefix: 'a0000008-0001-4000-8000-000000000001' },
    [S.convSarah]: { peerId: S.peerSarah, templates: SARAH_MSG_TEMPLATES, prefix: 'a0000008-0001-4000-8000-000000000002' },
    [S.convMarcus]: { peerId: S.peerMarcus, templates: MARCUS_MSG_TEMPLATES, prefix: 'a0000008-0001-4000-8000-000000000003' },
    [S.convEmma]: { peerId: S.peerEmma, templates: EMMA_MSG_TEMPLATES, prefix: 'a0000008-0001-4000-8000-000000000004' },
  };
  const spec = peerMap[conversationId];
  if (!spec) return [];
  const rows = buildScreenshotMessages(
    conversationId,
    viewingUserId,
    spec.peerId,
    spec.templates,
    spec.prefix,
  );
  return rows.slice(-limit);
}

const CONV_IDS = new Set(getScreenshotSampleConversationSummaries().map((r) => r.conversation_id));
const PEER_IDS = new Set(getScreenshotSampleConversationSummaries().map((r) => r.peer_user_id));

export function isScreenshotSampleConversationId(id: string): boolean {
  return CONV_IDS.has(id);
}

export function isScreenshotSamplePeerId(id: string): boolean {
  return PEER_IDS.has(id);
}

export function getScreenshotConversationIdForPeer(peerUserId: string): string | null {
  const row = getScreenshotSampleConversationSummaries().find((s) => s.peer_user_id === peerUserId);
  return row?.conversation_id ?? null;
}

function mergeByConversationId(
  samples: ScreenshotConversationSummary[],
  live: ScreenshotConversationSummary[],
): ScreenshotConversationSummary[] {
  const seen = new Set<string>();
  const out: ScreenshotConversationSummary[] = [];
  for (const row of [...samples, ...live]) {
    if (seen.has(row.conversation_id)) continue;
    seen.add(row.conversation_id);
    out.push(row);
  }
  return out.sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? ''));
}

export function mergeScreenshotConversationSummaries(
  live: ScreenshotConversationSummary[],
): ScreenshotConversationSummary[] {
  const samples = getScreenshotSampleConversationSummaries().map((row) => ({
    ...row,
    last_sender_id: row.last_sender_id ?? row.peer_user_id,
  }));
  return mergeByConversationId(samples, live);
}

const OFFER_IDS = new Set(getScreenshotSampleOfferPages().map((r) => r.id));
const EVENT_IDS = new Set(getScreenshotSampleEvents().map((r) => r.id));
const MEDIA_IDS = new Set(getScreenshotSampleMediaAssets().map((r) => r.id));

export function isScreenshotSampleOfferPageId(id: string): boolean {
  return OFFER_IDS.has(id);
}

export function isScreenshotSampleEventId(id: string): boolean {
  return EVENT_IDS.has(id);
}

export function isScreenshotSampleMediaId(id: string): boolean {
  return MEDIA_IDS.has(id);
}

export function getScreenshotOfferPageById(id: string): SubscriptionOfferPageRow | null {
  return getScreenshotSampleOfferPages().find((r) => r.id === id) ?? null;
}

export function getScreenshotEventById(id: string): EventRow | null {
  return getScreenshotSampleEvents().find((r) => r.id === id) ?? null;
}

function mergeByIdFirst<T extends { id: string }>(samples: T[], live: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of [...samples, ...live]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function mergeScreenshotSubscriptionPages(live: SubscriptionOfferPageRow[]): SubscriptionOfferPageRow[] {
  return mergeByIdFirst(getScreenshotSampleOfferPages(), live).sort((a, b) => a.sort_order - b.sort_order);
}

export function mergeScreenshotEvents(live: EventRow[]): EventRow[] {
  return mergeByIdFirst(getScreenshotSampleEvents(), live);
}

export function mergeScreenshotMedia(live: MediaAssetRow[]): MediaAssetRow[] {
  return mergeByIdFirst(getScreenshotSampleMediaAssets(), live);
}

export function mergeScreenshotCommunityPosts<T extends { id: string }>(
  live: T[],
): T[] {
  return mergeByIdFirst(getScreenshotSampleCommunityPosts() as unknown as T[], live);
}
