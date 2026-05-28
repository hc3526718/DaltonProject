import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { DS } from '../designSystem';
import { webCommunityTrendingPaneStyle } from '../layout/webLayout';
import {
  buildTrendingTopicsFromPosts,
  type TrendingTopicRow,
} from '../roadmap/communityTrendingTopics';
import type { CommunityPostFeedRow } from '../roadmap/liveDataService';

type Props = {
  posts: CommunityPostFeedRow[];
  onSelectTopic: (topic: string) => void;
  paddingBottom: number;
};

export function CommunityWebTrendingPanel({ posts, onSelectTopic, paddingBottom }: Props) {
  const topics = useMemo(() => buildTrendingTopicsFromPosts(posts), [posts]);

  return (
    <View style={[styles.panel, webCommunityTrendingPaneStyle()]}>
      <View style={styles.panelHeader}>
        <FontAwesome5 name="fire" size={16} color="#f97316" solid />
        <Text style={styles.panelTitle}>TRENDING SEARCHES</Text>
      </View>
      <Text style={styles.panelSub}>
        Topics athletes are posting and searching — tap to explore posts.
      </Text>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {topics.map((t, i) => (
          <TrendingRow key={t.topic} rank={i + 1} row={t} onPress={() => onSelectTopic(t.topic)} />
        ))}
      </ScrollView>
    </View>
  );
}

function TrendingRow({
  rank,
  row,
  onPress,
}: {
  rank: number;
  row: TrendingTopicRow;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.topic} numberOfLines={1}>
          {row.topic.startsWith('#') ? row.topic : row.topic}
        </Text>
        <Text style={styles.meta}>{row.label}</Text>
      </View>
      <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: DS.color.borderWhite5,
    backgroundColor: DS.color.background,
    paddingTop: DS.space.md,
    paddingHorizontal: DS.space.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginBottom: DS.space.xs,
  },
  panelTitle: {
    fontFamily: DS.font.display,
    fontSize: 18,
    letterSpacing: 1.2,
    color: DS.color.gold,
  },
  panelSub: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.lg,
    lineHeight: 18,
  },
  list: {
    gap: DS.space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.md,
    borderRadius: 10,
    backgroundColor: DS.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  rank: {
    fontFamily: DS.font.display,
    fontSize: 20,
    color: DS.color.gold,
    width: 28,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  topic: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.text,
  },
  meta: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 2,
  },
});
