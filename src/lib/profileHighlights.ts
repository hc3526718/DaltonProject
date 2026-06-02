import {
  isYouTubeUrl,
  parseYouTubeVideoId,
  youTubeEmbedUrl,
  youTubeThumbnailUrl,
  youTubeWatchUrl,
} from './youtube';

export type ProfileHighlight = {
  title: string;
  video_url: string;
  thumbnail_url?: string;
};

export function parseProfileHighlights(value: unknown): ProfileHighlight[] {
  if (!Array.isArray(value)) return [];
  const out: ProfileHighlight[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (title) out.push({ title, video_url: '' });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      title?: unknown;
      video_url?: unknown;
      videoUrl?: unknown;
      thumbnail_url?: unknown;
    };
    const title = String(row.title ?? '').trim();
    const video_url = String(row.video_url ?? row.videoUrl ?? '').trim();
    const thumbnail_url =
      typeof row.thumbnail_url === 'string' ? row.thumbnail_url.trim() : undefined;
    if (title || video_url) {
      out.push({
        title: title || 'Highlight',
        video_url,
        thumbnail_url: thumbnail_url || undefined,
      });
    }
  }
  return out.slice(0, 12);
}

export function highlightsToJson(rows: ProfileHighlight[]): ProfileHighlight[] {
  return rows
    .map((r) => ({
      title: r.title.trim(),
      video_url: r.video_url.trim(),
      ...(() => {
        const explicit = r.thumbnail_url?.trim() ? resolveHighlightThumbnailUrl(r.video_url, r.thumbnail_url) : null;
        if (explicit) return { thumbnail_url: explicit };
        if (r.video_url.trim()) {
          const inferred = resolveHighlightThumbnailUrl(r.video_url);
          if (inferred) return { thumbnail_url: inferred };
        }
        return {};
      })(),
    }))
    .filter((r) => r.title.length > 0)
    .slice(0, 12);
}

/** Direct upload (Supabase storage / HTTPS file), not a YouTube link. */
export function isUploadedHighlightMedia(url: string): boolean {
  const u = url.trim();
  if (!u || isYouTubeUrl(u)) return false;
  return /^https?:\/\//i.test(u);
}

export function highlightTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base || 'Highlight';
}

export function isPlayableVideoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (isYouTubeUrl(u)) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveHighlightPlaybackUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const yt = parseYouTubeVideoId(u);
  if (yt) return youTubeEmbedUrl(yt);
  if (isPlayableVideoUrl(u)) return u;
  return null;
}

export function resolveHighlightThumbnailUrl(url: string, existing?: string | null): string | null {
  if (existing?.trim()) return existing.trim();
  const yt = parseYouTubeVideoId(url);
  if (yt) return youTubeThumbnailUrl(yt, 'hq');
  if (isUploadedHighlightMedia(url)) return null;
  return null;
}

export function resolveHighlightOpenUrl(url: string): string | null {
  const yt = parseYouTubeVideoId(url);
  if (yt) return youTubeWatchUrl(yt);
  if (isPlayableVideoUrl(url)) return url.trim();
  return null;
}
