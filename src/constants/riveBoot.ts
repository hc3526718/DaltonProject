import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { DS } from '../designSystem';

/**
 * Official Rive runtimes (same `.riv` / renderer model; RN wraps native iOS + Android):
 * - React Native: https://rive.app/docs/runtimes/react-native/react-native
 * - Expo setup: https://rive.app/docs/runtimes/react-native/adding-rive-to-expo
 * - Apple (iOS): https://rive.app/docs/runtimes/apple/apple
 * - Android: https://rive.app/docs/runtimes/android/android
 *
 * Boot / pull-to-refresh Rive:
 * - **bundled** (default): local `dalton_animated_logo.riv` — native `rive-react-native`, web `@rive-app/react-canvas` (no grey embed iframe).
 * - **embed**: set `EXPO_PUBLIC_RIVE_FORCE_EMBED=1` — Rive Cloud WebView (Expo Go fallback when embed not disabled).
 * - **native-url**: `EXPO_PUBLIC_RIVE_URL` + `EXPO_PUBLIC_RIVE_USE_NATIVE_URL=1` for HTTPS-hosted `.riv` in the native player.
 */
export const DALTON_BOOT_RIVE = require('../../assets/dalton_animated_logo.riv');

export const DALTON_RIVE_EMBED_DEFAULT =
  'https://rive.app/s/2b5r5odTC0qRPicJRWg9Kw/embed?runtime=rive-renderer';

export const BOOT_PAGE_BACKGROUND = DS.color.background;

function readEmbedScale(): number {
  const raw = process.env.EXPO_PUBLIC_RIVE_EMBED_SCALE;
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (t.length) {
    const n = Number(t);
    if (Number.isFinite(n) && n >= 1.25 && n <= 5.5) return n;
  }
  return 3.5;
}

export const BOOT_RIVE_EMBED_LOGO_SCALE = readEmbedScale();

function envTrim(name: string): string | undefined {
  const v = process.env[name];
  const t = typeof v === 'string' ? v.trim() : '';
  return t.length ? t : undefined;
}

export const DALTON_BOOT_ARTBOARD = envTrim('EXPO_PUBLIC_RIVE_ARTBOARD');
export const DALTON_BOOT_STATE_MACHINE = envTrim('EXPO_PUBLIC_RIVE_STATE_MACHINE');
export const DALTON_BOOT_ANIMATION = envTrim('EXPO_PUBLIC_RIVE_ANIMATION');
export const DALTON_BOOT_RIVE_URL = envTrim('EXPO_PUBLIC_RIVE_URL');
export const DALTON_BOOT_RIVE_EMBED_URL = envTrim('EXPO_PUBLIC_RIVE_EMBED_URL');

export const BOOT_USE_RIVE = process.env.EXPO_PUBLIC_BOOT_USE_RIVE !== '0';
export const RIVE_EMBED_DISABLED = process.env.EXPO_PUBLIC_RIVE_DISABLE_EMBED === '1';
const RIVE_FORCE_EMBED = process.env.EXPO_PUBLIC_RIVE_FORCE_EMBED === '1';

function useBundledRiveFile(): boolean {
  return envTrim('EXPO_PUBLIC_RIVE_USE_BUNDLED') === '1';
}

export function daltonRiveLayoutProps() {
  return {
    ...(DALTON_BOOT_ARTBOARD ? { artboardName: DALTON_BOOT_ARTBOARD } : {}),
    ...(DALTON_BOOT_STATE_MACHINE ? { stateMachineName: DALTON_BOOT_STATE_MACHINE } : {}),
    ...(DALTON_BOOT_ANIMATION ? { animationName: DALTON_BOOT_ANIMATION } : {}),
  };
}

export function getDaltonBootRiveEmbedUri(): string {
  const fromEnv = DALTON_BOOT_RIVE_EMBED_URL;
  if (fromEnv && /^https:\/\//i.test(fromEnv)) return fromEnv;
  return DALTON_RIVE_EMBED_DEFAULT;
}

export type DaltonBootRiveDisplayMode = 'native-url' | 'embed' | 'bundled';

export function getDaltonBootRiveDisplayMode(): DaltonBootRiveDisplayMode {
  if (!BOOT_USE_RIVE) return 'bundled';
  if (RIVE_FORCE_EMBED) return 'embed';
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (expoGo) {
    return RIVE_EMBED_DISABLED ? 'bundled' : 'embed';
  }
  const riv = DALTON_BOOT_RIVE_URL;
  if (
    riv &&
    /^https:\/\//i.test(riv) &&
    /\.riv($|\?)/i.test(riv) &&
    envTrim('EXPO_PUBLIC_RIVE_USE_NATIVE_URL') === '1'
  ) {
    return 'native-url';
  }
  if (RIVE_EMBED_DISABLED || useBundledRiveFile() || Platform.OS === 'web') {
    return 'bundled';
  }
  return 'bundled';
}

export function getDaltonBootRiveAsset(): { url: string } | { source: number } {
  const u = DALTON_BOOT_RIVE_URL;
  if (u && /^https:\/\//i.test(u) && /\.riv($|\?)/i.test(u)) {
    return { url: u };
  }
  return { source: DALTON_BOOT_RIVE };
}
