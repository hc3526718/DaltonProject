import { useCallback, useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PullRefreshRiveOverlay } from '../components/PullRefreshRiveOverlay';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { DS, tabRootHeaderPadding, tabRootTitleText } from '../designSystem';
import { useRefreshWithMinimum } from '../hooks/useRefreshWithMinimum';
import { pullRefreshControl } from '../lib/pullRefreshUi';
import { listSubscriptionOfferPages } from '../roadmap/liveDataService';
import type { SubscriptionOfferPageRow } from '../roadmap/types';
import type { SponsorsStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import { gatePremiumFeatureAccess } from '../subscriptions/premiumFeatureGate';

type SProps<K extends keyof SponsorsStackParamList> = NativeStackScreenProps<
  SponsorsStackParamList,
  K
>;

const FALLBACK_SP_IMG =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop';

export function SponsorListingsScreen({ navigation }: SProps<'SponsorListings'>) {
  const insets = useSafeAreaInsets();
  const route = useRoute<SProps<'SponsorListings'>['route']>();
  const showBanner = useActionBanner();
  const { user } = useAuth();
  const { isPro, refresh: refreshSubscription, notifyNewPremiumFromPaywall } = useSubscription();
  const [items, setItems] = useState<SubscriptionOfferPageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const name = route.params?.createdSponsorName?.trim();
    if (!name) return;
    showBanner('Sponsor page published', name);
    navigation.setParams({ createdSponsorName: undefined });
  }, [route.params?.createdSponsorName, navigation, showBanner]);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await listSubscriptionOfferPages(100);
    setItems(rows);
    setLoading(false);
  }, []);

  const { refreshing, onRefresh } = useRefreshWithMinimum(load, 4000);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <PullRefreshRiveOverlay visible={refreshing} topInset={insets.top} />
      <View
        style={[
          styles.sponsorHeader,
          tabRootHeaderPadding,
          { paddingTop: insets.top + DS.space.md },
        ]}
      >
        <Text style={styles.sponsorTitle}>SPONSORS</Text>
        <View style={styles.sponsorHeaderActions}>
          {user?.masterControl ? (
            <>
              <Pressable
                style={styles.roundIconBtnSm}
                hitSlop={8}
                onPress={() => navigation.navigate('MySponsorProposals')}
                accessibilityLabel="My sponsor pages"
              >
                <FontAwesome name="list-alt" size={15} color={DS.color.text} />
              </Pressable>
              <Pressable
                style={styles.roundIconBtnSm}
                hitSlop={8}
                onPress={() => navigation.navigate('SponsorProposalWizard')}
                accessibilityLabel="Create sponsor page"
              >
                <FontAwesome name="plus" size={15} color={DS.color.text} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefreshControl(refreshing, onRefresh)}
      >
        {loading && items.length === 0 ? (
          <AppLoadingIndicator style={{ marginTop: DS.space.xl }} />
        ) : null}
        {!loading && items.length === 0 ? (
          <Text style={styles.emptyText}>
            Partner pages will appear here when the team publishes them.
          </Text>
        ) : null}
        {items.map((s) => {
          const socialObj =
            s.social_links && typeof s.social_links === 'object' && !Array.isArray(s.social_links)
              ? (s.social_links as { logo_url?: unknown })
              : null;
          const logoUrl = socialObj ? String(socialObj.logo_url ?? '').trim() : '';
          const thumb = (logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : s.hero_image_url?.trim()) || FALLBACK_SP_IMG;
          const sub =
            s.description?.trim().slice(0, 120) ||
            'Official partner — tap for offers and links.';
          return (
            <Pressable
              key={s.id}
              style={styles.sponsorCard}
              onPress={() => navigation.navigate('BrandPartner', { pageId: s.id })}
            >
              <Image source={{ uri: thumb }} style={styles.sponsorThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sponsorName}>{s.business_name.toUpperCase()}</Text>
                <Text style={styles.sponsorTier} numberOfLines={3}>
                  {sub}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={DS.color.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  sponsorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sponsorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  roundIconBtnSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorTitle: {
    ...tabRootTitleText,
  },
  emptyText: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    marginTop: DS.space.lg,
    lineHeight: 22,
  },
  sponsorTier: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.text,
    marginTop: 4,
  },
  padded: {
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.md,
  },
  sponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    padding: DS.space.md,
    marginBottom: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
  },
  sponsorThumb: {
    width: 72,
    height: 72,
    borderRadius: DS.radius.md,
  },
  sponsorName: {
    fontFamily: DS.font.heading,
    fontSize: 18,
    letterSpacing: 1,
    color: DS.color.gold,
  },
});
