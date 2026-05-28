import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import {
  filterHelpArticles,
  HELP_CENTRE_ARTICLES,
  HELP_SUGGESTED_SEARCHES,
  type HelpArticle,
} from '../data/helpCentreContent';
import { readOfflineCache, writeOfflineCache } from '../lib/offline/offlineCache';
import { OFFLINE_TTL } from '../lib/offline/offlinePolicy';
import { useNetworkStatus } from '../lib/offline/useNetworkStatus';
import { getDaltonWebUrl } from '../lib/env';
import { openLegalPage } from '../lib/legalUrls';
import { Linking } from 'react-native';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'HelpCentre'>;

export function HelpCentreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { online } = useNetworkStatus();
  const [articles, setArticles] = useState<HelpArticle[]>(HELP_CENTRE_ARTICLES);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      if (online) {
        await writeOfflineCache('help:centre', HELP_CENTRE_ARTICLES, OFFLINE_TTL.helpCentre);
        setArticles(HELP_CENTRE_ARTICLES);
        return;
      }
      const cached = await readOfflineCache<HelpArticle[]>('help:centre');
      if (cached?.length) setArticles(cached);
    })();
  }, [online]);

  const filtered = useMemo(() => filterHelpArticles(articles, query), [articles, query]);

  const openWebHelp = () => {
    const base = getDaltonWebUrl();
    if (!base) return;
    void Linking.openURL(`${base}/help-center`);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Help centre" onBack={() => navigation.goBack()} largeTitle />
      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTxt}>Offline — showing saved guides (up to 30 days).</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + DS.space.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <FontAwesome name="search" size={16} color={DS.color.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help…"
            placeholderTextColor={DS.color.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search help articles"
          />
        </View>

        <Text style={styles.suggestLabel}>Suggested</Text>
        <View style={styles.chipRow}>
          {HELP_SUGGESTED_SEARCHES.map((label) => (
            <Pressable
              key={label}
              style={[styles.chip, query === label && styles.chipActive]}
              onPress={() => setQuery(label)}
            >
              <Text style={[styles.chipTxt, query === label && styles.chipTxtActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {getDaltonWebUrl() ? (
          <Pressable style={styles.webLink} onPress={openWebHelp}>
            <FontAwesome name="external-link" size={14} color={DS.color.gold} />
            <Text style={styles.webLinkTxt}>Full help on the web (FAQs & live chat)</Text>
          </Pressable>
        ) : null}

        {filtered.length === 0 ? (
          <Text style={styles.empty}>No articles match your search. Try a suggested topic or contact Support.</Text>
        ) : (
          filtered.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.cardBody}>{a.body}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  offlineBanner: {
    marginHorizontal: DS.space.base,
    marginTop: DS.space.sm,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  offlineTxt: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.gold,
  },
  scroll: {
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.md,
    gap: DS.space.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 16,
    color: DS.color.text,
    paddingVertical: DS.space.sm,
  },
  suggestLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
  },
  chip: {
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.pill,
    borderWidth: 1,
    borderColor: DS.color.border,
    backgroundColor: DS.color.panel,
  },
  chipActive: {
    borderColor: DS.color.goldTint30,
    backgroundColor: DS.color.goldTint10,
  },
  chipTxt: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  chipTxtActive: {
    color: DS.color.gold,
  },
  webLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.sm,
  },
  webLinkTxt: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.gold,
  },
  empty: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 21,
  },
  card: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    padding: DS.space.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
  },
  cardTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.gold,
    marginBottom: DS.space.sm,
  },
  cardBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: DS.color.text,
  },
  cardLink: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.gold,
    marginTop: DS.space.sm,
  },
});
