export type EntryPaymentMode = 'none' | 'payment_on_arrival' | 'internal_costs';

export function formatEntryPaymentNotice(
  mode: EntryPaymentMode,
  amount?: string | null,
  note?: string | null,
): string | null {
  if (mode === 'payment_on_arrival') {
    const amt = amount?.trim();
    return amt ? `Payment on arrival: ${amt}` : 'Payment on arrival';
  }
  if (mode === 'internal_costs') {
    const n = note?.trim();
    return n
      ? `Free entry — bring payment for internal costs: ${n}`
      : 'Free entry — bring payment for any internal costs on the day.';
  }
  return null;
}

export function entryPaymentBlockForDescription(
  mode: EntryPaymentMode,
  amount?: string | null,
  note?: string | null,
): string {
  const line = formatEntryPaymentNotice(mode, amount, note);
  return line ? `\n\n${line}` : '';
}
