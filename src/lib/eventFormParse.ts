/** Parse YYYY-MM-DD + time (12-hour with optional AM/PM, or 24h HH:MM) to ISO string (UTC via Date). */
export function parseEventStartIso(dateStr: string, timeStr: string): string | null {
  const d = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = timeStr.trim();
  let hh = 12;
  let mm = 0;
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (m) {
    hh = parseInt(m[1], 10);
    mm = parseInt(m[2], 10);
    const ap = m[3]?.toUpperCase();
    if (ap === 'PM' && hh < 12) hh += 12;
    if (ap === 'AM' && hh === 12) hh = 0;
  } else {
    const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m2) return null;
    hh = parseInt(m2[1], 10);
    mm = parseInt(m2[2], 10);
  }
  if (hh > 23 || mm > 59 || hh < 0 || mm < 0) return null;
  const isoLocal = `${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  const dt = new Date(isoLocal);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/** Add duration from a label like "2 hours" / "1.5h"; default 2 hours if no match. */
export function endsAtAfterDuration(startIso: string, durationLabel: string): string {
  const m = durationLabel.trim().match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/i);
  const hours = m ? parseFloat(m[1]) : 2;
  const start = new Date(startIso);
  start.setTime(start.getTime() + hours * 3600000);
  return start.toISOString();
}
