import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { can } from '../admin/capabilities';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import type { MainTabParamList, ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AdminTools'>;

export function AdminToolsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<NavigationProp<MainTabParamList>>();
  const { user } = useAuth();
  const role = user?.role ?? 'member';

  if (role === 'member') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Admin tools" onBack={() => navigation.goBack()} largeTitle />
        <View style={styles.center}>
          <Text style={styles.denied}>You don&apos;t have moderator or admin access.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Admin tools" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.roleLine}>
          Role: <Text style={styles.roleGold}>{role}</Text>
        </Text>
        <Text style={styles.sub}>
          Capabilities are enforced on the server. Verified hosts use the tools below; data comes from
          your connected backend.
        </Text>

        {can(role, 'moderate_posts') ? (
          <Pressable
            style={styles.row}
            onPress={() =>
              Alert.alert(
                'Moderation queue',
                'Reports from the community are stored in post_reports. Open that table in Supabase or build a moderator UI.',
              )
            }
          >
            <Text style={styles.rowTitle}>Moderation queue</Text>
            <Text style={styles.rowSub}>Review reported posts & messages</Text>
          </Pressable>
        ) : null}

        {can(role, 'manage_events') ? (
          <Pressable
            style={styles.row}
            onPress={() => tabNav.navigate('Events', { screen: 'HostEventDashboard' })}
          >
            <Text style={styles.rowTitle}>Event host dashboard</Text>
            <Text style={styles.rowSub}>Tickets, RSVPs, attendee summary</Text>
          </Pressable>
        ) : null}

        {can(role, 'manage_events') ? (
          <Pressable
            style={styles.row}
            onPress={() =>
              Alert.alert(
                'Create / edit events',
                'Use the Events area to publish and manage sessions. Ensure your database role allows publishing.',
              )
            }
          >
            <Text style={styles.rowTitle}>Create / edit events</Text>
            <Text style={styles.rowSub}>Publish sessions and capacity</Text>
          </Pressable>
        ) : null}

        {can(role, 'manage_events') ? (
          <Pressable style={styles.row} onPress={() => navigation.navigate('AdminMediaUpload')}>
            <Text style={styles.rowTitle}>Upload media</Text>
            <Text style={styles.rowSub}>Storage bucket + `media_assets` metadata</Text>
          </Pressable>
        ) : null}

        {can(role, 'check_in_attendees') ? (
          <Pressable
            style={styles.row}
            onPress={() => tabNav.navigate('Events', { screen: 'StaffCheckIn' })}
          >
            <Text style={styles.rowTitle}>Staff check-in</Text>
            <Text style={styles.rowSub}>Validate booking QR tokens</Text>
          </Pressable>
        ) : null}

        {can(role, 'check_in_attendees') ? (
          <Pressable style={styles.row} onPress={() => navigation.navigate('QrTestLab')}>
            <Text style={styles.rowTitle}>QR test lab</Text>
            <Text style={styles.rowSub}>Generate a token + scan it on-device</Text>
          </Pressable>
        ) : null}

        {can(role, 'view_analytics') ? (
          <Pressable
            style={styles.row}
            onPress={() =>
              Alert.alert(
                'Analytics',
                'Engagement and booking charts will pull from Postgres / Metabase when connected.',
              )
            }
          >
            <Text style={styles.rowTitle}>Analytics</Text>
            <Text style={styles.rowSub}>Engagement and bookings</Text>
          </Pressable>
        ) : null}

        {can(role, 'manage_billing') ? (
          <Pressable
            style={styles.row}
            onPress={() =>
              Alert.alert('Billing', 'Stripe Connect and payouts are configured in INTEGRATIONS.md.')
            }
          >
            <Text style={styles.rowTitle}>Billing & payouts</Text>
            <Text style={styles.rowSub}>Stripe Connect / invoices</Text>
          </Pressable>
        ) : null}

        {can(role, 'assign_roles') ? (
          <Pressable
            style={styles.row}
            onPress={() =>
              Alert.alert('Roles', 'Promote admins via `organization_memberships` + audit log.')
            }
          >
            <Text style={styles.rowTitle}>Members & roles</Text>
            <Text style={styles.rowSub}>Promote admins, audit log</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  body: { padding: DS.space.lg, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', padding: DS.space.lg },
  denied: { fontFamily: DS.font.body, fontSize: 15, color: DS.color.textMuted, textAlign: 'center' },
  roleLine: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.text, marginBottom: 8 },
  roleGold: { color: DS.color.gold, fontWeight: '700' },
  sub: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 20,
    marginBottom: DS.space.xl,
  },
  row: {
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    padding: DS.space.lg,
    marginBottom: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  rowTitle: { fontFamily: DS.font.bodyMedium, fontSize: 16, color: DS.color.text },
  rowSub: { fontFamily: DS.font.body, fontSize: 12, color: DS.color.textMuted, marginTop: 4 },
});
