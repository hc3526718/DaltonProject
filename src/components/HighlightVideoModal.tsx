import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import { getDaltonWebUrl } from '../lib/env';
import {
  isPlayableVideoUrl,
  resolveHighlightOpenUrl,
  resolveHighlightPlaybackUrl,
} from '../lib/profileHighlights';
import {
  isYouTubeUrl,
  parseYouTubeVideoId,
  youTubeEmbedUrl,
  youTubeNativeWebViewSource,
} from '../lib/youtube';

type Props = {
  visible: boolean;
  title: string;
  videoUrl: string;
  onClose: () => void;
};

/** Web-only YouTube embed (react-native-webview does not run on web). */
function WebYouTubeEmbed({ src, title }: { src: string; title: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <iframe
      title={title}
      src={src}
      style={{
        width: '100%',
        minHeight: 320,
        maxHeight: '80vh',
        border: 'none',
        backgroundColor: '#000',
      }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

/** Full-screen overlay for profile highlight clips (YouTube embed or direct file URL). */
export function HighlightVideoModal({ visible, title, videoUrl, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const embedOrigin = getDaltonWebUrl();
  const playbackUrl = resolveHighlightPlaybackUrl(videoUrl);
  const openUrl = resolveHighlightOpenUrl(videoUrl);
  const youtubeId = parseYouTubeVideoId(videoUrl);
  const playable = playbackUrl != null || youtubeId != null;
  const isYoutube = isYouTubeUrl(videoUrl);
  const webEmbedSrc = youtubeId ? youTubeEmbedUrl(youtubeId, embedOrigin) : playbackUrl;
  const youtubeWebViewSource = youtubeId ? youTubeNativeWebViewSource(youtubeId, embedOrigin) : null;
  const useWebIframe = Platform.OS === 'web' && isYoutube && webEmbedSrc;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close video">
            <FontAwesome name="times" size={14} color={DS.color.white} />
          </Pressable>
        </View>
        <View style={styles.playerWrap}>
          {playable && useWebIframe && webEmbedSrc ? (
            <WebYouTubeEmbed src={webEmbedSrc} title={title} />
          ) : playable && isYoutube && youtubeId && youtubeWebViewSource && Platform.OS !== 'web' ? (
            <>
              <WebView
                source={youtubeWebViewSource}
                style={styles.embed}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                originWhitelist={['https://*']}
                setSupportMultipleWindows={false}
              />
              {openUrl ? (
                <Pressable
                  style={styles.openYoutubeBtn}
                  onPress={() => void Linking.openURL(openUrl)}
                >
                  <FontAwesome name="youtube-play" size={16} color={DS.color.gold} />
                  <Text style={styles.openYoutubeTxt}>Open in YouTube if playback fails</Text>
                </Pressable>
              ) : null}
            </>
          ) : playable && playbackUrl && isPlayableVideoUrl(playbackUrl) && Platform.OS === 'web' ? (
            <video
              src={playbackUrl}
              controls
              autoPlay
              playsInline
              style={{
                width: '100%',
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                backgroundColor: '#000',
              }}
            />
          ) : playable && playbackUrl && isPlayableVideoUrl(playbackUrl) ? (
            <Video
              source={{ uri: playbackUrl }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
              isLooping={false}
            />
          ) : (
            <View style={styles.fallback}>
              <Text style={styles.error}>This highlight does not have a valid video link yet.</Text>
              {openUrl ? (
                <Pressable
                  style={styles.openBtn}
                  onPress={() => void Linking.openURL(openUrl)}
                >
                  <Text style={styles.openBtnTxt}>Open video in browser</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.base,
    paddingVertical: DS.space.md,
    gap: DS.space.md,
  },
  title: {
    flex: 1,
    fontFamily: DS.font.bodyMedium,
    fontSize: 17,
    color: DS.color.gold,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.goldTint30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: DS.space.md,
  },
  video: {
    width: '100%',
    minHeight: 240,
    maxHeight: '85%',
  },
  embed: {
    width: '100%',
    minHeight: 280,
    maxHeight: '85%',
    backgroundColor: '#000',
  },
  fallback: {
    alignItems: 'center',
    gap: DS.space.md,
  },
  error: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
  openBtn: {
    paddingVertical: 12,
    paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.gold,
  },
  openBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.gold,
  },
  openYoutubeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    marginTop: DS.space.md,
    paddingVertical: 12,
    paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  openYoutubeTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
});
