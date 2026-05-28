import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppButton } from '../components/ui/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import type { EventsStackParamList } from '../navigation/types';
import { canCreateVerifiedContent } from '../creator/creatorAccess';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import { CreateEventWizard } from './CreateEventWizard';

type Props = NativeStackScreenProps<EventsStackParamList, 'CreateEvent'>;

export function CreateEventScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const allowed = canCreateVerifiedContent(isPro, user);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) navigation.goBack();
    }, [allowed, navigation]),
  );

  if (!allowed) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Create event" onBack={() => navigation.goBack()} />
        <View style={styles.gateBody}>
          <FontAwesome name="lock" size={40} color={DS.color.gold} />
          <Text style={styles.gateTitle}>Master access only</Text>
          <Text style={styles.gateTxt}>
            Event creation is limited to Dalton Academy master accounts while we launch. Wider creator access will
            return in a future update.
          </Text>
          <AppButton label="Back" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
      </View>
    );
  }

  return <CreateEventWizard navigation={navigation} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  gateBody: {
    flex: 1,
    padding: DS.space.xl,
    justifyContent: 'center',
    gap: DS.space.lg,
  },
  gateTitle: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    color: DS.color.text,
    letterSpacing: 1,
  },
  gateTxt: { fontFamily: DS.font.body, fontSize: 15, color: DS.color.textMuted, lineHeight: 22 },
});
