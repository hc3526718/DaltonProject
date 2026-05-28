import type { EventRow } from '../roadmap/types';

/** Mirrors ticket / booking confirmation: explicit `ends_at`, else start + 3h. */
export function eventEffectiveEndMs(ev: Pick<EventRow, 'starts_at' | 'ends_at'>): number {
  const start = new Date(ev.starts_at).getTime();
  const endParsed = ev.ends_at ? new Date(ev.ends_at).getTime() : NaN;
  if (Number.isFinite(endParsed)) return endParsed;
  if (Number.isFinite(start)) return start + 3 * 60 * 60 * 1000;
  return Date.now();
}

export function reviewsUnlockAtMs(ev: Pick<EventRow, 'starts_at' | 'ends_at'>): number {
  return eventEffectiveEndMs(ev) + 60 * 60 * 1000;
}

export function isEventArchivedForBrowse(ev: Pick<EventRow, 'starts_at' | 'ends_at'>): boolean {
  return Date.now() >= eventEffectiveEndMs(ev);
}
