import { useCallback, useEffect, useState } from 'react';
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
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { useAuth } from '../auth/AuthContext';
import { PullRefreshRiveOverlay } from '../components/PullRefreshRiveOverlay';
import { ScreenHeader } from '../components/ScreenHeader';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { DS } from '../designSystem';
import { useRefreshWithMinimum } from '../hooks/useRefreshWithMinimum';
import { pullRefreshControl } from '../lib/pullRefreshUi';
import { isSupabaseConfigured } from '../lib/env';
import { resolveProfileAvatarSource } from '../lib/profileAvatar';
import type { ProfileStackParamList } from '../navigation/types';
import {
  acceptFollowRequest,
  cancelFollowRequest,
  listIncomingFollowRequests,
  listOutgoingFollowRequests,
  rejectFollowRequest,
  type FollowRequestRow,
  type FollowRequestWithProfile,
} from '../roadmap/followService';

type Props = NativeStackScreenProps<ProfileStackParamList, 'FollowRequests'>;

export function FollowRequestsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const [incoming, setIncoming] = useState<FollowRequestWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FollowRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const live = isSupabaseConfigured() && user && !user.id.startsWith('demo-');

  const fetchListsOnly = useCallback(async () => {
    if (!live || !user) return;
    const [inc, out] = await Promise.all([
      listIncomingFollowRequests(user.id),
      listOutgoingFollowRequests(user.id),
    ]);
    setIncoming(inc);
    setOutgoing(out);
  }, [live, user]);

  const load = useCallback(async () => {
    if (!live || !user) {
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    await fetchListsOnly();
    setLoading(false);
  }, [live, user, fetchListsOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const { refreshing, onRefresh } = useRefreshWithMinimum(fetchListsOnly, 4000);

  const onAccept = useCallback(
    (id: string) => {
      void (async () => {
        const ok = await acceptFollowRequest(id);
        if (!ok) {
          Alert.alert('Could not accept', 'Run backend/rpc_follow_requests.sql in Supabase.');
          return;
        }
        showBanner('Follow request accepted');
        await load();
      })();
    },
    [load, showBanner],
  );

  const onReject = useCallback(
    (id: string) => {
      void (async () => {
        const ok = await rejectFollowRequest(id);
        if (!ok) Alert.alert('Could not reject', 'Check Supabase RPC and RLS.');
        else showBanner('Request declined');
        await load();
      })();
    },
    [load, showBanner],
  );

  const onCancelOut = useCallback(
    (id: string) => {
      void (async () => {
        const ok = await cancelFollowRequest(id);
        if (!ok) Alert.alert('Could not cancel', 'Check Supabase RPC.');
        else showBanner('Follow request cancelled');
        await load();
      })();
    },
    [load, showBanner],
  );

  return (
    <View style={styles.root}>
      <PullRefreshRiveOverlay visible={refreshing && live} topInset={insets.top} />
      <ScreenHeader title="Follow requests" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={live ? pullRefreshControl(refreshing, onRefresh) : undefined}
      >
        {!live ? (
          <Text style={styles.hint}>
            Sign in with your account and ensure follow requests are enabled in your project database
            (see backend migrations in this repository).
          </Text>
        ) : loading ? (
          <AppLoadingIndicator style={{ marginTop: 24 }} />
        ) : null}

        {live && !loading ? (
          <>
            <Text style={styles.section}>Incoming</Text>
            {incoming.length === 0 ? (
              <Text style={styles.empty}>No pending requests.</Text>
            ) : (
              incoming.map((r) => (
                <View key={r.id} style={styles.card}>
                  <Image
                    source={resolveProfileAvatarSource(r.requester_avatar_url)}
                    style={styles.avatar}
                  />
                  <View style={styles.cardMid}>
                    <Text style={styles.name} numberOfLines={1}>
                      {r.requester_display_name?.trim() || 'Member'}
                    </Text>
                    <Text style={styles.sub}>Wants to follow you</Text>
                  </View>
                  <Pressable style={styles.iconBtn} onPress={() => onReject(r.id)} hitSlop={8}>
                    <FontAwesome name="times" size={18} color={DS.color.textMuted} />
                  </Pressable>
                  <Pressable style={styles.acceptBtn} onPress={() => onAccept(r.id)}>
                    <Text style={styles.acceptTxt}>Accept</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={[styles.section, { marginTop: DS.space.lg }]}>Outgoing</Text>
            {outgoing.length === 0 ? (
              <Text style={styles.empty}>No pending outgoing requests.</Text>
            ) : (
              outgoing.map((r) => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardMid}>
                    <Text style={styles.sub}>Pending · {r.id.slice(0, 8)}…</Text>
                  </View>
                  <Pressable onPress={() => onCancelOut(r.id)} hitSlop={8}>
                    <Text style={styles.cancelTxt}>Cancel</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  body: { paddingHorizontal: DS.space.base },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
    lineHeight: 22,
  },
  section: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: DS.color.gold,
    marginTop: DS.space.sm,
  },
  empty: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginTop: DS.space.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.border,
    padding: DS.space.md,
    marginTop: DS.space.sm,
    gap: DS.space.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  cardMid: { flex: 1, minWidth: 0 },
  name: { fontFamily: DS.font.bodyMedium, fontSize: 16, color: DS.color.text },
  sub: { fontFamily: DS.font.body, fontSize: 12, color: DS.color.textMuted, marginTop: 2 },
  iconBtn: { padding: DS.space.xs },
  acceptBtn: {
    backgroundColor: DS.color.gold,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: 8,
  },
  acceptTxt: { fontFamily: DS.font.bodyMedium, fontSize: 13, color: DS.color.background },
  cancelTxt: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.gold },
});
