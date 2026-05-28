import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DaltonBootRiveDisplay } from './DaltonBootRiveDisplay';
import { BouncingBrandLogo } from './BouncingBrandLogo';
import { AppLoadingIndicator } from './AppLoadingIndicator';
import { DS } from '../designSystem';

type Props = {
  /** Height of the hero slot (welcome / auth). */
  height?: number;
};

/**
 * Rive boot animation for auth welcome — embed on web, native/bundled on dev builds.
 * Shows the gold ring loader until Rive is visible; falls back to bounce logo on error.
 */
export function AuthWelcomeRiveHero({ height = 220 }: Props) {
  const [useFallback, setUseFallback] = useState(false);
  const [riveVisible, setRiveVisible] = useState(false);
  const ready = useRef(false);

  const onReady = useCallback(() => {
    ready.current = true;
    setRiveVisible(true);
  }, []);

  const onEmbedError = useCallback(() => {
    if (!ready.current) setUseFallback(true);
  }, []);

  const onNativeError = useCallback(() => {
    setUseFallback(true);
  }, []);

  return (
    <View style={[styles.slot, { height }]}>
      {useFallback ? (
        <BouncingBrandLogo size={160} />
      ) : (
        <>
          {!riveVisible ? (
            <View style={styles.loaderOverlay}>
              <AppLoadingIndicator size={40} />
            </View>
          ) : null}
          <View style={[styles.riveWrap, !riveVisible && styles.riveHidden]}>
            <DaltonBootRiveDisplay
              style={styles.rive}
              onBootVisualReady={onReady}
              onEmbedError={onEmbedError}
              onNativeError={onNativeError}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.color.background,
    zIndex: 2,
  },
  riveWrap: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  riveHidden: {
    opacity: 0,
  },
  rive: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
