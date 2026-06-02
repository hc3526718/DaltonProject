import { BRAND_WEB_ORIGIN } from '../constants/brand';

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

/** HTTPS origin YouTube expects on embed requests (marketing site, not youtube.com). */
export function youTubeEmbedOrigin(origin?: string): string {
  const o = (origin ?? '').trim().replace(/\/$/, '');
  return o || BRAND_WEB_ORIGIN;
}

function embedQuery(videoId: string, origin: string, autoplay: boolean): string {
  const id = encodeURIComponent(videoId);
  const o = encodeURIComponent(youTubeEmbedOrigin(origin));
  const parts = [
    'playsinline=1',
    'rel=0',
    'modestbranding=1',
    'fs=1',
    'enablejsapi=1',
    `origin=${o}`,
    `widget_referrer=${o}`,
  ];
  if (autoplay) parts.unshift('autoplay=1');
  return `https://www.youtube.com/embed/${id}?${parts.join('&')}`;
}

export function youTubeEmbedUrl(videoId: string, origin?: string): string {
  return embedQuery(videoId, youTubeEmbedOrigin(origin), true);
}

/**
 * HTML for react-native-webview — sets referrer policy + realistic base URL (fixes 153 / 152-4).
 */
export function youTubeEmbedHtml(videoId: string, origin?: string): string {
  const embedOrigin = youTubeEmbedOrigin(origin);
  const src = embedQuery(videoId, embedOrigin, true);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<style>
  html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
  iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<iframe
  src="${src}"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
</body>
</html>`;
}

/** Direct embed URI + Referer header (preferred on iOS/Android WebView). */
export function youTubeNativeWebViewSource(
  videoId: string,
  origin?: string,
): { uri: string; headers: { Referer: string } } {
  const embedOrigin = youTubeEmbedOrigin(origin);
  return {
    uri: embedQuery(videoId, embedOrigin, true),
    headers: { Referer: `${embedOrigin}/` },
  };
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
