/** Completed hashtag token: `#word` followed by whitespace or end of string. */
const COMPLETE_HASHTAG = /(?:^|\s)#([a-zA-Z0-9_]{1,32})(?=\s|$)/g;

/** Draft hashtag still being typed at end of caption. */
const PENDING_HASHTAG = /#([a-zA-Z0-9_]*)$/;

export type HashtagPeelResult = {
  body: string;
  addedTags: string[];
  pendingTag: string | null;
};

/**
 * Pull completed `#tags` out of caption body into the hashtag tray.
 * Incomplete `#partial` at the end stays visible as pending until user finishes with space.
 */
export function peelHashtagsFromCaption(input: string): HashtagPeelResult {
  const addedTags: string[] = [];
  let pendingTag: string | null = null;

  let body = input;
  body = body.replace(COMPLETE_HASHTAG, (_, tag: string) => {
    addedTags.push(tag);
    return ' ';
  });

  const pending = body.match(PENDING_HASHTAG);
  if (pending) {
    pendingTag = pending[1] || null;
    body = body.slice(0, pending.index ?? body.length);
  }

  body = body.replace(/\s+/g, ' ').trim();
  return { body, addedTags, pendingTag };
}

export function buildCaptionPlainText(body: string, hashtags: string[]): string {
  const tagLine = hashtags.map((t) => `#${t}`).join(' ');
  return [body.trim(), tagLine].filter(Boolean).join('\n\n');
}

export function removeHashtag(hashtags: string[], tag: string): string[] {
  return hashtags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
}
