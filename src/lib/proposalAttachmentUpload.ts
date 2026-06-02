import { getSupabase } from './supabase';
import { readLocalFileAsArrayBuffer } from './readLocalFileBytes';

function inferExt(uri: string, fallback: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = m?.[1]?.toLowerCase();
  if (ext && ext.length <= 8 && /^[a-z0-9]+$/.test(ext)) return ext;
  return fallback;
}

function inferContentType(uri: string, fileName?: string): string {
  const ext = inferExt(uri, fileName?.split('.').pop()?.toLowerCase() ?? 'bin');
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Upload proposal supplementary file to `media_assets` bucket. */
export async function uploadProposalAttachment(
  userId: string,
  proposalKind: string,
  localUri: string,
  fileName?: string,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const contentType = inferContentType(localUri, fileName);
    const body = await readLocalFileAsArrayBuffer(localUri);
    if (body.byteLength === 0) {
      if (__DEV__) console.warn('[uploadProposalAttachment] empty file', localUri);
      return null;
    }
    const ext = inferExt(localUri, fileName?.split('.').pop() ?? 'jpg');
    const rand = Math.random().toString(36).slice(2, 8);
    const storage_path = `proposals/${userId}/${proposalKind}-${Date.now()}-${rand}.${ext}`;
    const { error } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, body, { contentType, upsert: false });
    if (error) {
      if (__DEV__) console.warn('[uploadProposalAttachment]', error.message);
      return null;
    }
    if (__DEV__) {
      console.log('[uploadProposalAttachment] ok', { bytes: body.byteLength, storage_path });
    }
    const pub = supabase.storage.from('media_assets').getPublicUrl(storage_path);
    return pub.data.publicUrl ?? null;
  } catch (e) {
    if (__DEV__) console.warn('[uploadProposalAttachment]', e);
    return null;
  }
}
