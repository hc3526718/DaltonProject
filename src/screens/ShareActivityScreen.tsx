import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import type { CommunityStackParamList } from '../navigation/types';
import { loadShareActivity, type ShareActivityEntry } from '../sharing/shareActivityLog';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ShareActivity'>;

function iconFor(e: ShareActivityEntry) {
  if (e.kind === 'post') return <FontAwesome5 name="share-alt" size={18} color={DS.color.gold} solid />;
  return <FontAwesome name="globe" size={18} color={DS.color.gold} />;
}

export function ShareActivityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShareActivityEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setItems(await loadShareActivity());
      })();
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <FontAwesome name="arrow-left" size={20} color={DS.color.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>SHARE ACTIVITY</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.sub}>
        Recent shares from the community tab, stored on this device. Icons match in-app share actions.
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.at}-${item.title}`}
        contentContainerStyle={{ padding: DS.space.base, paddingBottom: 100 + insets.bottom }}
        ListEmptyComponent={
          <Text style={styles.empty}>No shares yet. Use Share on a post to populate this list.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconCircle}>{iconFor(item)}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.detail ? <Text style={styles.rowDetail} numberOfLines={2}>{item.detail}</Text> : null}
              <Text style={styles.rowTime}>{new Date(item.at).toLocaleString()}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
  },
  headerTitle: {
    fontFamily: DS.font.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: DS.color.gold,
  },
  sub: {
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.sm,
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  empty: {
    marginTop: DS.space.xl,
    textAlign: 'center',
    color: DS.color.textMuted,
    fontFamily: DS.font.body,
    paddingHorizontal: DS.space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200,168,75,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.35)',
  },
  rowTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.text,
  },
  rowDetail: {
    marginTop: 4,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  rowTime: {
    marginTop: 6,
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
  },
});
