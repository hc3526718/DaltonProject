import { getSupabase } from '../lib/supabase';

export type ProposalKind = 'media' | 'sponsor' | 'event';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'needs_info';

export type ContentProposalRow = {
  id: string;
  author_id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: Record<string, unknown>;
  attachment_urls: string[];
  reviewer_notes: string | null;
  opened_at: string | null;
  opened_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  discussion_unlocked: boolean;
  discussed_at: string | null;
  show_author_modal: boolean;
  author_modal_ack_at: string | null;
  followup_notes: string | null;
  followup_asset_urls: string[];
  followup_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  author_display_name?: string | null;
};

function mapRow(raw: Record<string, unknown>): ContentProposalRow {
  return {
    id: String(raw.id),
    author_id: String(raw.author_id),
    kind: raw.kind as ProposalKind,
    status: raw.status as ProposalStatus,
    payload: (raw.payload as Record<string, unknown>) ?? {},
    attachment_urls: Array.isArray(raw.attachment_urls) ? (raw.attachment_urls as string[]) : [],
    reviewer_notes: typeof raw.reviewer_notes === 'string' ? raw.reviewer_notes : null,
    opened_at: typeof raw.opened_at === 'string' ? raw.opened_at : null,
    opened_by: typeof raw.opened_by === 'string' ? raw.opened_by : null,
    reviewed_at: typeof raw.reviewed_at === 'string' ? raw.reviewed_at : null,
    reviewed_by: typeof raw.reviewed_by === 'string' ? raw.reviewed_by : null,
    discussion_unlocked: raw.discussion_unlocked === true,
    discussed_at: typeof raw.discussed_at === 'string' ? raw.discussed_at : null,
    show_author_modal: raw.show_author_modal === true,
    author_modal_ack_at:
      typeof raw.author_modal_ack_at === 'string' ? raw.author_modal_ack_at : null,
    followup_notes: typeof raw.followup_notes === 'string' ? raw.followup_notes : null,
    followup_asset_urls: Array.isArray(raw.followup_asset_urls)
      ? (raw.followup_asset_urls as string[])
      : [],
    followup_submitted_at:
      typeof raw.followup_submitted_at === 'string' ? raw.followup_submitted_at : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    author_display_name:
      typeof (raw.profiles as { display_name?: string } | null)?.display_name === 'string'
        ? (raw.profiles as { display_name: string }).display_name
        : null,
  };
}

export async function getSponsorProposalsUsedThisMonth(): Promise<number> {
  return contentProposalsUsedThisMonth();
}

export async function contentProposalsUsedThisMonth(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('content_proposals_this_month_count');
  if (error || data == null) {
    const legacy = await supabase.rpc('sponsor_proposals_this_month_count');
    if (legacy.error || legacy.data == null) return 0;
    return Number(legacy.data) || 0;
  }
  return Number(data) || 0;
}

export async function canSubmitContentProposal(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('can_submit_content_proposal');
  if (error) {
    return canSubmitSponsorProposalLegacy();
  }
  return data === true;
}

async function canSubmitSponsorProposalLegacy(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('can_submit_sponsor_proposal');
  if (error) return false;
  return data === true;
}

export async function canSubmitSponsorProposal(): Promise<boolean> {
  return canSubmitContentProposal();
}

export async function submitContentProposal(input: {
  kind: ProposalKind;
  payload: Record<string, unknown>;
  attachmentUrls?: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };

  const allowed = await canSubmitContentProposal();
  if (!allowed) {
    const used = await contentProposalsUsedThisMonth();
    return {
      ok: false,
      error: `You have reached the limit of 3 proposals this month (${used}/3 used).`,
    };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) return { ok: false, error: 'Sign in required.' };

  const { data, error } = await supabase
    .from('content_proposals')
    .insert({
      author_id: user.id,
      kind: input.kind,
      payload: input.payload,
      attachment_urls: input.attachmentUrls ?? [],
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    const msg = error?.message ?? 'Could not submit proposal.';
    if (msg.includes('sponsor_monthly_limit') || msg.includes('proposal_monthly_limit')) {
      return { ok: false, error: 'Maximum 3 proposals per calendar month.' };
    }
    return { ok: false, error: msg };
  }

  const proposalId = data.id as string;
  void supabase.functions
    .invoke('notify-masters-proposal', { body: { proposal_id: proposalId } })
    .catch(() => undefined);

  return { ok: true, id: proposalId };
}

export async function listMyProposals(): Promise<ContentProposalRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('content_proposals')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => mapRow(r as Record<string, unknown>));
}

export async function listPendingProposalsForMaster(): Promise<ContentProposalRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('content_proposals')
    .select('*, profiles:author_id ( display_name )')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((r) => mapRow(r as Record<string, unknown>));
}

export async function fetchProposalById(id: string): Promise<ContentProposalRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('content_proposals')
    .select('*, profiles:author_id ( display_name )')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function masterMarkProposalDiscussed(
  proposalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase.rpc('master_mark_proposal_discussed', {
    p_proposal_id: proposalId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function masterOpenProposal(proposalId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase.rpc('master_open_content_proposal', {
    p_proposal_id: proposalId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function masterReviewProposal(
  proposalId: string,
  decision: 'approved' | 'rejected',
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase.rpc('master_review_content_proposal', {
    p_proposal_id: proposalId,
    p_decision: decision,
  });
  if (error) {
    const msg = error.message;
    if (msg.includes('not_opened')) {
      return { ok: false, error: 'Open the submitted document before approving or rejecting.' };
    }
    if (msg.includes('not_discussed')) {
      return {
        ok: false,
        error: 'Message the applicant before approving or rejecting.',
      };
    }
    if (msg.includes('already_reviewed')) {
      return { ok: false, error: 'This proposal has already been reviewed.' };
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function listAuthorPendingOutcomeProposals(): Promise<ContentProposalRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('content_proposals')
    .select('*')
    .eq('author_id', user.id)
    .eq('show_author_modal', true)
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => mapRow(r as Record<string, unknown>));
}

export async function ackProposalAuthorModal(proposalId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc('ack_proposal_author_modal', {
    p_proposal_id: proposalId,
  });
  return !error;
}

export async function submitProposalFollowup(
  proposalId: string,
  notes: string,
  assetUrls: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase.rpc('submit_proposal_followup', {
    p_proposal_id: proposalId,
    p_notes: notes,
    p_asset_urls: assetUrls,
  });
  if (error) return { ok: false, error: error.message };
  void supabase.functions
    .invoke('submit-proposal-followup', { body: { proposal_id: proposalId } })
    .catch(() => undefined);
  return { ok: true };
}

export async function deleteContentProposal(proposalId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase.from('content_proposals').delete().eq('id', proposalId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updatePendingProposalPayload(
  proposalId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase
    .from('content_proposals')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
