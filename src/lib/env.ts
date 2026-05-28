import Constants from 'expo-constants';
import { BRAND_WEB_ORIGIN } from '../constants/brand';

type ExtraShape = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function trimExtra(x: unknown): ExtraShape {
  if (!x || typeof x !== 'object') return {};
  const o = x as Record<string, unknown>;
  return {
    supabaseUrl: typeof o.supabaseUrl === 'string' ? o.supabaseUrl : '',
    supabaseAnonKey: typeof o.supabaseAnonKey === 'string' ? o.supabaseAnonKey : '',
  };
}

/**
 * Resolve `expo.extra` from every place Expo / dev-client may put it.
 * Dev launcher often serves manifest2 where config lives under `extra.expoClient`.
 */
function fromExpoExtra(): ExtraShape {
  const expoConfig = Constants.expoConfig as Record<string, unknown> | null | undefined;
  if (expoConfig?.extra) {
    const e = trimExtra(expoConfig.extra);
    if (e.supabaseUrl && e.supabaseAnonKey) return e;
  }

  const manifest = Constants.manifest as Record<string, unknown> | null | undefined;
  if (manifest?.extra) {
    const e = trimExtra(manifest.extra);
    if (e.supabaseUrl && e.supabaseAnonKey) return e;
  }

  // manifest2 (EAS Update / dev client): extra.expoClient holds the full app config
  const m2 = Constants.manifest2 as
    | {
        extra?: { expoClient?: { extra?: unknown } };
      }
    | null
    | undefined;
  const nested = m2?.extra?.expoClient?.extra;
  if (nested) {
    const e = trimExtra(nested);
    if (e.supabaseUrl && e.supabaseAnonKey) return e;
  }

  if (expoConfig?.extra) return trimExtra(expoConfig.extra);
  if (manifest?.extra) return trimExtra(manifest.extra);
  if (m2?.extra?.expoClient?.extra) return trimExtra(m2.extra.expoClient.extra);

  return {};
}

/**
 * Public Supabase config: Metro may inline EXPO_PUBLIC_* from `.env` when bundling.
 * Fallback: `expo.extra` from app.config (refreshed each time Metro evaluates config).
 */
export function getSupabaseUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  if (fromEnv) return fromEnv;
  return (fromExpoExtra().supabaseUrl ?? '').trim();
}

export function getSupabaseAnonKey(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  return (fromExpoExtra().supabaseAnonKey ?? '').trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * When true, the app merges fictional rows for sponsors, events, media browse, and community
 * (see `src/data/appStoreScreenshotSamples.ts`). Set `EXPO_PUBLIC_APP_STORE_SCREENSHOTS=1` in `.env`
 * for App Store / Play Store capture builds only — turn off for production.
 */
export function isAppStoreScreenshotMode(): boolean {
  return process.env.EXPO_PUBLIC_APP_STORE_SCREENSHOTS === '1';
}

/**
 * Fictional media search tiles when Supabase is off. Never in production store builds —
 * enabled for __DEV__, screenshot captures, or explicit `EXPO_PUBLIC_ALLOW_MEDIA_SEARCH_DEMO=1`.
 */
export function allowMediaSearchDemoFallback(): boolean {
  if (isAppStoreScreenshotMode()) return true;
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  const flag = process.env.EXPO_PUBLIC_ALLOW_MEDIA_SEARCH_DEMO;
  return flag === '1' || flag === 'true';
}

export function getApiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
}

/** Public marketing / support website. Used for Legal + Help center linkouts. */
export function getDaltonWebUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_DALTON_WEB_URL ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const expoConfig = Constants.expoConfig as Record<string, unknown> | null | undefined;
  const extra = expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra =
    typeof extra?.daltonWebUrl === 'string' ? extra.daltonWebUrl.trim() : '';
  const merged = fromExtra.replace(/\/$/, '');
  return merged || BRAND_WEB_ORIGIN;
}

/**
 * HMAC secret for QR ticket tokens. In production, **must** be set to a long random value
 * matching server `TICKET_HMAC_SECRET` (see docs/QR_CHECKIN.md). Dev-only fallback when unset.
 */
export function getTicketSigningSecret(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_TICKET_SIGNING_SECRET ?? '').trim();
  if (fromEnv) return fromEnv;
  if (__DEV__) return 'dalton-demo-ticket-secret';
  return '';
}

export function getRevenueCatApiKey(): string | undefined {
  const ios = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim();
  const android = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim();
  return ios || android;
}

export function getRevenueCatEntitlementId(): string {
  return (process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'premium').trim() || 'premium';
}

/** Supabase Edge Function `master-delete-user` (JWT + master PIN). Requires SERVICE_ROLE in project secrets. */
export function getMasterDeleteUserEdgeUrl(): string {
  const base = getSupabaseUrl().replace(/\/$/, '');
  return `${base}/functions/v1/master-delete-user`;
}

/** Master PIN check (JWT + PIN). Deploy `verify-master-pin` Edge Function. */
export function getVerifyMasterPinEdgeUrl(): string {
  const base = getSupabaseUrl().replace(/\/$/, '');
  return `${base}/functions/v1/verify-master-pin`;
}

/** Self-serve account deletion (JWT + confirm phrase DELETE). */
export function getDeleteOwnAccountEdgeUrl(): string {
  const base = getSupabaseUrl().replace(/\/$/, '');
  return `${base}/functions/v1/delete-own-account`;
}
