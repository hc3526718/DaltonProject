import * as ImagePicker from 'expo-image-picker';

export const MAX_COMPOSER_IMAGES = 7;
export const MAX_COMPOSER_VIDEOS = 2;
export const MAX_COMPOSER_VIDEO_MS = 30_000;

export type ComposerMedia = {
  kind: 'image' | 'video';
  uri: string;
  durationMs?: number;
  mimeType?: string;
};

export function clampComposerMedia(items: ComposerMedia[]): ComposerMedia[] {
  const vids = items.filter((m) => m.kind === 'video').slice(0, MAX_COMPOSER_VIDEOS);
  const imgs = items.filter((m) => m.kind === 'image').slice(0, MAX_COMPOSER_IMAGES);
  return [...vids, ...imgs].slice(0, MAX_COMPOSER_IMAGES + MAX_COMPOSER_VIDEOS);
}

export function pickerAssetIsVideo(a: ImagePicker.ImagePickerAsset): boolean {
  const mt = (a.mimeType ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const t = (a as { type?: string }).type;
  return t === 'video';
}

export function pickerVideoDurationMs(a: ImagePicker.ImagePickerAsset): number | undefined {
  if (!pickerAssetIsVideo(a)) return undefined;
  if (typeof a.duration !== 'number' || Number.isNaN(a.duration)) return MAX_COMPOSER_VIDEO_MS;
  return Math.round(a.duration * 1000);
}

export function inferContentType(kind: ComposerMedia['kind'], uri: string): string {
  const u = uri.toLowerCase();
  if (kind === 'image') {
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
  if (u.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

export function inferExt(kind: ComposerMedia['kind'], uri: string): string {
  const u = uri.toLowerCase();
  const dot = u.lastIndexOf('.');
  const ext = dot !== -1 ? u.slice(dot + 1).split('?')[0] : '';
  if (ext && ext.length <= 5) return ext;
  return kind === 'image' ? 'jpg' : 'mp4';
}
