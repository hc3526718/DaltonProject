import { DaltonBootScreenRive } from './DaltonBootScreenRive';

/**
 * Full-screen boot — Rive **embed** URL (WebView) by default in Expo Go, dev clients, and EAS. Bundled `.riv` only when `EXPO_PUBLIC_RIVE_USE_BUNDLED=1` or embed is disabled.
 * Native splash is dismissed when the boot visual is ready (`nativeSplashGate`).
 */
export function DaltonBootScreen() {
  return <DaltonBootScreenRive />;
}
