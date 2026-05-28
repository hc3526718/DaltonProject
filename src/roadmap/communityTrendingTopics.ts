import { parsePostBody } from '../lib/communityPostBody';
import type { CommunityPostFeedRow } from './liveDataService';

export type TrendingTopicRow = {
  topic: string;
  count: number;
  label: string;
};

const FALLBACK: TrendingTopicRow[] = [
  { topic: 'nutrition tips', count: 0, label: 'Popular search' },
  { topic: 'recovery methods', count: 0, label: 'Popular search' },
  { topic: 'block start', count: 0, label: 'Popular search' },
];

function extractHashtags(text: string): string[] {
  const tags: string[] = [];
  const re = /#([\w][\w-]{1,48})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tags.push(m[1].toLowerCase());
  }
  return tags;
}

/** Derive trending tags from recent post bodies; merge with common search phrases. */
export function buildTrendingTopicsFromPosts(
  posts: CommunityPostFeedRow[],
  limit = 10,
): TrendingTopicRow[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const { displayBody } = parsePostBody(p.body);
    for (const tag of extractHashtags(displayBody)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const words = displayBody
      .toLowerCase()
      .replace(/#[\w-]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && w.length <= 24);
    for (const w of words.slice(0, 8)) {
      if (/^\d+$/.test(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }

  const fromPosts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({
      topic,
      count,
      label: count === 1 ? '1 mention' : `${count} mentions`,
    }));

  if (fromPosts.length >= 4) return fromPosts;

  const seen = new Set(fromPosts.map((t) => t.topic));
  const merged = [...fromPosts];
  for (const fb of FALLBACK) {
    if (merged.length >= limit) break;
    if (seen.has(fb.topic)) continue;
    merged.push(fb);
    seen.add(fb.topic);
  }
  return merged;
}
