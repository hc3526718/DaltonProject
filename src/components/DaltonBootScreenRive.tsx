import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { DaltonBootRiveError } from './DaltonBootRivePlayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hideNativeSplashWhenBootVisualReady } from '../boot/nativeSplashGate';
import { MAX_NATIVE_SPLASH_WAIT_MS } from '../constants/bootTiming';
import {
  BOOT_RIVE_EMBED_LOGO_SCALE,
  BOOT_USE_RIVE,
  getDaltonBootRiveDisplayMode,
} from '../constants/riveBoot';
import { DS } from '../designSystem';
import { BootCircleLoader } from './BootCircleLoader';
import { BouncingBrandLogo } from './BouncingBrandLogo';
import { DaltonBootRiveDisplay } from './DaltonBootRiveDisplay';

/** Rive boot — native splash hides when Rive paints or bounce fallback (see `nativeSplashGate`). */
export function DaltonBootScreenRive() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [riveFailed, setRiveFailed] = useState(false);
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const mode = getDaltonBootRiveDisplayMode();

  const riveStyle = useMemo(() => {
    const base = Math.min(320, Math.round(width * 0.78));
    if (mode === 'embed') {
      const target = Math.round(base * Math.max(BOOT_RIVE_EMBED_LOGO_SCALE, 2.8));
      const outer = Math.min(target, Math.round(width * 0.98));
      return { width: outer, height: outer, maxWidth: '98%' as const };
    }
    const box = Math.min(380, Math.round(width * 0.88));
    return { width: box, height: box, maxWidth: '92%' as const };
  }, [width, mode]);

  const bounceSize = Math.min(200, Math.round(width * 0.5));
  const useRive = BOOT_USE_RIVE && !riveFailed;
  /** Expo Go has no native Rive → bounce only. */
  const bounceOnlyExpoGo = expoGo && mode === 'bundled';

  const onNativeError = useCallback((_e: DaltonBootRiveError) => setRiveFailed(true), []);
  const onEmbedError = useCallback(() => setRiveFailed(true), []);

  useEffect(() => {
    const t = setTimeout(() => hideNativeSplashWhenBootVisualReady(), MAX_NATIVE_SPLASH_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  /** Dismiss native splash as soon as this boot layer is mounted (same #0A0A0A as splash). */
  useLayoutEffect(() => {
    if (!useRive || bounceOnlyExpoGo) return;
    const id = requestAnimationFrame(() => hideNativeSplashWhenBootVisualReady());
    return () => cancelAnimationFrame(id);
  }, [useRive, bounceOnlyExpoGo]);

  useEffect(() => {
    if (useRive) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => hideNativeSplashWhenBootVisualReady());
    });
    return () => cancelAnimationFrame(id);
  }, [useRive]);

  useEffect(() => {
    if (!useRive || !bounceOnlyExpoGo) return;
    const id = requestAnimationFrame(() => hideNativeSplashWhenBootVisualReady());
    return () => cancelAnimationFrame(id);
  }, [useRive, bounceOnlyExpoGo]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        {!useRive ? (
          <BouncingBrandLogo width={bounceSize} height={bounceSize} />
        ) : bounceOnlyExpoGo ? (
          <BouncingBrandLogo width={bounceSize} height={bounceSize} />
        ) : (
          <DaltonBootRiveDisplay
            style={riveStyle}
            onNativeError={onNativeError}
            onEmbedError={onEmbedError}
            onBootVisualReady={hideNativeSplashWhenBootVisualReady}
          />
        )}
        <BootCircleLoader />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DS.space.xl,
  },
});
