import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaDotPager } from './MediaDotPager';
import { DS } from '../designSystem';

export type PostMediaItem = { kind: 'image' | 'video'; uri: string };

const FEED_MEDIA_HEIGHT = 220;

type Props = {
  items: PostMediaItem[];
  /** Legacy single image when `items` is empty */
  fallbackImageUri?: string | null;
};

function pageFromOffset(offsetX: number, pageWidth: number): number {
  if (pageWidth <= 0) return 0;
  return Math.round(offsetX / pageWidth);
}

function ZoomableImage({ uri, width, maxHeight }: { uri: string; width: number; maxHeight: number }) {
  const imageH = Math.min(maxHeight, width * 1.25);
  return (
    <ScrollView
      style={{ width, maxHeight }}
      contentContainerStyle={styles.zoomContent}
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Image source={{ uri }} style={{ width, height: imageH }} resizeMode="contain" />
    </ScrollView>
  );
}

export function PostFeedMedia({ items, fallbackImageUri }: Props) {
  const insets = useSafeAreaInsets();
  const [feedCarouselW, setFeedCarouselW] = useState(0);
  const [modalCarouselW, setModalCarouselW] = useState(0);
  const [feedIndex, setFeedIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const feedScrollRef = useRef<ScrollView | null>(null);
  const modalScrollRef = useRef<ScrollView | null>(null);
  const screenW = Dimensions.get('window').width;

  const onFeedLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setFeedCarouselW(w);
  }, []);

  const onModalLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setModalCarouselW(w);
  }, []);

  const mediaItems = items.filter((m) => m.kind === 'image' || m.kind === 'video');

  const displayItems: PostMediaItem[] =
    mediaItems.length > 0
      ? mediaItems
      : fallbackImageUri
        ? [{ kind: 'image', uri: fallbackImageUri }]
        : [];

  const feedPageW = feedCarouselW > 0 ? feedCarouselW : screenW;
  const modalPageW = modalCarouselW > 0 ? modalCarouselW : screenW;
  const modalMaxH = Math.round(Dimensions.get('window').height * 0.78);

  const openModal = (idx: number) => {
    setModalIndex(idx);
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    const w = feedPageW;
    const idx = feedIndex;
    requestAnimationFrame(() => {
      if (w > 0) {
        feedScrollRef.current?.scrollTo({ x: idx * w, animated: false });
      }
    });
  }, [feedIndex, feedPageW]);

  useEffect(() => {
    if (!modalOpen || modalPageW <= 0) return;
    const t = setTimeout(() => {
      modalScrollRef.current?.scrollTo({ x: modalIndex * modalPageW, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [modalOpen, modalIndex, modalPageW]);

  const onFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width || feedPageW;
    setFeedIndex(pageFromOffset(x, w));
  };

  const onModalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width || modalPageW;
    setModalIndex(pageFromOffset(x, w));
  };

  const renderFeedSlide = (m: PostMediaItem, idx: number) => {
    const slideW = feedPageW;
    return (
      <Pressable
        key={`feed-${m.kind}-${m.uri}-${idx}`}
        onPress={() => openModal(idx)}
        style={[styles.slide, slideW ? { width: slideW } : styles.slideFallback, { height: FEED_MEDIA_HEIGHT }]}
      >
        {m.kind === 'image' ? (
          <Image source={{ uri: m.uri }} style={styles.media} resizeMode="cover" />
        ) : (
          <Video
            source={{ uri: m.uri }}
            style={styles.media}
            resizeMode={ResizeMode.COVER}
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
    );
  };

  const renderModalSlide = (m: PostMediaItem, idx: number) => (
    <View
      key={`modal-${m.kind}-${m.uri}-${idx}`}
      style={[styles.modalSlide, { width: modalPageW }]}
    >
      {m.kind === 'image' ? (
        <ZoomableImage uri={m.uri} width={modalPageW} maxHeight={modalMaxH} />
      ) : (
        <Video
          source={{ uri: m.uri }}
          style={[styles.modalMedia, { maxHeight: modalMaxH }]}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls
        />
      )}
    </View>
  );

  if (displayItems.length === 0) return null;

  return (
    <>
      <View style={styles.feedBlock}>
        <View onLayout={onFeedLayout} style={styles.wrap}>
          <ScrollView
            ref={feedScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onMomentumScrollEnd={onFeedScroll}
            onScroll={onFeedScroll}
            scrollEventThrottle={32}
          >
            {displayItems.map((m, idx) => renderFeedSlide(m, idx))}
          </ScrollView>
        </View>
        {displayItems.length > 1 ? (
          <View style={styles.dotsBelow}>
            <MediaDotPager count={displayItems.length} activeIndex={feedIndex} />
          </View>
        ) : null}
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Pressable style={styles.modalClose} onPress={closeModal} accessibilityLabel="Close media">
            <FontAwesome name="times" size={14} color={DS.color.white} />
          </Pressable>
          <View style={styles.modalPager} onLayout={onModalLayout}>
            <ScrollView
              ref={modalScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onModalScroll}
              onScroll={onModalScroll}
              scrollEventThrottle={32}
              style={styles.modalScroll}
            >
              {displayItems.map((m, idx) => renderModalSlide(m, idx))}
            </ScrollView>
            {displayItems.length > 1 ? (
              <View style={styles.modalDotsBelow}>
                <MediaDotPager count={displayItems.length} activeIndex={modalIndex} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  feedBlock: {
    width: '100%',
    marginTop: DS.space.sm,
  },
  wrap: {
    width: '100%',
    height: FEED_MEDIA_HEIGHT,
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
  muteBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 6,
  },
  dotsBelow: {
    alignItems: 'center',
    paddingTop: DS.space.sm,
    paddingBottom: DS.space.xs,
  },
  zoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
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
  },
  modalPager: {
    flex: 1,
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
  },
  modalMedia: {
    width: '100%',
    minHeight: 200,
  },
  modalDotsBelow: {
    alignItems: 'center',
    paddingTop: DS.space.md,
    paddingBottom: DS.space.lg,
  },
});
