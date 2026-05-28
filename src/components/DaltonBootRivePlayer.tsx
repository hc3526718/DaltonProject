import { useCallback, useEffect, useRef, type ElementType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { daltonRiveLayoutProps, getDaltonBootRiveAsset } from '../constants/riveBoot';

/** Same shape as `rive-react-native` `RNRiveError` — defined locally so we never import Rive at module scope (Expo Go). */
export type DaltonBootRiveError = { message: string; type: string };

type Props = {
  style: StyleProp<ViewStyle>;
  onError: (e: DaltonBootRiveError) => void;
  /** First `onPlay` — native splash can hide so the transition matches the running animation. */
  onVisualReady?: () => void;
};

/**
 * Lazy `require('rive-react-native')` so Expo Go never loads the Rive native module unless this mounts.
 */
export function DaltonBootRivePlayer({ style, onError, onVisualReady }: Props) {
  const played = useRef(false);
  const markReady = useCallback(() => {
    if (played.current) return;
    played.current = true;
    onVisualReady?.();
  }, [onVisualReady]);
  const handlePlay = useCallback(
    (_name: string, _sm: boolean) => {
      markReady();
    },
    [markReady],
  );

  useEffect(() => {
    if (!onVisualReady) return;
    const t = setTimeout(() => markReady(), 2200);
    return () => clearTimeout(t);
  }, [onVisualReady, markReady]);

  try {
    const mod = require('rive-react-native') as typeof import('rive-react-native');
    const Rive = mod.default as unknown as ElementType;
    const asset = getDaltonBootRiveAsset();
    const layout = daltonRiveLayoutProps();

    return (
      <Rive
        {...asset}
        style={[style, { backgroundColor: 'transparent' }]}
        autoplay
        fit={mod.Fit.Contain}
        alignment={mod.Alignment.Center}
        {...layout}
        onError={onError}
        onPlay={handlePlay}
      />
    );
  } catch (e) {
    queueMicrotask(() =>
      onError({
        message: e instanceof Error ? e.message : 'rive-react-native require failed',
        type: 'MalformedFile',
      }),
    );
    return null;
  }
}
