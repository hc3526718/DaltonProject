import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AdminMediaUpload'>;

/**
 * Dalton-verified admins upload media metadata + binary to Storage — UI shell until picker + API wired.
 */
export function AdminMediaUploadScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Upload media" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Choose a file to stage upload to the `media_assets` bucket with visibility rules from
          STORAGE.md. Gate this screen with `dalton_verified` + capability on the server.
        </Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            Alert.alert(
              'Select media',
              'Wire expo-image-picker or document picker, then Supabase Storage upload with signed URL.',
            )
          }
        >
          <FontAwesome name="cloud-upload" size={22} color={DS.color.background} />
          <Text style={styles.ctaTxt}> Choose file</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  body: { padding: DS.space.lg },
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.lg,
    borderRadius: DS.radius.xl,
    gap: DS.space.sm,
  },
  ctaTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.background,
    fontWeight: '700',
  },
});
