import * as Crypto from 'expo-crypto';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BRAND_WEB_ORIGIN } from '../constants/brand';
import { getDaltonWebUrl } from '../lib/env';

WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth redirect must match Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 * - Native: `dalton-demo://auth/callback` (scheme from app.config.js)
 * - Web (Vercel): `https://daltongrantacademy.vercel.app/app/auth/callback`
 */
export function getOAuthRedirectUri(): string {
  const explicit = (process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL ?? '').trim();
  if (explicit) return explicit;

  if (Platform.OS === 'web') {
    const basePath = (process.env.EXPO_PUBLIC_WEB_BASE_PATH ?? '/app').replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${basePath}/auth/callback`;
    }
    const marketing = getDaltonWebUrl();
    if (marketing) return `${marketing}${basePath}/auth/callback`;
    return `${BRAND_WEB_ORIGIN}${basePath}/auth/callback`;
  }

  return Linking.createURL('auth/callback');
}

/** Reject forged OAuth returns (wrong scheme on native, wrong origin on web). */
export function isOAuthReturnUrlTrusted(returnUrl: string, redirectTo: string): boolean {
  if (Platform.OS === 'web') {
    try {
      const a = new URL(returnUrl);
      const b = new URL(redirectTo);
      return a.origin === b.origin && a.pathname === b.pathname;
    } catch {
      return false;
    }
  }
  try {
    const a = Linking.parse(returnUrl);
    const b = Linking.parse(redirectTo);
    if (!a.scheme || !b.scheme) return false;
    return a.scheme === b.scheme;
  } catch {
    return false;
  }
}

/**
 * PKCE `code` — query string, hash, or `Linking.parse` quirks on custom schemes.
 * Prefer regex on decoded URL so we never miss `?code=` / `#code=` / `&code=`.
 */
export function parseOAuthCodeFromReturnUrl(returnUrl: string): string | null {
  const chunks: string[] = [returnUrl];
  const hash = returnUrl.indexOf('#');
  if (hash >= 0) {
    chunks.push(returnUrl.slice(hash + 1));
  }
  for (const chunk of chunks) {
    let decoded = chunk;
    try {
      decoded = decodeURIComponent(chunk);
    } catch {
      decoded = chunk;
    }
    const m = decoded.match(/(?:^|[?#&])code=([^&#]+)/);
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  }
  const parsed = Linking.parse(returnUrl);
  const codeRaw = parsed.queryParams?.code;
  const fromQuery = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw;
  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    return fromQuery;
  }
  return null;
}

/** Some mobile OAuth flows return tokens in the fragment instead of a PKCE `code`. */
async function tryImplicitSessionFromReturnUrl(
  supabase: SupabaseClient,
  returnUrl: string,
): Promise<boolean> {
  const hashIdx = returnUrl.indexOf('#');
  const frag = hashIdx >= 0 ? returnUrl.slice(hashIdx + 1) : '';
  if (!frag) return false;
  const qs = frag.startsWith('?') ? frag.slice(1) : frag;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  try {
    const params = new URLSearchParams(qs);
    accessToken = params.get('access_token');
    refreshToken = params.get('refresh_token');
  } catch {
    return false;
  }
  if (!accessToken || !refreshToken) return false;
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return !error;
}

function isPkceVerifierMissingError(message: string): boolean {
  return /code verifier not found/i.test(message);
}

/** Read PKCE `code` from the current browser URL (OAuth callback on web). */
export function readOAuthCodeFromWebLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return parseOAuthCodeFromReturnUrl(window.location.href);
}

/** After sign-in, leave `/app/auth/callback` and drop auth query params from the address bar. */
export function cleanupWebAuthUrlAfterSignIn(): void {
  if (typeof window === 'undefined') return;
  const basePath = (process.env.EXPO_PUBLIC_WEB_BASE_PATH ?? '/app').replace(/\/$/, '');
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const onCallback = path === `${basePath}/auth/callback` || path.endsWith('/auth/callback');
  const nextPath = onCallback ? `${basePath}/` : path;
  window.history.replaceState({}, document.title, nextPath);
}

let webOAuthExchangePromise: Promise<{ exchanged: boolean; error?: string }> | null =
  null;

/**
 * Exchange OAuth callback `code` for a session on web.
 * Must run before stripping `?code=` from the URL.
 */
export async function completeWebOAuthSessionIfNeeded(
  supabase: SupabaseClient,
): Promise<{ exchanged: boolean; error?: string }> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { exchanged: false };
  }
  if (webOAuthExchangePromise) return webOAuthExchangePromise;

  webOAuthExchangePromise = (async () => {
    const returnUrl = window.location.href;
    const code = parseOAuthCodeFromReturnUrl(returnUrl);
    if (code) {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        cleanupWebAuthUrlAfterSignIn();
        return { exchanged: true };
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (isPkceVerifierMissingError(error.message)) {
          const { data: after } = await supabase.auth.getSession();
          if (after.session) {
            cleanupWebAuthUrlAfterSignIn();
            return { exchanged: true };
          }
        }
        return { exchanged: true, error: error.message };
      }
      cleanupWebAuthUrlAfterSignIn();
      return { exchanged: true };
    }
    const implicitOk = await tryImplicitSessionFromReturnUrl(supabase, returnUrl);
    if (implicitOk) {
      if (typeof window !== 'undefined') {
        const qs = `${window.location.hash}${window.location.search}`;
        if (/type=recovery/i.test(qs)) {
          try {
            sessionStorage.setItem('dga_auth_recovery_pending', '1');
          } catch {
            /* private mode */
          }
        }
      }
      cleanupWebAuthUrlAfterSignIn();
      return { exchanged: true };
    }
    return { exchanged: false };
  })();

  try {
    return await webOAuthExchangePromise;
  } finally {
    webOAuthExchangePromise = null;
  }
}

/**
 * Shared callback URL for OAuth, **email sign-up confirmation**, and **password recovery** links.
 * Call from native deep links (`auth/callback`) with the opened URL.
 */
export async function ingestSessionFromAuthCallbackUrl(
  supabase: SupabaseClient,
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const code = parseOAuthCodeFromReturnUrl(url);
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && !isPkceVerifierMissingError(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
  const implicitOk = await tryImplicitSessionFromReturnUrl(supabase, url);
  return implicitOk ? { ok: true } : { ok: false, error: 'missing_tokens' };
}

export async function signInWithGoogleOAuth(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const redirectTo = getOAuthRedirectUri();

  if (Platform.OS === 'web') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return { ok: false, message: error.message };
    const url = data?.url;
    if (url && typeof window !== 'undefined') {
      window.location.assign(url);
      return { ok: true };
    }
    return {
      ok: false,
      message:
        'Google sign-in could not start. Check Supabase Google provider and redirect URL: ' +
        redirectTo,
    };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (!data.url) return { ok: false, message: 'No OAuth URL returned' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel') return { ok: false, message: 'Sign in cancelled' };
  if (result.type !== 'success' || !result.url) {
    return { ok: false, message: 'Could not complete Google sign in' };
  }
  if (!isOAuthReturnUrlTrusted(result.url, redirectTo)) {
    return { ok: false, message: 'Unexpected sign-in redirect' };
  }

  const code = parseOAuthCodeFromReturnUrl(result.url);
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { ok: false, message: exchangeError.message };
    return { ok: true };
  }

  const implicitOk = await tryImplicitSessionFromReturnUrl(supabase, result.url);
  if (implicitOk) {
    return { ok: true };
  }

  const parsed = Linking.parse(result.url);
  const errDesc = parsed.queryParams?.error_description;
  const err = parsed.queryParams?.error;
  if (err || errDesc) {
    const msg = Array.isArray(errDesc) ? errDesc[0] : errDesc;
    return { ok: false, message: msg || String(err) };
  }

  if (__DEV__) {
    console.warn(
      '[OAuth] Google redirect had no PKCE code. redirectTo=',
      redirectTo,
      'returnUrl(start)=',
      result.url.slice(0, 240),
    );
  }
  return {
    ok: false,
    message:
      'No authorization code in redirect. Add this exact URL to Supabase → Auth → Redirect URLs: ' +
      redirectTo,
  };
}

export async function signInWithAppleNative(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Platform.OS !== 'ios') {
    return { ok: false, message: 'Apple Sign In is only available on iOS' };
  }
  /** Static import loads native code and crashes Expo Go when the bundle evaluates. */
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return {
      ok: false,
      message:
        'Apple Sign In is not available in Expo Go. Create a development build: https://docs.expo.dev/develop/development-builds/introduction/',
    };
  }

  let AppleAuthentication: typeof import('expo-apple-authentication');
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch {
    return {
      ok: false,
      message: 'Sign in with Apple native module is missing. Rebuild with EAS or npx expo run:ios.',
    };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { ok: false, message: 'Apple Sign In is not available on this device' };
    }

    const rawNonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
      { encoding: Crypto.CryptoEncoding.HEX },
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { ok: false, message: 'Apple did not return an identity token' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, message: 'Sign in cancelled' };
    }
    const msg = e instanceof Error ? e.message : 'Apple sign in failed';
    return { ok: false, message: msg };
  }
}
