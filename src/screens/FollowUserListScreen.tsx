import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import { formatAuthorDisplayName } from '../lib/communityPostBody';
import type {
  CommunityStackParamList,
  ProfileStackParamList,
} from '../navigation/types';
import {
  listFollowersProfiles,
  listFollowingProfiles,
  type FollowListMember,
} from '../roadmap/followService';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';

type Props =
  | NativeStackScreenProps<CommunityStackParamList, 'FollowUserList'>
  | NativeStackScreenProps<ProfileStackParamList, 'FollowUserList'>;

export function FollowUserListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { userId, mode } = route.params;
  const [rows, setRows] = useState<FollowListMember[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const list =
      mode === 'followers' ? await listFollowersProfiles(userId) : await listFollowingProfiles(userId);
    setRows(list);
    setLoading(false);
  }, [userId, mode]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const title = mode === 'followers' ? 'Followers' : 'Following';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshing={loading}
        onRefresh={() => void reload()}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>No one here yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const label = formatAuthorDisplayName({
            display_name: item.display_name,
            first_name: item.first_name,
            last_name: item.last_name,
            username: item.username,
          });
          const avatar = item.avatar_url?.trim()
            ? ({ uri: item.avatar_url.trim() } as const)
            : DALTON_LOGO_FINAL_IMG;
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('PublicProfile', { userId: item.id })}
            >
              <Image source={avatar} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {label}
                </Text>
                {item.username?.trim() ? (
                  <Text style={styles.handle} numberOfLines={1}>
                    @{item.username.trim()}
                  </Text>
                ) : null}
              </View>
              <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  empty: {
    padding: DS.space.lg,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    backgroundColor: DS.color.surface,
  },
  name: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
  },
  handle: {
    marginTop: 2,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
});
