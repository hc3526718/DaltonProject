import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import { readLocalFileAsArrayBuffer } from './readLocalFileBytes';

/** Supabase `media_assets` bucket limit (50 MB). */
export const HIGHLIGHT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export type HighlightUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function inferVideoExt(uri: string, fileName?: string): { ext: string; contentType: string } {
  const fromName = fileName?.match(/\.([a-z0-9]+)$/i)?.[1];
  const ext = (fromName ?? uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1] ?? 'mp4').toLowerCase();
  if (ext === 'mov') return { ext: 'mov', contentType: 'video/quicktime' };
  if (ext === 'webm') return { ext: 'webm', contentType: 'video/webm' };
  if (ext === 'm4v') return { ext: 'm4v', contentType: 'video/x-m4v' };
  return { ext: 'mp4', contentType: 'video/mp4' };
}

function formatPhotoLibraryError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/PHPhotosErrorDomain|3164|asset.*not available|cloud/i.test(msg)) {
    return (
      'This video could not be read from Photos. Try “Browse files” instead, download it to Files first, ' +
      'or choose a shorter clip under 50 MB.'
    );
  }
  if (/empty|ENOENT|not found/i.test(msg)) {
    return 'The selected file is empty or unavailable. Pick another video or use Browse files.';
  }
  return msg || 'Could not read this video from your device.';
}

async function measureLocalFileBytes(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    return buf.byteLength;
  }
  try {
    const file = new File(uri);
    const buf = await file.arrayBuffer();
    return buf.byteLength;
  } catch {
    const buf = await readLocalFileAsArrayBuffer(uri);
    return buf.byteLength;
  }
}

/** Upload highlight clip to storage; returns public HTTPS URL. */
export async function uploadHighlightVideo(
  userId: string,
  uri: string,
  fileName?: string,
): Promise<HighlightUploadResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Not connected to the server.' };
  }
  try {
    const byteLength = await measureLocalFileBytes(uri);
    if (byteLength === 0) {
      return { ok: false, error: 'The selected video file is empty.' };
    }
    if (byteLength > HIGHLIGHT_VIDEO_MAX_BYTES) {
      const mb = Math.round(byteLength / (1024 * 1024));
      return {
        ok: false,
        error: `This video is about ${mb} MB. Highlights must be 50 MB or smaller. Try a shorter clip or use Browse files to pick a compressed copy.`,
      };
    }

    const { ext, contentType } = inferVideoExt(uri, fileName);
    const body = await readLocalFileAsArrayBuffer(uri);
    if (body.byteLength === 0) {
      return { ok: false, error: 'Could not read video data from your device.' };
    }
    const storage_path = `profiles/${userId}/highlights/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, body, { contentType, upsert: false });
    if (error) {
      return { ok: false, error: error.message || 'Storage upload failed.' };
    }
    const url = supabase.storage.from('media_assets').getPublicUrl(storage_path).data.publicUrl;
    if (!url) {
      return { ok: false, error: 'Upload succeeded but public URL was missing.' };
    }
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: formatPhotoLibraryError(err) };
  }
}
