import { useEffect, useState } from 'react';
import {
  Image,
  type ImageProps,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

type Props = Omit<ImageProps, 'source'> & {
  uri: string;
  fallbackUri?: string;
  style?: StyleProp<ImageStyle>;
};

/** Image that falls back when the remote URL is missing or broken (e.g. zero-byte upload). */
export function RemoteImage({ uri, fallbackUri, style, onError, ...rest }: Props) {
  const primary = uri.trim();
  const fallback = fallbackUri?.trim() ?? '';
  const [source, setSource] = useState<ImageSourcePropType>(
    primary ? { uri: primary } : fallback ? { uri: fallback } : { uri: '' },
  );

  useEffect(() => {
    setSource(primary ? { uri: primary } : fallback ? { uri: fallback } : { uri: '' });
  }, [fallback, primary]);

  if (!primary && !fallback) return null;

  return (
    <Image
      {...rest}
      style={style}
      source={source}
      onError={(e) => {
        onError?.(e);
        if (fallback && source && typeof source === 'object' && 'uri' in source && source.uri !== fallback) {
          setSource({ uri: fallback });
        }
      }}
    />
  );
}
