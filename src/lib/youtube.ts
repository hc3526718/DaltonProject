/** Parse common YouTube URL shapes into a video id. */
export function parseYouTubeVideoId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{6,}$/.test(v)) return v;
      const embed = u.pathname.match(/\/embed\/([\w-]{6,})/);
      if (embed?.[1]) return embed[1];
      const shorts = u.pathname.match(/\/shorts\/([\w-]{6,})/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    const bare = raw.match(/^[\w-]{11}$/);
    if (bare) return bare[0];
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return parseYouTubeVideoId(url) != null;
}

export function youTubeThumbnailUrl(videoId: string, quality: 'default' | 'hq' | 'mq' = 'hq'): string {
  const map = { default: 'default', hq: 'hqdefault', mq: 'mqdefault' } as const;
  return `https://img.youtube.com/vi/${videoId}/${map[quality]}.jpg`;
}

export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
