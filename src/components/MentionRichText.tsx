import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCommunityStyles } from '../screens/community/CommunityStylesContext';
import type { CommunityStackParamList } from '../navigation/types';
import { parsePostTextSegments, resolveUsernameToUserId } from '../lib/postMentions';

const usernameIdCache = new Map<string, string | null>();

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
};

export function MentionRichText({ text, style }: Props) {
  const styles = useCommunityStyles();
  const navigation = useNavigation<NativeStackNavigationProp<CommunityStackParamList>>();
  const segments = useMemo(() => parsePostTextSegments(text), [text]);
  const [, bump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const mentions = segments.filter((s) => s.kind === 'mention');
    void (async () => {
      for (const seg of mentions) {
        if (seg.kind !== 'mention') continue;
        const key = seg.username.toLowerCase();
        if (usernameIdCache.has(key)) continue;
        const id = await resolveUsernameToUserId(seg.username);
        if (!cancelled) {
          usernameIdCache.set(key, id);
          bump((n) => n + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [segments]);

  const openMention = useCallback(
    (username: string) => {
      const id = usernameIdCache.get(username.toLowerCase());
      if (id) navigation.navigate('PublicProfile', { userId: id });
    },
    [navigation],
  );

  return (
    <Text style={[styles.postBody, style]}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return seg.value;
        }
        if (seg.kind === 'hashtag') {
          return (
            <Text key={`${i}-h`} style={styles.mentionGold}>
              {seg.raw}
            </Text>
          );
        }
        const cachedId = seg.userId ?? usernameIdCache.get(seg.username.toLowerCase());
        const canOpen = Boolean(cachedId);
        return (
          <Text
            key={`${i}-m`}
            style={[styles.mentionTag, !canOpen && styles.mentionTagMuted]}
            onPress={
              canOpen
                ? () => {
                    if (cachedId) navigation.navigate('PublicProfile', { userId: cachedId });
                  }
                : undefined
            }
            suppressHighlighting={false}
          >
            @{seg.username}
          </Text>
        );
      })}
    </Text>
  );
}
