/** Shared profile label helpers for own + public member views. */

function sportDedupeKeys(
  primarySport: string | null | undefined,
  sports: string[] | null | undefined,
): Set<string> {
  const s = new Set<string>();
  const add = (x?: string | null) => {
    const t = x?.trim().toLowerCase();
    if (t) s.add(t);
  };
  add(primarySport);
  for (const x of sports ?? []) add(x);
  return s;
}

/** Drop interests that duplicate sport chips; title-case labels. */
export function interestsForProfileDisplay(
  interests: string[] | null | undefined,
  primarySport: string | null | undefined,
  sports: string[] | null | undefined,
): string[] {
  const exclude = sportDedupeKeys(primarySport, sports);
  const out: string[] = [];
  for (const raw of interests ?? []) {
    const t = raw.trim();
    if (!t) continue;
    if (exclude.has(t.toLowerCase())) continue;
    const cap = t
      .split(/[\s_-]+/)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .filter(Boolean)
      .join(' ');
    if (cap) out.push(cap);
  }
  return out;
}

export const PROFILE_EMPTY_BIO = 'Nothing added yet.';
export const PROFILE_EMPTY_BIO_PUBLIC = "This member hasn't added a bio yet.";
export const PROFILE_EMPTY_INTERESTS = 'Nothing added yet.';
export const PROFILE_EMPTY_INTERESTS_PUBLIC = "This member hasn't listed interests yet.";
