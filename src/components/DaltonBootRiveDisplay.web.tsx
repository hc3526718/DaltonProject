import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { Alignment, Fit, Layout, useRive } from '@rive-app/react-canvas';
import type { DaltonBootRiveError } from './DaltonBootRivePlayer';
import { BOOT_USE_RIVE, DALTON_BOOT_RIVE, daltonRiveLayoutProps } from '../constants/riveBoot';
import { captureBootRiveIssue } from '../monitoring/sentryBoot';

type Props = {
  style: StyleProp<ViewStyle>;
  onNativeError: (e: DaltonBootRiveError) => void;
  onEmbedError?: () => void;
  onBootVisualReady?: () => void;
};

/** Web: bundled `.riv` via Rive canvas runtime (transparent stage, no embed iframe). */
export function DaltonBootRiveDisplay({
  style,
  onNativeError,
  onEmbedError,
  onBootVisualReady,
}: Props) {
  const [rivSrc, setRivSrc] = useState<string | null>(null);
  const canvasReady = useRef(false);
  const layout = daltonRiveLayoutProps();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(DALTON_BOOT_RIVE);
        if (!asset.localUri) await asset.downloadAsync();
        if (!cancelled) setRivSrc(asset.localUri ?? asset.uri);
      } catch (e) {
        captureBootRiveIssue('rive_web_asset_resolve_failed', {
          message: e instanceof Error ? e.message : 'asset_failed',
        });
        onEmbedError?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onEmbedError]);

  const { RiveComponent } = useRive({
    src: rivSrc ?? undefined,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    ...(layout.artboardName ? { artboard: layout.artboardName } : {}),
    ...(layout.stateMachineName ? { stateMachines: layout.stateMachineName } : {}),
    ...(layout.animationName ? { animations: layout.animationName } : {}),
    onRiveReady: () => {
      canvasReady.current = true;
      onBootVisualReady?.();
    },
  });

  useEffect(() => {
    if (!rivSrc || !onEmbedError) return;
    canvasReady.current = false;
    const timer = setTimeout(() => {
      if (canvasReady.current) return;
      captureBootRiveIssue('rive_web_canvas_load_timeout', { src: rivSrc });
      onEmbedError();
      onNativeError({ message: 'rive web canvas load timeout', type: 'MalformedFile' });
    }, 8000);
    return () => clearTimeout(timer);
  }, [rivSrc, onEmbedError, onNativeError]);

  if (!BOOT_USE_RIVE || !rivSrc) return null;

  return (
    <View style={[styles.outer, style, { backgroundColor: 'transparent' }]}>
      <RiveComponent style={styles.canvas} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
