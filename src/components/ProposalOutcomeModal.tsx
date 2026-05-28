import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome } from '@expo/vector-icons';
import { AppLoadingIndicator } from './AppLoadingIndicator';
import { AppButton } from './ui/AppButton';
import { DS } from '../designSystem';
import { uploadProposalAttachment } from '../lib/proposalAttachmentUpload';
import {
  ackProposalAuthorModal,
  submitProposalFollowup,
  type ContentProposalRow,
} from '../roadmap/proposalService';
import { useAuth } from '../auth/AuthContext';

type Props = {
  visible: boolean;
  proposal: ContentProposalRow | null;
  onClose: () => void;
};

export function ProposalOutcomeModal({ visible, proposal, onClose }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [assetUrls, setAssetUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isApproved = proposal?.status === 'approved';
  const isRejected = proposal?.status === 'rejected';

  const dismiss = useCallback(async () => {
    if (proposal?.id) {
      await ackProposalAuthorModal(proposal.id);
    }
    setNotes('');
    setAssetUrls([]);
    onClose();
  }, [onClose, proposal?.id]);

  const pickAsset = async () => {
    if (!user?.id || !proposal) return;
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    setUploading(true);
    const url = await uploadProposalAttachment(
      user.id,
      `followup-${proposal.kind}`,
      picked.assets[0].uri,
      picked.assets[0].name,
    );
    setUploading(false);
    if (!url) {
      Alert.alert('Upload failed', 'Could not upload that file. Try again.');
      return;
    }
    setAssetUrls((prev) => [...prev, url]);
  };

  const submitFollowup = async () => {
    if (!proposal?.id) return;
    if (!notes.trim() && assetUrls.length === 0) {
      Alert.alert('Add details', 'Share a short note and/or attach at least one file for Dalton to review.');
      return;
    }
    setBusy(true);
    const res = await submitProposalFollowup(proposal.id, notes.trim(), assetUrls);
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Could not send', res.error);
      return;
    }
    Alert.alert('Sent', 'Your details were sent to the Dalton team for review.');
    await dismiss();
  };

  if (!proposal) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => void dismiss()}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconWrap}>
              <FontAwesome
                name={isApproved ? 'check-circle' : 'times-circle'}
                size={40}
                color={isApproved ? DS.color.gold : DS.color.error}
              />
            </View>
            <Text style={styles.title}>
              {isApproved ? 'Proposal approved' : 'Proposal update'}
            </Text>
            <Text style={styles.body}>
              {isApproved
                ? 'Your submission was approved. Add any extra copy, links, or files you want on the post — we will review before publishing.'
                : 'Thank you for submitting. After review, this proposal was not approved at this time. You can refine your idea and submit again when ready.'}
            </Text>

            {isApproved ? (
              <>
                <Text style={styles.label}>Additional information</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Describe the post, captions, timing, or anything else…"
                  placeholderTextColor={DS.color.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />
                <Pressable style={styles.attachBtn} onPress={() => void pickAsset()} disabled={uploading}>
                  {uploading ? (
                    <AppLoadingIndicator size={20} />
                  ) : (
                    <>
                      <FontAwesome name="paperclip" size={16} color={DS.color.gold} />
                      <Text style={styles.attachTxt}>Add file or image</Text>
                    </>
                  )}
                </Pressable>
                {assetUrls.map((u) => (
                  <Text key={u} style={styles.assetLine} numberOfLines={1}>
                    {u}
                  </Text>
                ))}
                <AppButton
                  label={busy ? 'Sending…' : 'Send to Dalton'}
                  onPress={() => void submitFollowup()}
                  loading={busy}
                />
              </>
            ) : null}

            <Pressable style={styles.dismissBtn} onPress={() => void dismiss()}>
              <Text style={styles.dismissTxt}>{isRejected ? 'Got it' : 'Close'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: DS.color.overlayDark80,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DS.color.surfaceAlt,
    borderTopLeftRadius: DS.radius.xl,
    borderTopRightRadius: DS.radius.xl,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
  },
  scroll: { padding: DS.space.lg, paddingBottom: DS.space.xl },
  iconWrap: { alignItems: 'center', marginBottom: DS.space.md },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 22,
    color: DS.color.text,
    textAlign: 'center',
    marginBottom: DS.space.sm,
  },
  body: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.lg,
    textAlign: 'center',
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.xs,
  },
  textArea: {
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.text,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: DS.space.md,
    backgroundColor: DS.color.input,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginBottom: DS.space.sm,
  },
  attachTxt: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.gold },
  assetLine: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginBottom: 4,
  },
  dismissBtn: { alignItems: 'center', marginTop: DS.space.lg, paddingVertical: DS.space.md },
  dismissTxt: { fontFamily: DS.font.bodyMedium, fontSize: 15, color: DS.color.gold },
});
