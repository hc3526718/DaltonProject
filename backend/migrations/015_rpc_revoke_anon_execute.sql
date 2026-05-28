-- Supabase linter: anon must not execute SECURITY DEFINER RPCs (auth.uid() is null).

revoke execute on function public.can_submit_sponsor_proposal() from anon;
revoke execute on function public.enforce_sponsor_proposal_monthly_limit() from anon;
revoke execute on function public.is_master_account() from anon;
revoke execute on function public.master_open_content_proposal(uuid) from anon;
revoke execute on function public.master_review_content_proposal(uuid, text) from anon;
revoke execute on function public.sponsor_proposals_this_month_count() from anon;
