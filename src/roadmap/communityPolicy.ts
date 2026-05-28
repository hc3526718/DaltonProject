/**
 * Community posting rules — mirror in Supabase RLS (`posts` insert policy).
 */

/** Any authenticated user may create a post (tighten for paid tier / verified later). */
export const COMMUNITY_FREE_POSTING = true;

/** Future: hold posts for moderation when reputation low, etc. */
export const COMMUNITY_MODERATION_QUEUE = false;

export type CommunityPostDraft = {
  body: string;
  organizationId?: string | null;
};

export function canSubmitCommunityPost(_userId: string, draft: CommunityPostDraft): boolean {
  if (!COMMUNITY_FREE_POSTING) return false;
  return draft.body.trim().length > 0;
}
