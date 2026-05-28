-- Server-truth subscription mirror: allow users to read their own row only.
-- Writes should come from service_role (RevenueCat webhook / Edge Function), not the client.

alter table if exists public.subscription_state enable row level security;

drop policy if exists "subscription_state_select_own" on public.subscription_state;
create policy "subscription_state_select_own"
  on public.subscription_state for select
  to authenticated
  using (auth.uid() = user_id);

-- Intentionally no INSERT/UPDATE/DELETE for authenticated — prevents client tampering with is_pro.
