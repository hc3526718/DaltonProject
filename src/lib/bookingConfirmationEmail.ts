import { getSupabase } from './supabase';
import { isSupabaseConfigured } from './env';

/**
 * Fire-and-forget booking confirmation email (Resend via Edge Function).
 * Non-fatal: booking succeeds even if email fails or Resend is not configured.
 */
export async function notifyBookingConfirmationEmail(opts: {
  bookingId: string;
  reference?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return;

  try {
    const { error } = await supabase.functions.invoke('send-booking-confirmation-email', {
      body: {
        booking_id: opts.bookingId,
        ...(opts.reference ? { reference: opts.reference } : {}),
      },
    });
    if (error && __DEV__) {
      console.warn('[booking-email]', error.message);
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[booking-email]', e instanceof Error ? e.message : e);
    }
  }
}
