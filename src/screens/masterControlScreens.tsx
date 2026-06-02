import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { ScreenHeader } from '../components/ScreenHeader';
import { AppButton } from '../components/ui/AppButton';
import { DS } from '../designSystem';
import type { ProfileStackParamList } from '../navigation/types';
import { getSupabase } from '../lib/supabase';
import {
  deleteSubscriptionOfferPage,
  insertSubscriptionOfferPage,
  listSubscriptionOfferPages,
} from '../roadmap/liveDataService';
import type { SubscriptionOfferPageRow } from '../roadmap/types';
import {
  listMasterUserAccounts,
  listPremiumAwaitingDaltonVerification,
  masterDeleteUserAccount,
  masterGrantDaltonVerified,
  masterSuspendUser,
  type MasterUserAccountRow,
  type PremiumAwaitingDaltonVerificationRow,
  verifyMasterPin,
} from '../master/masterControlService';
import { clearMasterGate, isMasterGateUnlocked, setMasterGateUnlocked } from '../master/masterGateStorage';

type PProps<K extends keyof ProfileStackParamList> = NativeStackScreenProps<ProfileStackParamList, K>;

/** PIN-only unlock. Master flag and PIN hash are set in Supabase SQL only. */
export function MasterGateScreen({ navigation, route }: PProps<'MasterGate'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const returnTo = route.params?.returnTo ?? 'MasterControlHub';

  const verifyPinStep = useCallback(async () => {
    if (!user?.id) return;
    const digits = pin.replace(/\D/g, '').trim();
    if (digits.length !== 6) {
      Alert.alert('PIN', 'Enter your 6-digit master PIN.');
      return;
    }
    setBusy(true);
    const result = await verifyMasterPin(digits);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('PIN', result.message);
      return;
    }
    await setMasterGateUnlocked(user.id);
    if (returnTo === 'MasterProposalQueue') {
      navigation.replace('MasterProposalQueue');
    } else {
      navigation.replace('MasterControlHub');
    }
  }, [navigation, pin, returnTo, user?.id]);

  if (!user?.masterControl) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Master PIN" onBack={() => navigation.goBack()} />
        <Text style={[styles.lead, styles.pad]}>This area is restricted.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Master PIN" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>
          Enter the 6-digit PIN assigned to your master account. Master access is enabled and PINs are
          managed in Supabase only — not in the app.
        </Text>
        <View style={styles.card}>
          <Text style={styles.label}>Master PIN</Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="6-digit PIN"
            placeholderTextColor={DS.color.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={styles.input}
          />
          <AppButton label={busy ? 'Checking…' : 'Unlock'} onPress={() => void verifyPinStep()} loading={busy} />
        </View>
      </ScrollView>
    </View>
  );
}

export function MasterControlHubScreen({ navigation }: PProps<'MasterControlHub'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!user?.id || user.masterControl !== true) return;
        const ok = await isMasterGateUnlocked(user.id);
        if (alive && !ok) navigation.replace('MasterGate', { returnTo: 'MasterControlHub' });
      })();
      return () => {
        alive = false;
      };
    }, [user?.id, user?.masterControl, navigation]),
  );

  if (!user?.masterControl) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Master control" onBack={() => navigation.goBack()} />
        <Text style={[styles.lead, styles.pad]}>This area is restricted.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Master control" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 40 }]}>
        <Pressable style={styles.menuRow} onPress={() => navigation.navigate('MasterPartnerOffers')}>
          <FontAwesome name="building" size={18} color={DS.color.gold} />
          <Text style={styles.menuTxt}>Partner subscription pages</Text>
          <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => navigation.navigate('MasterUserAccounts')}>
          <FontAwesome name="users" size={18} color={DS.color.gold} />
          <Text style={styles.menuTxt}>Accounts & deletion</Text>
          <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
        </Pressable>
        <Pressable
          style={[styles.menuRow, { marginTop: DS.space.lg }]}
          onPress={() => {
            void clearMasterGate();
            Alert.alert('Locked', 'Master tools require your PIN again.');
          }}
        >
          <FontAwesome name="sign-out" size={18} color={DS.color.textMuted} />
          <Text style={[styles.menuTxt, { color: DS.color.textMuted }]}>Lock master session</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function MasterVerificationQueueScreen({ navigation }: PProps<'MasterVerificationQueue'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState<PremiumAwaitingDaltonVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinDraft, setPinDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setRows(await listPremiumAwaitingDaltonVerification());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const approve = (target: PremiumAwaitingDaltonVerificationRow) => {
    const label = target.display_name ?? target.username ?? target.user_id.slice(0, 8);
    const runApprove = (pin: string) =>
      void (async () => {
        const digits = pin.replace(/\D/g, '');
        if (digits.length !== 6) {
          Alert.alert('PIN', 'Enter your 6-digit master PIN.');
          return;
        }
        setBusyId(target.user_id);
        const res = await masterGrantDaltonVerified(target.user_id, digits);
        setBusyId(null);
        if (res.ok) {
          await reload();
          Alert.alert('Verified', `${label} is now Dalton verified.`);
        } else {
          Alert.alert('Could not verify', res.message);
        }
      })();

    if (Platform.OS === 'ios') {
      Alert.prompt('Master PIN', `Approve Dalton verification for ${label}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: (p?: string) => runApprove(p ?? '') },
      ]);
      return;
    }
    if (!pinDraft.replace(/\D/g, '').length) {
      Alert.alert('PIN', 'Enter your 6-digit master PIN in the field above, then tap Approve again.');
      return;
    }
    runApprove(pinDraft);
  };

  if (!user?.masterControl) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Verification queue" onBack={() => navigation.goBack()} />
        <Text style={[styles.lead, styles.pad]}>This area is restricted.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Verification queue" onBack={() => navigation.goBack()} />
      <Text style={[styles.lead, styles.pad]}>
        Premium members who are not yet Dalton verified. Only master accounts can approve verification.
      </Text>
      {Platform.OS !== 'ios' ? (
        <View style={[styles.padH, { marginBottom: DS.space.sm }]}>
          <Text style={styles.label}>Master PIN (Android)</Text>
          <TextInput
            value={pinDraft}
            onChangeText={setPinDraft}
            keyboardType="number-pad"
            secureTextEntry
            style={styles.input}
            placeholder="6 digits"
            placeholderTextColor={DS.color.textMuted}
          />
        </View>
      ) : null}
      {loading ? (
        <AppLoadingIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {rows.map((r) => {
            const label = r.display_name ?? r.username ?? 'Member';
            const sub = r.username ? `@${r.username}` : r.user_id;
            return (
              <View key={r.user_id} style={styles.offerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerTitle}>{label}</Text>
                  <Text style={styles.offerSub} numberOfLines={1}>
                    {sub}
                  </Text>
                </View>
                <Pressable
                  style={[styles.verifyBtn, busyId === r.user_id && styles.verifyBtnBusy]}
                  onPress={() => approve(r)}
                  disabled={busyId === r.user_id}
                >
                  <Text style={styles.verifyBtnTxt}>{busyId === r.user_id ? '…' : 'Approve'}</Text>
                </Pressable>
              </View>
            );
          })}
          {!rows.length ? (
            <Text style={[styles.lead, styles.pad]}>No premium accounts awaiting verification.</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

export function MasterPartnerOffersScreen({ navigation }: PProps<'MasterPartnerOffers'>) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<SubscriptionOfferPageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setRows(await listSubscriptionOfferPages());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Partner pages" onBack={() => navigation.goBack()} />
      <View style={[styles.rowHead, styles.padH]}>
        <Pressable style={styles.plusBtn} onPress={() => navigation.navigate('CreatePartnerOffer')}>
          <FontAwesome name="plus" size={18} color={DS.color.text} />
        </Pressable>
      </View>
      {loading ? (
        <AppLoadingIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {rows.map((r) => (
            <View key={r.id} style={styles.offerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.offerTitle}>{r.business_name}</Text>
                {r.description ? (
                  <Text style={styles.offerSub} numberOfLines={2}>
                    {r.description}
                  </Text>
                ) : null}
              </View>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert('Delete page?', r.business_name, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        void (async () => {
                          const ok = await deleteSubscriptionOfferPage(r.id);
                          if (ok) await reload();
                          else Alert.alert('Could not delete');
                        })(),
                    },
                  ])
                }
              >
                <FontAwesome name="trash" size={18} color={DS.color.textMuted} />
              </Pressable>
            </View>
          ))}
          {!rows.length ? <Text style={[styles.lead, styles.pad]}>No partner pages yet.</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

export function CreatePartnerOfferScreen({ navigation }: PProps<'CreatePartnerOffer'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [hero, setHero] = useState('');
  const [video, setVideo] = useState('');
  const [web, setWeb] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    setBusy(true);
    const row = await insertSubscriptionOfferPage({
      created_by: user.id,
      business_name: name,
      description: desc,
      hero_image_url: hero || null,
      video_url: video || null,
      website_url: web || null,
    });
    setBusy(false);
    if (!row) Alert.alert('Could not create');
    else navigation.goBack();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="New partner page" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.label}>Business name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={DS.color.textMuted} />
        <Text style={[styles.label, { marginTop: DS.space.md }]}>Description</Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          style={[styles.input, styles.multi]}
          multiline
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={[styles.label, { marginTop: DS.space.md }]}>Hero image URL</Text>
        <TextInput value={hero} onChangeText={setHero} style={styles.input} placeholderTextColor={DS.color.textMuted} />
        <Text style={[styles.label, { marginTop: DS.space.md }]}>Video URL</Text>
        <TextInput value={video} onChangeText={setVideo} style={styles.input} placeholderTextColor={DS.color.textMuted} />
        <Text style={[styles.label, { marginTop: DS.space.md }]}>Website URL</Text>
        <TextInput value={web} onChangeText={setWeb} style={styles.input} placeholderTextColor={DS.color.textMuted} />
        <View style={{ height: DS.space.lg }} />
        <AppButton label={busy ? 'Publishing…' : 'Publish'} onPress={() => void submit()} loading={busy} />
      </ScrollView>
    </View>
  );
}

function formatAccountCreated(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function suspensionLabel(row: MasterUserAccountRow): string {
  if (row.suspended_permanent) return 'Suspended permanently';
  if (row.suspended_until) {
    const until = new Date(row.suspended_until);
    if (until.getTime() > Date.now()) {
      return `Suspended until ${until.toLocaleString()}`;
    }
  }
  return 'Active';
}

export function MasterUserAccountsScreen({ navigation }: PProps<'MasterUserAccounts'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<MasterUserAccountRow[]>([]);
  const [selected, setSelected] = useState<MasterUserAccountRow | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const rows = await listMasterUserAccounts(300);
    setAccounts(rows);
    setSelected((cur) => (cur ? rows.find((r) => r.user_id === cur.user_id) ?? null : null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const runWithPin = (
    title: string,
    message: string,
    destructive: boolean,
    action: (pin: string) => Promise<void>,
  ) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: destructive ? 'Confirm' : 'Apply',
          style: destructive ? 'destructive' : 'default',
          onPress: (p?: string) => void action((p ?? '').replace(/\D/g, '')),
        },
      ]);
      return;
    }
    const digits = pinDraft.replace(/\D/g, '');
    if (digits.length !== 6) {
      Alert.alert('PIN', 'Enter your 6-digit master PIN in the field below, then try again.');
      return;
    }
    void action(digits);
  };

  const applySuspend = (opts: Parameters<typeof masterSuspendUser>[2]) => {
    if (!selected) return;
    if (selected.user_id === user?.id) {
      Alert.alert('Not allowed', 'You cannot suspend your own account.');
      return;
    }
    runWithPin(
      'Master PIN',
      `Apply suspension for ${selected.display_name ?? selected.email ?? 'this user'}.`,
      false,
      async (pin) => {
        if (pin.length !== 6) {
          Alert.alert('PIN', 'Enter your 6-digit master PIN.');
          return;
        }
        setBusy(true);
        const res = await masterSuspendUser(selected.user_id, pin, opts);
        setBusy(false);
        if (res.ok) {
          await reload();
          Alert.alert('Updated', 'Account suspension settings saved.');
        } else {
          Alert.alert('Could not suspend', res.message);
        }
      },
    );
  };

  const promptDelete = () => {
    if (!selected) return;
    if (selected.user_id === user?.id) {
      Alert.alert('Not allowed', 'Use account settings to manage your own session.');
      return;
    }
    const label = selected.display_name ?? selected.email ?? selected.user_id.slice(0, 8);
    runWithPin(
      'Delete account?',
      `Permanently delete ${label}. This cannot be undone.`,
      true,
      async (pin) => {
        if (pin.length !== 6) {
          Alert.alert('PIN', 'Enter your 6-digit master PIN.');
          return;
        }
        setBusy(true);
        const res = await masterDeleteUserAccount(selected.user_id, pin);
        setBusy(false);
        if (res.ok) {
          setSelected(null);
          await reload();
          Alert.alert('Removed', 'Account deleted.');
        } else {
          Alert.alert('Failed', res.message ?? 'Could not delete account.');
        }
      },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Accounts" onBack={() => navigation.goBack()} />
      <Text style={[styles.lead, styles.pad]}>
        Select a member to view account details, suspend access for a set period, or delete the account
        (requires master PIN + master-delete-user Edge Function).
      </Text>
      {Platform.OS !== 'ios' ? (
        <View style={[styles.padH, { marginBottom: DS.space.sm }]}>
          <Text style={styles.label}>Master PIN (Android)</Text>
          <TextInput
            value={pinDraft}
            onChangeText={setPinDraft}
            keyboardType="number-pad"
            secureTextEntry
            style={styles.input}
            placeholder="6 digits"
            placeholderTextColor={DS.color.textMuted}
          />
        </View>
      ) : null}
      {selected ? (
        <View style={[styles.padH, styles.accountDetailCard]}>
          <Text style={styles.offerTitle}>{selected.display_name ?? 'Member'}</Text>
          <Text style={styles.detailLine}>Email: {selected.email ?? '—'}</Text>
          <Text style={styles.detailLine}>
            Name: {[selected.first_name, selected.last_name].filter(Boolean).join(' ') || '—'}
          </Text>
          <Text style={styles.detailLine}>Username: {selected.username ? `@${selected.username}` : '—'}</Text>
          <Text style={styles.detailLine}>Role: {selected.persona_role ?? '—'}</Text>
          <Text style={styles.detailLine}>Created: {formatAccountCreated(selected.created_at)}</Text>
          <Text style={styles.detailLine}>Status: {suspensionLabel(selected)}</Text>
          <Text style={styles.detailLine}>User ID: {selected.user_id}</Text>
          <View style={styles.suspendRow}>
            <Pressable
              style={[styles.verifyBtn, busy && styles.verifyBtnBusy]}
              disabled={busy}
              onPress={() => applySuspend({ hours: 24 })}
            >
              <Text style={styles.verifyBtnTxt}>24h</Text>
            </Pressable>
            <Pressable
              style={[styles.verifyBtn, busy && styles.verifyBtnBusy]}
              disabled={busy}
              onPress={() => applySuspend({ days: 7 })}
            >
              <Text style={styles.verifyBtnTxt}>7d</Text>
            </Pressable>
            <Pressable
              style={[styles.verifyBtn, busy && styles.verifyBtnBusy]}
              disabled={busy}
              onPress={() => applySuspend({ weeks: 2 })}
            >
              <Text style={styles.verifyBtnTxt}>2w</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.warnBtn, busy && styles.verifyBtnBusy]}
            disabled={busy}
            onPress={() => applySuspend({ permanent: true })}
          >
            <Text style={styles.warnBtnTxt}>Suspend permanently</Text>
          </Pressable>
          <Pressable
            style={[styles.ghostOutlineBtn, busy && styles.verifyBtnBusy]}
            disabled={busy}
            onPress={() => applySuspend({ clear: true })}
          >
            <Text style={styles.ghostOutlineTxt}>Clear suspension</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} disabled={busy} onPress={promptDelete}>
            <Text style={styles.deleteBtnTxt}>Delete account</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(null)} hitSlop={8}>
            <Text style={styles.clearSelect}>Close details</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {accounts.map((p) => {
          const label = p.display_name ?? p.email ?? 'Member';
          const sub = p.username ? `@${p.username}` : p.email ?? p.user_id;
          const suspended =
            p.suspended_permanent ||
            (p.suspended_until ? new Date(p.suspended_until).getTime() > Date.now() : false);
          return (
            <Pressable
              key={p.user_id}
              style={[styles.offerRow, selected?.user_id === p.user_id && styles.offerRowOn]}
              onPress={() => setSelected(p)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.offerTitle}>{label}</Text>
                <Text style={styles.offerSub} numberOfLines={1}>
                  {sub}
                </Text>
                {suspended ? (
                  <Text style={styles.suspendedTag}>{suspensionLabel(p)}</Text>
                ) : null}
              </View>
              <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
            </Pressable>
          );
        })}
        {!accounts.length ? (
          <Text style={[styles.lead, styles.pad]}>
            No accounts loaded. Run migration 035 and ensure you are signed in as master control.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  pad: { padding: DS.space.lg },
  padH: { paddingHorizontal: DS.space.lg },
  lead: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.textMuted, lineHeight: 21 },
  card: { gap: DS.space.md, marginTop: DS.space.md },
  label: { fontFamily: DS.font.bodyMedium, fontSize: 13, color: DS.color.textMuted },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
    borderRadius: DS.apple.radiusField,
    padding: 14,
    fontSize: 16,
    color: DS.color.text,
    backgroundColor: DS.apple.fillSecondary,
  },
  multi: { minHeight: 100, textAlignVertical: 'top' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.cardBorder,
  },
  menuTxt: { flex: 1, fontFamily: DS.font.body, fontSize: 16, color: DS.color.text },
  rowHead: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: DS.space.sm },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.apple.fillTertiary,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.cardBorder,
  },
  offerTitle: { fontFamily: DS.font.bodyBold, fontSize: 16, color: DS.color.gold },
  offerSub: { fontFamily: DS.font.body, fontSize: 13, color: DS.color.textMuted, marginTop: 4 },
  verifyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DS.apple.radiusField,
    backgroundColor: DS.color.gold,
  },
  verifyBtnBusy: { opacity: 0.6 },
  verifyBtnTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 13,
    color: DS.color.background,
  },
  accountDetailCard: {
    marginBottom: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    backgroundColor: DS.apple.fillSecondary,
    gap: 6,
  },
  detailLine: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 19,
  },
  suspendRow: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginTop: DS.space.md,
    marginBottom: DS.space.sm,
  },
  warnBtn: {
    paddingVertical: 10,
    borderRadius: DS.apple.radiusField,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    alignItems: 'center',
    marginBottom: DS.space.sm,
  },
  warnBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: '#fca5a5',
  },
  ghostOutlineBtn: {
    paddingVertical: 10,
    borderRadius: DS.apple.radiusField,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
    alignItems: 'center',
    marginBottom: DS.space.sm,
  },
  ghostOutlineTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.text,
  },
  deleteBtn: {
    paddingVertical: 10,
    borderRadius: DS.apple.radiusField,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    alignItems: 'center',
  },
  deleteBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
  clearSelect: {
    marginTop: DS.space.sm,
    textAlign: 'center',
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  offerRowOn: {
    backgroundColor: DS.color.goldTint10,
  },
  suspendedTag: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: '#fca5a5',
    marginTop: 4,
  },
});
