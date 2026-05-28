/**
 * Boot / splash timing — keep in sync with `expo-splash-screen` + `DaltonBootScreen`.
 * Native splash image: `./assets/dalton_logo_final_img.png` (see `app.config.js`).
 *
 * **True “only animated, zero static”** on cold start is not achievable with Expo alone: the OS
 * shows a **native** layer until JS runs. The practical approach is what we do here — same PNG
 * and `#0A0A0A` on native splash and first JS frame, then boot Rive (or bounce) + ring for a single *felt*
 * experience. A fully native animated splash would require custom native code (e.g. iOS
 * storyboard + Lottie/Rive at the native layer), outside the JS bundle.
 */
/** Minimum time the in-app boot overlay stays visible (Rive / bounce + ring). Must elapse before handoff to auth/app. */
export const MIN_BOOT_OVERLAY_MS = 5000;

/** Rive Cloud embed: if `onLoadEnd` never fires (WebView/cache/network), fall back to bounce + Sentry. */
export const RIVE_EMBED_LOAD_TIMEOUT_MS = 15000;

/** Hard cap: never block `SplashScreen.hideAsync` past this (boot visual hang). */
export const MAX_NATIVE_SPLASH_WAIT_MS = 8000;

/**
 * Supabase cold start: max wait for `auth.getSession()` (reads SecureStore + may refresh tokens).
 * Used only to **report** slow session restore to Sentry — UI unlocks earlier via `AUTH_BOOT_UNLOCK_MS`.
 */
export const AUTH_GET_SESSION_TIMEOUT_MS = 22000;

/** After this, `AuthProvider` sets `ready` so the navigator can mount even if `getSession()` is slow. */
export const AUTH_BOOT_UNLOCK_MS = 4500;

/** Fade from boot overlay into app after `MIN_BOOT_OVERLAY_MS` + readiness. */
export const BOOT_OVERLAY_FADE_MS = 520;
