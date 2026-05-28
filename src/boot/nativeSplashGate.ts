import * as SplashScreen from 'expo-splash-screen';
import { MAX_NATIVE_SPLASH_WAIT_MS } from '../constants/bootTiming';

let nativeSplashHidden = false;

/** Dismiss the OS splash so React UI is visible (safe to call multiple times). */
export function hideNativeSplash(): void {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;
  void SplashScreen.hideAsync().catch(() => {
    nativeSplashHidden = false;
  });
}

/** @deprecated Prefer `hideNativeSplash` — kept for DaltonBootScreenRive. */
export function hideNativeSplashWhenBootVisualReady(): void {
  hideNativeSplash();
}

/** Failsafe if JS never calls hide (e.g. hung auth). */
export function scheduleNativeSplashFailsafe(): void {
  setTimeout(() => hideNativeSplash(), MAX_NATIVE_SPLASH_WAIT_MS);
}
