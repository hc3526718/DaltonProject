import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useMentions, type TriggersConfig } from 'react-native-controlled-mentions';
import { DS } from '../designSystem';
import {
  buildCaptionPlainText,
  peelHashtagsFromCaption,
  removeHashtag,
} from '../lib/captionHashtags';
import { searchMentionableUsers, type MentionCandidate } from '../lib/mentionSearch';

export type CaptionComposerValue = {
  body: string;
  hashtags: string[];
};

type Props = {
  value: CaptionComposerValue;
  onChange: (value: CaptionComposerValue, plainText: string) => void;
  placeholder?: string;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
};

const triggersConfig: TriggersConfig<'mention'> = {
  mention: {
    trigger: '@',
    allowedSpacesCount: 0,
    isInsertSpaceAfterMention: true,
    textStyle: {
      color: DS.color.gold,
      fontWeight: '700',
      fontFamily: DS.font.bodyMedium,
    },
  },
};

function MentionSuggestions({
  keyword,
  onSelect,
}: {
  keyword: string | undefined;
  onSelect: (item: MentionCandidate) => void;
}) {
  const [items, setItems] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keyword == null) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchMentionableUsers(keyword).then((rows) => {
        if (!alive) return;
        setItems(rows);
        setLoading(false);
      });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [keyword]);

  if (keyword == null) return null;

  const exact = items.find((i) => i.name.toLowerCase() === keyword.toLowerCase());

  return (
    <View style={styles.suggestions}>
      {loading ? (
        <Text style={styles.suggestionHint}>Searching accounts…</Text>
      ) : items.length === 0 ? (
        <Text style={styles.suggestionWarn}>No accounts match @{keyword}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.suggestionList}>
          {items.map((item) => (
            <Pressable key={item.id} style={styles.suggestionRow} onPress={() => onSelect(item)}>
              <Text style={styles.suggestionText}>@{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {exact ? (
        <Text style={styles.suggestionOk}>Account found — @{exact.name}</Text>
      ) : keyword.length > 0 && !loading && items.length > 0 ? (
        <Text style={styles.suggestionHint}>Tap a name to tag them</Text>
      ) : null}
    </View>
  );
}

/**
 * Caption with gold @mentions (controlled-mentions) and a separate hashtag tray.
 * Typing `#tag` + space moves the tag into the tray instantly.
 */
export function CaptionComposer({
  value,
  onChange,
  placeholder = "What's happening? @mention teammates",
  maxLength = 4000,
  style,
}: Props) {
  const [pendingTag, setPendingTag] = useState<string | null>(null);

  const emit = useCallback(
    (body: string, hashtags: string[]) => {
      const next = { body, hashtags };
      onChange(next, buildCaptionPlainText(body, hashtags));
    },
    [onChange],
  );

  const handleBodyChange = useCallback(
    (raw: string) => {
      const { body, addedTags, pendingTag: pending } = peelHashtagsFromCaption(raw);
      setPendingTag(pending);
      const mergedTags = [...value.hashtags];
      for (const t of addedTags) {
        if (!mergedTags.some((x) => x.toLowerCase() === t.toLowerCase())) mergedTags.push(t);
      }
      emit(body, mergedTags);
    },
    [emit, value.hashtags],
  );

  const { textInputProps, triggers } = useMentions({
    value: value.body,
    onChange: handleBodyChange,
    triggersConfig,
  });

  const removeTag = (tag: string) => {
    emit(value.body, removeHashtag(value.hashtags, tag));
  };

  const showHashtagTray = value.hashtags.length > 0 || Boolean(pendingTag);

  return (
    <View style={[styles.wrap, style]}>
      <MentionSuggestions
        keyword={triggers.mention.keyword}
        onSelect={(item) => triggers.mention.onSelect({ id: item.id, name: item.name })}
      />
      <TextInput
        {...textInputProps}
        placeholder={placeholder}
        placeholderTextColor={DS.color.textMuted}
        multiline
        style={styles.input}
        maxLength={maxLength}
      />
      {showHashtagTray ? (
        <View style={styles.hashtagTray}>
          <Text style={styles.hashtagTrayLabel}>Hashtags</Text>
          <View style={styles.hashtagChips}>
            {value.hashtags.map((tag) => (
              <Pressable key={tag} style={styles.hashtagChip} onPress={() => removeTag(tag)}>
                <Text style={styles.hashtagChipText}>#{tag}</Text>
                <Text style={styles.hashtagChipX}> ×</Text>
              </Pressable>
            ))}
            {pendingTag != null ? (
              <View style={[styles.hashtagChip, styles.hashtagChipPending]}>
                <Text style={styles.hashtagChipText}>#{pendingTag}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: DS.space.sm,
  },
  input: {
    minHeight: 100,
    fontFamily: DS.font.body,
    fontSize: 15,
    lineHeight: 22,
    color: DS.color.text,
    textAlignVertical: 'top',
  },
  suggestions: {
    maxHeight: 200,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
    overflow: 'hidden',
  },
  suggestionList: {
    maxHeight: 140,
  },
  suggestionRow: {
    paddingHorizontal: DS.space.base,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  suggestionText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.gold,
  },
  suggestionHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    paddingHorizontal: DS.space.base,
    paddingVertical: 10,
  },
  suggestionWarn: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: '#fca5a5',
    paddingHorizontal: DS.space.base,
    paddingVertical: 10,
  },
  suggestionOk: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.gold,
    paddingHorizontal: DS.space.base,
    paddingBottom: 10,
  },
  hashtagTray: {
    borderTopWidth: 1,
    borderTopColor: DS.color.borderHairline,
    paddingTop: DS.space.sm,
    gap: DS.space.xs,
  },
  hashtagTrayLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: DS.color.textMuted,
    textTransform: 'uppercase',
  },
  hashtagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DS.radius.pill,
  },
  hashtagChipPending: {
    opacity: 0.85,
    borderStyle: 'dashed',
  },
  hashtagChipText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
  hashtagChipX: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
  },
});
