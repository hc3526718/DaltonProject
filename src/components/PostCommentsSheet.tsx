import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostFeedMedia, type PostMediaItem } from './PostFeedMedia';
import { DS } from '../designSystem';
import type { PostCommentRow } from '../roadmap/communityInteractionsService';

const SHEET_HEIGHT_RATIO = 0.62;

type Props = {
  visible: boolean;
  onClose: () => void;
  postName: string;
  postBody: string;
  postMedia: PostMediaItem[];
  postImageFallback?: string | null;
  comments: PostCommentRow[];
  commentDraft: string;
  onChangeDraft: (t: string) => void;
  onSubmit: () => void;
  commentsBusy: boolean;
  liveMode: boolean;
  colors: {
    text: string;
    textMuted: string;
    gold: string;
    background: string;
    surface: string;
    borderWhite5: string;
  };
};

export function PostCommentsSheet({
  visible,
  onClose,
  postName,
  postBody,
  postMedia,
  postImageFallback,
  comments,
  commentDraft,
  onChangeDraft,
  onSubmit,
  commentsBusy,
  liveMode,
  colors,
}: Props) {
  const insets = useSafeAreaInsets();
  const sheetH = Math.round(Dimensions.get('window').height * SHEET_HEIGHT_RATIO);
  const slide = useRef(new Animated.Value(sheetH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    } else {
      slide.setValue(sheetH);
    }
  }, [visible, sheetH, slide]);

  const closeAnimated = () => {
    Animated.timing(slide, {
      toValue: sheetH,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeAnimated}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeAnimated} />
        <View style={[styles.postPeek, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.peekName, { color: colors.gold }]} numberOfLines={1}>
            {postName}
          </Text>
          {postBody.trim() ? (
            <Text style={[styles.peekBody, { color: colors.text }]} numberOfLines={3}>
              {postBody}
            </Text>
          ) : null}
          {postMedia.length > 0 || postImageFallback ? (
            <View style={styles.peekMedia}>
              <PostFeedMedia items={postMedia} fallbackImageUri={postImageFallback} />
            </View>
          ) : null}
        </View>
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH + insets.bottom,
              paddingBottom: insets.bottom,
              backgroundColor: colors.surface,
              borderColor: colors.borderWhite5,
              transform: [{ translateY: slide }],
            },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.borderWhite5 }]} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Comments</Text>
            <Pressable hitSlop={12} onPress={closeAnimated}>
              <FontAwesome name="chevron-down" size={18} color={colors.gold} />
            </Pressable>
          </View>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={insets.top}
          >
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {liveMode ? 'No comments yet. Start the thread.' : 'Sign in to read and post comments.'}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={[styles.commentRow, { borderColor: colors.borderWhite5 }]}>
                  {item.author_avatar_url ? (
                    <Image source={{ uri: item.author_avatar_url }} style={styles.commentAvatar} />
                  ) : (
                    <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder, { borderColor: colors.borderWhite5 }]}>
                      <FontAwesome name="user" size={14} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.commentCol}>
                    <Text style={[styles.commentAuthor, { color: colors.gold }]}>
                      {item.author_username?.trim() || '@member'}
                    </Text>
                    <Text style={[styles.commentBody, { color: colors.text }]}>{item.body}</Text>
                  </View>
                </View>
              )}
            />
            <View style={[styles.composer, { borderTopColor: colors.borderWhite5 }]}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.borderWhite5 }]}
                placeholder="Write a comment…"
                placeholderTextColor={colors.textMuted}
                value={commentDraft}
                onChangeText={onChangeDraft}
                multiline
              />
              <Pressable
                style={[
                  styles.send,
                  { backgroundColor: colors.gold },
                  (commentsBusy || !commentDraft.trim()) && { opacity: 0.4 },
                ]}
                disabled={commentsBusy || !commentDraft.trim()}
                onPress={onSubmit}
              >
                <FontAwesome name="send" size={16} color={colors.background} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  postPeek: {
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.sm,
    maxHeight: '36%',
  },
  peekName: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    marginBottom: 4,
  },
  peekBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: DS.space.sm,
  },
  peekMedia: {
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    maxHeight: 140,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.sm,
  },
  sheetTitle: {
    fontFamily: DS.font.heading,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  flex: { flex: 1 },
  listContent: {
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.md,
    gap: DS.space.sm,
  },
  empty: {
    fontFamily: DS.font.body,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: DS.space.xl,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
    paddingVertical: DS.space.xs,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  commentCol: {
    flex: 1,
    minWidth: 0,
  },
  commentAuthor: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    marginBottom: 4,
  },
  commentBody: {
    fontFamily: DS.font.body,
    fontSize: 15,
    lineHeight: 21,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: DS.radius.lg,
    paddingHorizontal: DS.space.md,
    paddingVertical: 10,
    fontFamily: DS.font.body,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
