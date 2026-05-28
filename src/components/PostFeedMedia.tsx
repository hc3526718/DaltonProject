import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';

export type PostMediaItem = { kind: 'image' | 'video'; uri: string };

const FEED_MEDIA_HEIGHT = 220;

type Props = {
  items: PostMediaItem[];
  /** Legacy single image when `items` is empty */
  fallbackImageUri?: string | null;
};

export function PostFeedMedia({ items, fallbackImageUri }: Props) {
  const insets = useSafeAreaInsets();
  const [carouselW, setCarouselW] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const onCarouselLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setCarouselW(w);
  }, []);

  const mediaItems = items.filter((m) => m.kind === 'image' || m.kind === 'video');

  if (mediaItems.length === 0) {
    if (!fallbackImageUri) return null;
    return (
      <Pressable onPress={() => setModalIndex(0)} style={styles.wrap}>
        <Image source={{ uri: fallbackImageUri }} style={styles.singleImage} resizeMode="contain" />
      </Pressable>
    );
  }

  const openModal = (idx: number) => setModalIndex(idx);
  const closeModal = () => setModalIndex(null);

  const modalItem =
    modalIndex != null
      ? mediaItems[modalIndex] ??
        (modalIndex === 0 && fallbackImageUri
          ? ({ kind: 'image' as const, uri: fallbackImageUri })
          : null)
      : null;

  return (
    <>
      <View onLayout={onCarouselLayout} style={styles.wrap}>
        <ScrollView
          ref={(r) => {
            scrollRef.current = r;
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={mediaItems.length > 1}
          nestedScrollEnabled
        >
          {mediaItems.map((m, idx) => (
            <Pressable
              key={`${m.kind}-${m.uri}-${idx}`}
              onPress={() => openModal(idx)}
              style={[styles.slide, carouselW ? { width: carouselW } : styles.slideFallback]}
            >
              {m.kind === 'image' ? (
                <Image source={{ uri: m.uri }} style={styles.media} resizeMode="contain" />
              ) : (
                <Video
                  source={{ uri: m.uri }}
                  style={styles.media}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isMuted
                  isLooping
                  useNativeControls={false}
                />
              )}
              {m.kind === 'video' ? (
                <View style={styles.muteBadge} pointerEvents="none">
                  <FontAwesome name="volume-off" size={12} color={DS.color.white} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        {mediaItems.length > 1 ? (
          <Text style={styles.pageHint}>{`${mediaItems.length} attachments — tap to expand`}</Text>
        ) : null}
      </View>

      <Modal visible={modalIndex != null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Pressable style={styles.modalClose} onPress={closeModal} accessibilityLabel="Close media">
            <FontAwesome name="times" size={14} color={DS.color.white} />
          </Pressable>
          {modalItem?.kind === 'image' ? (
            <Image source={{ uri: modalItem.uri }} style={styles.modalMedia} resizeMode="contain" />
          ) : modalItem?.kind === 'video' ? (
            <Video
              source={{ uri: modalItem.uri }}
              style={styles.modalMedia}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
              isLooping={false}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: FEED_MEDIA_HEIGHT,
    marginTop: DS.space.sm,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    backgroundColor: DS.color.surfaceAlt,
  },
  slide: {
    height: FEED_MEDIA_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideFallback: {
    width: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  singleImage: {
    width: '100%',
    height: FEED_MEDIA_HEIGHT,
    borderRadius: DS.radius.lg,
  },
  muteBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 6,
  },
  pageHint: {
    position: 'absolute',
    bottom: 6,
    left: 10,
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
  },
  modalClose: {
    position: 'absolute',
    top: DS.space.lg,
    right: DS.space.lg,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.goldTint30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalMedia: {
    width: '100%',
    maxHeight: '78%',
    minHeight: 200,
  },
});
