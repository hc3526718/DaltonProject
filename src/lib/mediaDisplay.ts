import { Image } from 'react-native';
import type { MediaAssetRow } from '../roadmap/types';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';

export type MediaPresentation = {
  title: string;
  tags: string[];
  description: string;
  category: string | null;
};

function capitalizeWord(w: string): string {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function humanizeSlugWords(slug: string): string {
  const words = slug
    .replace(/\.(mp4|mov|m4v|webm)$/i, '')
    .replace(/^\d{10,}-/, '')
    .replace(/-\d+$/, '')
    .split(/[-_]+/)
    .filter(Boolean);
  if (!words.length) return '';
  const sentence = words.join(' ');
  const cased = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  if (/^(how|what|why|when|where|can|should|do|does|is|are)\b/i.test(sentence) && !/[?.!]$/.test(cased)) {
    return `${cased}?`;
  }
  return cased;
}

function parseTitleAndTagsFromSlug(raw: string): { title: string; tags: string[] } {
  const lower = raw.toLowerCase();
  const idx = lower.indexOf('-tags-');
  if (idx === -1) {
    return { title: humanizeSlugWords(raw), tags: [] };
  }
  const titlePart = raw.slice(0, idx);
  const tagsPart = raw.slice(idx + 6);
  const tagTokens = tagsPart
    .replace(/\.(mp4|mov|m4v|webm)$/i, '')
    .replace(/-\d+$/, '')
    .split(/[-_]+/)
    .filter((t) => t && t !== 'tags');
  return {
    title: humanizeSlugWords(titlePart),
    tags: tagTokens.map(capitalizeWord),
  };
}

/** Human-friendly title from DB title, storage path, or kind. */
export function formatMediaDisplayTitle(
  asset: Pick<MediaAssetRow, 'title' | 'storage_path' | 'kind'> | null | undefined,
  fallback = 'Media',
): string {
  return getMediaPresentation(asset, fallback).title;
}

export function getMediaPresentation(
  asset: Pick<MediaAssetRow, 'title' | 'storage_path' | 'description' | 'tags' | 'kind'> | null | undefined,
  fallback = 'Media',
): MediaPresentation {
  const raw = (asset?.title?.trim() || asset?.storage_path?.split('/').pop() || fallback || '').trim();
  const desc = (asset?.description ?? '').trim();
  const categoryMatch = desc.match(/(?:^|\n)Category:\s*([^\n]+)\s*(?:\n|$)/i);
  const category = categoryMatch?.[1]?.trim() || null;
  const description = desc.replace(/\n*Category:\s*[^\n]+\s*/gi, '\n').trim();

  const dbTags = Array.isArray(asset?.tags)
    ? asset.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];

  if (!raw) {
    return { title: fallback || 'Media', tags: dbTags, description, category };
  }

  const looksLikeSlug =
    raw.match(/\.(mp4|mov|m4v|webm)$/i) ||
    raw.match(/^\d{10,}-/) ||
    raw.includes('-tags-');

  if (looksLikeSlug) {
    const parsed = parseTitleAndTagsFromSlug(raw);
    return {
      title: parsed.title || fallback || 'Media',
      tags: dbTags.length ? dbTags : parsed.tags,
      description,
      category,
    };
  }

  return {
    title: raw,
    tags: dbTags,
    description,
    category,
  };
}

/** Default still when a video has no custom thumbnail (library grid + continue watching). */
export const DEFAULT_VIDEO_THUMBNAIL_URI =
  Image.resolveAssetSource(DALTON_LOGO_FINAL_IMG).uri;

export function mediaThumbnailUri(
  asset: Pick<MediaAssetRow, 'thumbnail_url' | 'public_url' | 'kind'>,
): string | null {
  const thumb = asset.thumbnail_url?.trim();
  if (thumb) return thumb;
  const pub = asset.public_url?.trim() || '';
  if (pub && !pub.match(/\.(mp4|mov|m4v|webm)(\?|$)/i)) return pub;
  if (isVideoMediaAsset(asset)) return DEFAULT_VIDEO_THUMBNAIL_URI;
  return null;
}

/** Thumbnail for UI lists — never null for video assets. */
export function mediaThumbnailUriForDisplay(
  asset: Pick<MediaAssetRow, 'thumbnail_url' | 'public_url' | 'kind'>,
  fallback = DEFAULT_VIDEO_THUMBNAIL_URI,
): string {
  return mediaThumbnailUri(asset) ?? fallback;
}

export function isVideoMediaAsset(asset: Pick<MediaAssetRow, 'kind' | 'public_url'>): boolean {
  if (asset.kind === 'video') return true;
  const pub = asset.public_url?.trim() || '';
  return !!pub.match(/\.(mp4|mov|m4v|webm)(\?|$)/i);
}
