export type CommunitySearchKind = 'all' | 'posts' | 'people';

export function parseCommunitySearchQuery(raw: string): {
  usernameMode: boolean;
  term: string;
} {
  const trimmed = raw.trim();
  if (trimmed.startsWith('@')) {
    return { usernameMode: true, term: trimmed.replace(/^@+/, '').trim() };
  }
  return { usernameMode: false, term: trimmed };
}

export function communitySearchPlaceholder(usernameMode: boolean): string {
  return usernameMode ? 'Search by username' : 'Search posts, people, tags';
}
