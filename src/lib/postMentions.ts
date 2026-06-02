import { searchMentionableUsers } from './mentionSearch';

const MENTION_TOKEN = /@([A-Za-z0-9_]{1,32})/g;

export type PostTextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; username: string; raw: string; userId?: string }
  | { kind: 'hashtag'; tag: string; raw: string };

/** Controlled-mentions markup → plain @username for storage/display. */
export function normalizePostBodyForStorage(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
}

export function parsePostTextSegments(text: string): PostTextSegment[] {
  const re = /(@\[([^\]]+)\]\(([^)]+)\))|(@[A-Za-z0-9_]{1,32})|(#[A-Za-z0-9_]{1,32})/g;
  const out: PostTextSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    if (start > last) {
      out.push({ kind: 'text', value: text.slice(last, start) });
    }
    const raw = m[0];
    if (m[1] && m[2] && m[3]) {
      const userId = m[3].trim();
      out.push({
        kind: 'mention',
        username: m[2].trim(),
        userId: /^[0-9a-f-]{36}$/i.test(userId) ? userId : undefined,
        raw,
      });
    } else if (m[4]) {
      out.push({ kind: 'mention', username: m[4].slice(1), raw: m[4] });
    } else if (m[5]) {
      out.push({ kind: 'hashtag', tag: m[5].slice(1), raw: m[5] });
    }
    last = start + raw.length;
  }
  if (last < text.length) {
    out.push({ kind: 'text', value: text.slice(last) });
  }
  return out.length ? out : [{ kind: 'text', value: text }];
}

export function extractMentionUsernames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/@\[([^\]]+)\]\([^)]+\)/g)) {
    const u = m[1]?.trim();
    if (u) names.add(u);
  }
  for (const m of text.matchAll(MENTION_TOKEN)) {
    const u = m[1]?.trim();
    if (u) names.add(u);
  }
  return [...names];
}

export async function resolveUsernameToUserId(username: string): Promise<string | null> {
  const q = username.trim();
  if (!q) return null;
  const rows = await searchMentionableUsers(q);
  const exact = rows.find((r) => r.name.toLowerCase() === q.toLowerCase());
  return exact?.id ?? null;
}

/** Returns first validation error for unknown @mentions, or null if all resolve. */
export async function validateMentionsInText(text: string): Promise<string | null> {
  for (const m of text.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)) {
    const id = m[2]?.trim() ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return `Invalid mention for @${m[1]?.trim() || 'user'}. Pick a name from suggestions.`;
    }
  }
  const names = extractMentionUsernames(text);
  for (const name of names) {
    const id = await resolveUsernameToUserId(name);
    if (!id) {
      return `No account found for @${name}. Pick a name from suggestions or remove the mention.`;
    }
  }
  return null;
}
