import type { StyleProp, ViewStyle } from 'react-native';
import type { DaltonBootRiveError } from './DaltonBootRivePlayer';
import { DaltonVideoLoop } from './DaltonVideoLoop';

type Props = {
  style: StyleProp<ViewStyle>;
  onNativeError: (e: DaltonBootRiveError) => void;
  onEmbedError?: () => void;
  onBootVisualReady?: () => void;
};

/** Boot / hero animation — loops `assets/VideoP.mp4` (replaces Rive). */
export function DaltonBootRiveDisplay({
  style,
  onNativeError,
  onEmbedError,
  onBootVisualReady,
}: Props) {
  return (
    <DaltonVideoLoop
      style={style}
      onReady={onBootVisualReady}
      onError={() => {
        onEmbedError?.();
        onNativeError({ message: 'video playback failed', type: 'VideoError' });
      }}
    />
  );
}
