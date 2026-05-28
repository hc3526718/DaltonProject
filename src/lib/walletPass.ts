/**
 * Client helper: download a signed .pkpass and open the Apple Wallet sheet (iOS only).
 */
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';
import { getSupabase } from './supabase';
import { getSupabaseUrl } from './env';

export type WalletPassInput = {
  bookingId: string;
  reference?: string;
};

export async function addEventPassToAppleWallet(input: WalletPassInput): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const supabase = getSupabase();
  if (!supabase) {
    Alert.alert('Wallet unavailable', 'Sign in to add your pass to Apple Wallet.');
    return;
  }

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    Alert.alert('Wallet unavailable', 'Sign in to add your pass to Apple Wallet.');
    return;
  }

  const base = getSupabaseUrl()?.replace(/\/$/, '');
  if (!base) {
    Alert.alert('Wallet unavailable', 'Server URL is not configured.');
    return;
  }

  try {
    const res = await fetch(`${base}/functions/v1/wallet-generate-pass`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookingId: input.bookingId, reference: input.reference }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      const msg =
        errBody?.message ??
        errBody?.error ??
        (res.status === 503
          ? 'Apple Wallet signing is not configured on the server yet.'
          : 'Could not generate your pass.');
      Alert.alert('Apple Wallet', msg);
      return;
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/vnd.apple.pkpass')) {
      const buf = await res.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const passPath = `${FileSystem.cacheDirectory}event-${input.bookingId}.pkpass`;
      await FileSystem.writeAsStringAsync(passPath, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Linking.openURL(passPath);
      return;
    }

    const json = (await res.json()) as { signedUrl?: string; error?: string };
    if (json.signedUrl) {
      const passPath = `${FileSystem.cacheDirectory}event-${input.bookingId}.pkpass`;
      await FileSystem.downloadAsync(json.signedUrl, passPath);
      await Linking.openURL(passPath);
      return;
    }

    Alert.alert('Apple Wallet', json.error ?? 'Pass could not be generated.');
  } catch (e) {
    Alert.alert('Apple Wallet', e instanceof Error ? e.message : 'Something went wrong.');
  }
}
