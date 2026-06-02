import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import {
  DALTON_BOOT_VIDEO_BG,
  getDaltonBootVideoWebCandidates,
} from '../constants/daltonBootVideo';

type Props = {
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
};

/** Web: expo-av `Video` with `/app/VideoP.mp4`, falling back to site-root `/VideoP.mp4`. */
export function DaltonVideoLoop({
  style,
  onReady,
  onError,
  accessibilityLabel = 'Loading',
}: Props) {
  const readySent = useRef(false);
  const candidates = getDaltonBootVideoWebCandidates();
  const [uriIndex, setUriIndex] = useState(0);
  const uri = candidates[uriIndex] ?? candidates[0] ?? '/VideoP.mp4';

  const fireReady = useCallback(() => {
    if (readySent.current) return;
    readySent.current = true;
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    readySent.current = false;
    setUriIndex(0);
  }, [candidates.join('|')]);

  const tryNextUri = useCallback(() => {
    if (uriIndex + 1 < candidates.length) {
      setUriIndex((i) => i + 1);
      return;
    }
    onError?.();
  }, [candidates.length, onError, uriIndex]);

  const onPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if ('error' in status && status.error) tryNextUri();
        return;
      }
      if (status.isPlaying || status.positionMillis > 0) fireReady();
    },
    [fireReady, tryNextUri],
  );

  return (
    <View
      style={[styles.outer, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Video
        key={uri}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
        useNativeControls={false}
        onLoad={() => fireReady()}
        onReadyForDisplay={() => fireReady()}
        onPlaybackStatusUpdate={onPlaybackStatus}
        onError={() => tryNextUri()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DALTON_BOOT_VIDEO_BG,
    width: '100%',
    height: '100%',
    minHeight: 80,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: DALTON_BOOT_VIDEO_BG,
  },
});
