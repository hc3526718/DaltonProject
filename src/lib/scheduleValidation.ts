/** Minimum lead time before an event or proposal may start (product rule). */
export const MIN_EVENT_LEAD_MS = 48 * 60 * 60 * 1000;

export function minScheduleStartDate(): Date {
  return new Date(Date.now() + MIN_EVENT_LEAD_MS);
}

export function isScheduleAtLeast48HoursAhead(date: Date): boolean {
  return date.getTime() >= Date.now() + MIN_EVENT_LEAD_MS;
}

export function schedule48HourError(): string {
  return 'Choose a date and time at least 48 hours from now.';
}

/** Combine calendar date with a time-of-day (hours/minutes from `time`). */
export function combineDateAndTime(date: Date, time: Date): Date {
  const out = new Date(date);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
}
