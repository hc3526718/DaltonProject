import * as Crypto from 'expo-crypto';
import { getTicketSigningSecret } from '../lib/env';

export type TicketPayloadV1 = {
  v: 1;
  ref: string;
  uid: string;
  eventId?: string;
  /** Unix seconds */
  exp: number;
};

function toBase64Utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function fromBase64Utf8(b: string): string {
  return decodeURIComponent(escape(atob(b)));
}

export async function signTicketPayload(
  payload: TicketPayloadV1,
  secret: string = getTicketSigningSecret(),
): Promise<string> {
  if (!secret.trim()) {
    throw new Error(
      'Ticket signing is not configured. Set EXPO_PUBLIC_TICKET_SIGNING_SECRET (release builds require a strong secret).',
    );
  }
  const json = JSON.stringify(payload);
  const payloadB64 = toBase64Utf8(json);
  const sig = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secret}.${payloadB64}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return `${payloadB64}.${sig}`;
}

export async function verifyTicketToken(
  token: string,
  secret: string = getTicketSigningSecret(),
): Promise<{ ok: true; payload: TicketPayloadV1 } | { ok: false; reason: string }> {
  if (!secret.trim()) {
    return { ok: false, reason: 'Ticket signing not configured' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'Malformed token' };
  const [payloadB64, sig] = parts;
  const expected = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secret}.${payloadB64}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  if (expected !== sig) return { ok: false, reason: 'Invalid signature' };
  let payload: TicketPayloadV1;
  try {
    payload = JSON.parse(fromBase64Utf8(payloadB64)) as TicketPayloadV1;
  } catch {
    return { ok: false, reason: 'Invalid payload' };
  }
  if (payload.v !== 1) return { ok: false, reason: 'Unsupported version' };
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'Expired' };
  return { ok: true, payload };
}
