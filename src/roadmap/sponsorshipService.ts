import { getSupabase } from '../lib/supabase';
import type { SponsorshipSubmissionRow } from './types';

export async function submitSponsorshipApplication(input: {
  submitterId: string;
  title: string;
  body: string | null;
}): Promise<SponsorshipSubmissionRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('sponsorship_submissions')
    .insert({
      submitter_id: input.submitterId,
      title: input.title,
      body: input.body,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return data as SponsorshipSubmissionRow;
}

export async function listMySubmissions(submitterId: string): Promise<SponsorshipSubmissionRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sponsorship_submissions')
    .select('*')
    .eq('submitter_id', submitterId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as SponsorshipSubmissionRow[];
}
