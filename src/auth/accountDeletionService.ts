import { getDeleteOwnAccountEdgeUrl, getSupabaseAnonKey } from '../lib/env';

export type DeleteOwnAccountResult =
  | { ok: true }
  | { ok: false; message: string };

/** Permanently deletes the signed-in user (requires confirm phrase DELETE). */
export async function deleteOwnAccount(
  accessToken: string,
  confirmPhrase: string,
): Promise<DeleteOwnAccountResult> {
  const url = getDeleteOwnAccountEdgeUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    return { ok: false, message: 'Account deletion is not configured.' };
  }
  if (confirmPhrase.trim().toUpperCase() !== 'DELETE') {
    return { ok: false, message: 'Type DELETE to confirm.' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm_phrase: confirmPhrase.trim() }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    if (!res.ok) {
      return { ok: false, message: json.error ?? `Request failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, message: msg };
  }
}
