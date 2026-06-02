/**
 * Shared DTO shapes for live Supabase-backed features (align rows with `backend/schema.sql`).
 * Screens should map these to UI models; keep transport types stable here.
 */

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  persona_role: string | null;
  sports: string[] | null;
  primary_sport?: string | null;
  discovery_source: string | null;
  bio?: string | null;
  interests?: string[] | null;
  banner_url?: string | null;
  highlights?: unknown;
  recent_results?: unknown;
  athlete_details?: {
    discipline?: string;
    level?: string;
    team?: string;
    coach?: string;
    badges?: Record<string, boolean>;
  } | null;
  onboarding_completed_at: string | null;
  /** Lowercase handle; unique when set (`backend/migrations/010_profiles_username.sql`). */
  username?: string | null;
  dalton_verified: boolean | null;
  /** DM gate: who can start a thread with this user (`profiles.allow_messages_from`). */
  allow_messages_from?: string | null;
  /** Platform master controller (`008_master_control_subscription_pages`). */
  master_control?: string | null;
  master_pin_hash?: string | null;
};

/** Curated partner / subscription showcase rows (master only writes). */
export type SubscriptionOfferPageRow = {
  id: string;
  created_by: string;
  business_name: string;
  description: string | null;
  hero_image_url: string | null;
  video_url: string | null;
  website_url: string | null;
  social_links: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PostRow = {
  id: string;
  author_id: string;
  organization_id: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
};

export type EventDetailsJson = {
  level?: string;
  capacity?: number;
  tags?: string;
  bring?: string;
  duration?: string;
  agenda?: { time: string; title: string }[];
  faqs?: { q: string; a: string }[];
};

export type EntryPaymentMode = 'none' | 'payment_on_arrival' | 'internal_costs';

export type EventRow = {
  id: string;
  organization_id: string | null;
  created_by?: string | null;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  hero_image_url: string | null;
  requires_payment: boolean;
  stripe_price_id: string | null;
  created_at: string;
  /** Optional long-form copy from create-event form (`006_*` migration). */
  description?: string | null;
  /** Structured wizard fields (`035_event_details_and_account_suspension`). */
  event_details?: EventDetailsJson | null;
  entry_payment_mode?: EntryPaymentMode | null;
  entry_payment_amount?: string | null;
  entry_payment_note?: string | null;
  /** Maintained by trigger on `bookings` (migration 034). */
  registered_count?: number;
};

export type EventReviewRow = {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type MediaAssetRow = {
  id: string;
  owner_id: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  storage_path: string;
  public_url: string | null;
  thumbnail_url: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  series_title?: string | null;
  series_part?: number | null;
  featured_series?: boolean;
  mime_type: string | null;
  visibility: 'private' | 'followers' | 'public';
  post_id?: string | null;
  created_at: string;
};

export type ConversationRow = { id: string; created_at: string };

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  media_asset_id?: string | null;
  created_at: string;
  /** Joined from `media_assets` when listing messages. */
  media_public_url?: string | null;
  media_kind?: 'image' | 'video' | 'file' | null;
};

export type SubscriptionStateRow = {
  user_id: string;
  is_pro: boolean;
  entitlement_ids: string[] | null;
  updated_at: string;
};

/** Server row for sponsorship *applications* (not public posts) — apply in `roadmap_extensions.sql`. */
export type SponsorshipSubmissionRow = {
  id: string;
  submitter_id: string;
  title: string;
  body: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  /** JSON blob for notification prefs, theme, etc. */
  preferences: Record<string, unknown>;
  updated_at: string;
};

export type PushDeviceRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web';
  updated_at: string;
};
