-- Mandatory app access flag + remove Dalton verification + event entry payment notices.

ALTER TABLE public.subscription_state
  ADD COLUMN IF NOT EXISTS is_payment_verified boolean NOT NULL DEFAULT false;

UPDATE public.subscription_state
SET is_payment_verified = true
WHERE is_pro IS TRUE AND is_payment_verified IS NOT TRUE;

UPDATE public.profiles
SET dalton_verified = false
WHERE dalton_verified IS TRUE;

DROP TRIGGER IF EXISTS subscription_state_sync_dalton_verified ON public.subscription_state;
DROP FUNCTION IF EXISTS public.subscription_state_sync_dalton_verified();

DROP FUNCTION IF EXISTS public.list_premium_awaiting_dalton_verification();
DROP FUNCTION IF EXISTS public.master_grant_dalton_verified(uuid, text);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS entry_payment_mode text
    CHECK (entry_payment_mode IS NULL OR entry_payment_mode IN ('none', 'payment_on_arrival', 'internal_costs')),
  ADD COLUMN IF NOT EXISTS entry_payment_amount text,
  ADD COLUMN IF NOT EXISTS entry_payment_note text;

COMMENT ON COLUMN public.subscription_state.is_payment_verified IS
  'True after mandatory academy access payment (Stripe / RevenueCat webhook).';

COMMENT ON COLUMN public.events.entry_payment_mode IS
  'none | payment_on_arrival | internal_costs — shown in event copy, not in-app Stripe checkout.';
