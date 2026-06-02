import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWizardBeforeRemove } from '../hooks/useWizardBeforeRemove';
import { useAuth } from '../auth/AuthContext';
import { DS } from '../designSystem';
import { pickLocalImage, pickLocalVideo } from '../lib/pickLocalMedia';
import { uploadProposalAttachment } from '../lib/proposalAttachmentUpload';
import type { SponsorsStackParamList } from '../navigation/types';
import {
  getSubscriptionOfferPageById,
  updateSubscriptionOfferPage,
  type UpdateSubscriptionOfferPagePatch,
} from '../roadmap/liveDataService';
import type { SubscriptionOfferPageRow } from '../roadmap/types';
import { WizardChrome } from './proposals/WizardChrome';

type Props = NativeStackScreenProps<SponsorsStackParamList, 'EditSponsor'>;

type LinkRow = { label: string; url: string };
type PromoRow = { code: string; details: string };

const TOTAL_STEPS = 6;

function parseSponsorDescription(description: string | null): { hook: string; helpsAthletes: string; contactEmail: string } {
  const desc = (description ?? '').trim();
  if (!desc) return { hook: '', helpsAthletes: '', contactEmail: '' };
  const contactMatch = desc.match(/(?:^|\n)Contact:\s*([^\n]+)\s*(?:\n|$)/i);
  const contactEmail = contactMatch?.[1]?.trim() || '';
  const helpsMatch = desc.match(/How this helps athletes:\s*\n([\s\S]*)/i);
  const helpsAthletes = helpsMatch?.[1]?.trim() || '';
  const hook = desc
    .split(/\n\nHow this helps athletes:\s*\n/i)[0]
    ?.replace(/\n*Contact:\s*[^\n]+\s*/gi, '\n')
    .trim();
  return { hook: hook || '', helpsAthletes, contactEmail };
}

function buildSponsorDescription(hook: string, helpsAthletes: string, contactEmail: string): string | null {
  const parts = [
    hook.trim(),
    helpsAthletes.trim() ? `How this helps athletes:\n${helpsAthletes.trim()}` : '',
    contactEmail.trim() ? `Contact: ${contactEmail.trim()}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n') : null;
}

function parseSocialObject(social_links: unknown): {
  external_links: LinkRow[];
  promo_codes: PromoRow[];
  gallery_urls: string[];
  logo_url: string | null;
  contact_email: string | null;
} {
  const obj =
    social_links && typeof social_links === 'object' && !Array.isArray(social_links)
      ? (social_links as any)
      : null;
  const external_links: LinkRow[] = Array.isArray(obj?.external_links)
    ? (obj.external_links as any[])
        .map((l) => ({ label: String(l?.label ?? '').trim(), url: String(l?.url ?? '').trim() }))
        .filter((l) => l.label && l.url)
    : [];
  const promo_codes: PromoRow[] = Array.isArray(obj?.promo_codes)
    ? (obj.promo_codes as any[])
        .map((p) => ({ code: String(p?.code ?? '').trim(), details: String(p?.details ?? '').trim() }))
        .filter((p) => p.code && p.details)
    : [];
  const gallery_urls: string[] = Array.isArray(obj?.gallery_urls)
    ? (obj.gallery_urls as any[]).map((u) => String(u ?? '').trim()).filter((u) => /^https?:\/\//i.test(u))
    : [];
  const logo_url = obj?.logo_url ? String(obj.logo_url).trim() : null;
  const contact_email = obj?.contact_email ? String(obj.contact_email).trim() : null;
  return { external_links, promo_codes, gallery_urls, logo_url: logo_url || null, contact_email: contact_email || null };
}

export function EditSponsorWizardScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const pageId = route.params.pageId;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<SubscriptionOfferPageRow | null>(null);
  const [brandName, setBrandName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [hook, setHook] = useState('');
  const [helpsAthletes, setHelpsAthletes] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [logo, setLogo] = useState<{ name: string; uri: string } | null>(null);
  const [coverImage, setCoverImage] = useState<{ name: string; uri: string } | null>(null);
  const [video, setVideo] = useState<{ name: string; uri: string } | null>(null);
  const [gallery, setGallery] = useState<{ name: string; uri: string }[]>([]);

  const [links, setLinks] = useState<LinkRow[]>([{ label: '', url: '' }]);
  const [promoCodes, setPromoCodes] = useState<PromoRow[]>([{ code: '', details: '' }]);

  const initialSnapshot = useRef<string>('');

  useFocusEffect(
    useCallback(() => {
      if (!user?.masterControl) navigation.goBack();
    }, [navigation, user?.masterControl]),
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const row = await getSubscriptionOfferPageById(pageId);
      if (!alive) return;
      if (!row) {
        setLoading(false);
        setError('Could not load this sponsor page.');
        return;
      }
      setPage(row);
      setBrandName(row.business_name?.trim() || '');
      setWebsiteUrl(row.website_url?.trim() || '');

      const desc = parseSponsorDescription(row.description ?? null);
      const social = parseSocialObject(row.social_links);
      const contact = social.contact_email?.trim() || desc.contactEmail;
      setContactEmail(contact);
      setHook(desc.hook);
      setHelpsAthletes(desc.helpsAthletes);

      setLinks(social.external_links.length ? social.external_links : [{ label: '', url: '' }]);
      setPromoCodes(social.promo_codes.length ? social.promo_codes : [{ code: '', details: '' }]);

      initialSnapshot.current = JSON.stringify({
        brandName: row.business_name?.trim() || '',
        contactEmail: contact,
        hook: desc.hook,
        helpsAthletes: desc.helpsAthletes,
        websiteUrl: row.website_url?.trim() || '',
        hero: row.hero_image_url?.trim() || null,
        video: row.video_url?.trim() || null,
        social: row.social_links ?? null,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [pageId]);

  const cleanedLinks = useMemo(
    () =>
      links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.label && l.url && /^https?:\/\//i.test(l.url)),
    [links],
  );
  const cleanedPromos = useMemo(
    () =>
      promoCodes
        .map((p) => ({ code: p.code.trim(), details: p.details.trim() }))
        .filter((p) => p.code && p.details),
    [promoCodes],
  );

  const dirty = useMemo(() => {
    if (!page) return false;
    const socialPrev = parseSocialObject(page.social_links);
    const nowSocial = {
      external_links: cleanedLinks,
      promo_codes: cleanedPromos,
      gallery_urls: gallery.length ? 'changed' : socialPrev.gallery_urls,
      logo_url: logo ? 'changed' : socialPrev.logo_url,
      contact_email: contactEmail.trim() || null,
    };
    const now = JSON.stringify({
      brandName: brandName.trim(),
      contactEmail: contactEmail.trim(),
      hook: hook.trim(),
      helpsAthletes: helpsAthletes.trim(),
      websiteUrl: websiteUrl.trim(),
      hero: coverImage ? 'changed' : page.hero_image_url?.trim() || null,
      video: video ? 'changed' : page.video_url?.trim() || null,
      social: nowSocial,
    });
    return now !== initialSnapshot.current;
  }, [
    brandName,
    cleanedLinks,
    cleanedPromos,
    contactEmail,
    coverImage,
    gallery.length,
    helpsAthletes,
    hook,
    logo,
    page,
    video,
    websiteUrl,
  ]);

  useWizardBeforeRemove(
    useCallback(
      (e) => {
        if (!dirty || saving) return;
        e.preventDefault();
        Alert.alert('Discard changes?', 'You have unsaved edits.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      },
      [dirty, navigation, saving],
    ),
  );

  const pickCover = useCallback(async () => {
    const picked = await pickLocalImage({ title: 'Cover image' });
    const a = picked[0];
    if (!a) return;
    setCoverImage({ name: a.name, uri: a.uri });
  }, []);

  const pickLogo = useCallback(async () => {
    const picked = await pickLocalImage({ title: 'Logo' });
    const a = picked[0];
    if (!a) return;
    setLogo({ name: a.name, uri: a.uri });
  }, []);

  const pickGallery = useCallback(async () => {
    const picked = await pickLocalImage({ multiple: true, title: 'Gallery images' });
    if (!picked.length) return;
    setGallery((prev) => [...prev, ...picked.map((a) => ({ name: a.name, uri: a.uri }))]);
  }, []);

  const pickVideo = useCallback(async () => {
    const picked = await pickLocalVideo({ title: 'Promo video' });
    const a = picked[0];
    if (!a) return;
    setVideo({ name: a.name, uri: a.uri });
  }, []);

  const save = useCallback(async () => {
    if (saving || !user?.id || !page) return;
    if (!brandName.trim()) {
      setError('Brand name is required.');
      return;
    }
    if (!hook.trim() || hook.trim().length < 10) {
      setError('Short hook explainer is required (min 10 characters).');
      return;
    }
    if (!helpsAthletes.trim() || helpsAthletes.trim().length < 20) {
      setError('Please explain how this helps athletes (min 20 characters).');
      return;
    }
    setSaving(true);
    setError(null);

    const socialPrev = parseSocialObject(page.social_links);

    const coverUrl = coverImage
      ? await uploadProposalAttachment(user.id, 'sponsor', coverImage.uri, coverImage.name)
      : null;
    if (coverImage && !coverUrl) {
      setSaving(false);
      setError('Could not upload cover image.');
      return;
    }

    const logoUrl = logo ? await uploadProposalAttachment(user.id, 'sponsor', logo.uri, logo.name) : null;
    if (logo && !logoUrl) {
      setSaving(false);
      setError('Could not upload logo.');
      return;
    }

    const galleryUrls: string[] = [];
    for (const img of gallery) {
      const u = await uploadProposalAttachment(user.id, 'sponsor', img.uri, img.name);
      if (u) galleryUrls.push(u);
    }
    if (gallery.length && galleryUrls.length === 0) {
      setSaving(false);
      setError('Could not upload gallery images.');
      return;
    }

    const videoUrl = video ? await uploadProposalAttachment(user.id, 'sponsor', video.uri, video.name) : null;
    if (video && !videoUrl) {
      setSaving(false);
      setError('Could not upload promo video.');
      return;
    }

    const patch: UpdateSubscriptionOfferPagePatch = {
      business_name: brandName.trim(),
      website_url: websiteUrl.trim() || null,
      description: buildSponsorDescription(hook, helpsAthletes, contactEmail) ?? null,
      ...(coverUrl ? { hero_image_url: coverUrl } : {}),
      ...(videoUrl ? { video_url: videoUrl } : {}),
      social_links: {
        external_links: cleanedLinks,
        promo_codes: cleanedPromos,
        gallery_urls: galleryUrls.length ? galleryUrls : socialPrev.gallery_urls,
        logo_url: (logoUrl ?? socialPrev.logo_url) || null,
        contact_email: contactEmail.trim() || null,
      },
    };

    const updated = await updateSubscriptionOfferPage(page.id, patch);
    setSaving(false);
    if (!updated) {
      setError('Could not save changes. Check permissions and try again.');
      return;
    }

    navigation.reset({
      index: 1,
      routes: [{ name: 'SponsorListings' as const }, { name: 'BrandPartner' as const, params: { pageId: updated.id } }],
    });
  }, [
    brandName,
    cleanedLinks,
    cleanedPromos,
    contactEmail,
    coverImage,
    gallery,
    helpsAthletes,
    hook,
    navigation,
    page,
    saving,
    user?.id,
    video,
    websiteUrl,
    logo,
  ]);

  const chrome = (
    children: React.ReactNode,
    opts?: { nextLabel?: string; onNext?: () => void; hideNext?: boolean; nextDisabled?: boolean },
  ) => (
    <WizardChrome
      title="Edit sponsor"
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}
      onNext={opts?.hideNext ? undefined : opts?.onNext ?? (() => setStep(step + 1))}
      nextLabel={opts?.nextLabel}
      nextDisabled={saving || opts?.nextDisabled}
      errorMessage={error}
    >
      {children}
    </WizardChrome>
  );

  if (loading) {
    return chrome(
      <View style={styles.center}>
        <Text style={styles.lead}>Loading sponsor…</Text>
      </View>,
      { hideNext: true },
    );
  }

  if (!page) {
    return chrome(
      <View style={styles.center}>
        <Text style={styles.lead}>{error ?? 'Missing sponsor page.'}</Text>
        <Pressable style={styles.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.ghostText}>Go back</Text>
        </Pressable>
      </View>,
      { hideNext: true },
    );
  }

  if (step === 1) {
    return chrome(
      <>
        <Text style={styles.lead}>Update the info shown on the partner page.</Text>
        <Text style={styles.label}>Brand / organisation</Text>
        <TextInput
          style={styles.input}
          value={brandName}
          onChangeText={setBrandName}
          placeholder="Company name"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.label}>Contact email</Text>
        <TextInput
          style={styles.input}
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Email address"
          placeholderTextColor={DS.color.textMuted}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Website URL</Text>
        <TextInput
          style={styles.input}
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          placeholder="https://example.com"
          placeholderTextColor={DS.color.textMuted}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Short hook explainer</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          value={hook}
          onChangeText={setHook}
          multiline
          placeholder="What do you offer?"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.label}>How this helps athletes</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          value={helpsAthletes}
          onChangeText={setHelpsAthletes}
          multiline
          placeholder="Explain the benefit."
          placeholderTextColor={DS.color.textMuted}
        />
      </>,
      { nextDisabled: !brandName.trim() || hook.trim().length < 10 || helpsAthletes.trim().length < 20 },
    );
  }

  if (step === 2) {
    const socialPrev = parseSocialObject(page.social_links);
    const logoUri = logo?.uri?.trim() || socialPrev.logo_url?.trim() || '';
    const heroUri = coverImage?.uri?.trim() || page.hero_image_url?.trim() || '';
    return chrome(
      <>
        <Text style={styles.lead}>Update your hero/cover and logo.</Text>
        <Text style={styles.label}>Logo</Text>
        {logoUri ? <Image source={{ uri: logoUri }} style={styles.logoPreview} /> : null}
        <Text style={styles.linkBtn} onPress={() => void pickLogo()}>
          {logo ? 'Change logo' : logoUri ? 'Replace logo' : '+ Upload logo'}
        </Text>
        {logo ? <Text style={styles.fileRow}>{logo.name}</Text> : null}
        <Text style={styles.label}>Cover image</Text>
        {heroUri ? <Image source={{ uri: heroUri }} style={styles.heroImg} /> : null}
        <Text style={styles.linkBtn} onPress={() => void pickCover()}>
          {coverImage ? 'Change cover' : '+ Upload cover'}
        </Text>
        {coverImage ? <Text style={styles.fileRow}>{coverImage.name}</Text> : null}
      </>,
    );
  }

  if (step === 3) {
    return chrome(
      <>
        <Text style={styles.lead}>Optional promo video + gallery images.</Text>
        <Text style={styles.label}>Promo video</Text>
        <Text style={styles.linkBtn} onPress={() => void pickVideo()}>
          {video ? 'Change video' : '+ Upload video (optional)'}
        </Text>
        {video ? <Text style={styles.fileRow}>{video.name}</Text> : null}
        <Text style={styles.label}>Gallery images</Text>
        <Text style={styles.linkBtn} onPress={() => void pickGallery()}>
          + Add images
        </Text>
        {gallery.length ? (
          <Text style={styles.fileRow}>{gallery.length} image(s) selected</Text>
        ) : null}
      </>,
    );
  }

  if (step === 4) {
    return chrome(
      <>
        <Text style={styles.lead}>External links shown on the sponsor page.</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
          {links.map((l, idx) => (
            <View key={`l-${idx}`} style={styles.rowCard}>
              <Text style={styles.rowLabel}>Label</Text>
              <TextInput
                style={styles.input}
                value={l.label}
                onChangeText={(v) =>
                  setLinks((prev) => prev.map((x, i) => (i === idx ? { ...x, label: v } : x)))
                }
                placeholder="Instagram / Shop / Website"
                placeholderTextColor={DS.color.textMuted}
              />
              <Text style={styles.rowLabel}>URL</Text>
              <TextInput
                style={styles.input}
                value={l.url}
                onChangeText={(v) =>
                  setLinks((prev) => prev.map((x, i) => (i === idx ? { ...x, url: v } : x)))
                }
                placeholder="https://…"
                placeholderTextColor={DS.color.textMuted}
                autoCapitalize="none"
              />
              {links.length > 1 ? (
                <Pressable
                  style={styles.rowDanger}
                  onPress={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Text style={styles.rowDangerText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.addRowBtn} onPress={() => setLinks((prev) => [...prev, { label: '', url: '' }])}>
          <Text style={styles.addRowText}>+ Add link</Text>
        </Pressable>
      </>,
      { nextLabel: 'Promo codes' },
    );
  }

  if (step === 5) {
    return chrome(
      <>
        <Text style={styles.lead}>Promo codes customers can use.</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
          {promoCodes.map((p, idx) => (
            <View key={`p-${idx}`} style={styles.rowCard}>
              <Text style={styles.rowLabel}>Code</Text>
              <TextInput
                style={styles.input}
                value={p.code}
                onChangeText={(v) =>
                  setPromoCodes((prev) => prev.map((x, i) => (i === idx ? { ...x, code: v } : x)))
                }
                placeholder="DALTON10"
                placeholderTextColor={DS.color.textMuted}
                autoCapitalize="characters"
              />
              <Text style={styles.rowLabel}>Details</Text>
              <TextInput
                style={[styles.input, styles.multiSmall]}
                value={p.details}
                onChangeText={(v) =>
                  setPromoCodes((prev) => prev.map((x, i) => (i === idx ? { ...x, details: v } : x)))
                }
                placeholder="10% off your first order"
                placeholderTextColor={DS.color.textMuted}
                multiline
              />
              {promoCodes.length > 1 ? (
                <Pressable
                  style={styles.rowDanger}
                  onPress={() => setPromoCodes((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Text style={styles.rowDangerText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.addRowBtn} onPress={() => setPromoCodes((prev) => [...prev, { code: '', details: '' }])}>
          <Text style={styles.addRowText}>+ Add promo code</Text>
        </Pressable>
      </>,
      { nextLabel: 'Review' },
    );
  }

  const heroUri = coverImage?.uri?.trim() || page.hero_image_url?.trim() || '';
  const socialPrev = parseSocialObject(page.social_links);
  const galleryCount = gallery.length || socialPrev.gallery_urls.length;
  const logoStatus = logo ? 'Updated' : socialPrev.logo_url ? 'Kept' : 'None';

  return chrome(
    <>
      <Text style={styles.lead}>Preview how this looks to a standard user.</Text>
      <View style={styles.previewCard}>
        {heroUri ? <Image source={{ uri: heroUri }} style={styles.previewImg} /> : null}
        <View style={styles.previewBody}>
          <Text style={styles.previewTitle}>{brandName.trim().toUpperCase()}</Text>
          <Text style={styles.previewHook} numberOfLines={3}>
            {hook.trim()}
          </Text>
          <Text style={styles.previewMeta}>Logo: {logoStatus}</Text>
          <Text style={styles.previewMeta}>Gallery: {galleryCount} image(s)</Text>
          {cleanedPromos.length ? (
            <View style={{ marginTop: DS.space.md }}>
              <Text style={styles.previewSectionTitle}>Promo codes</Text>
              {cleanedPromos.slice(0, 3).map((p) => (
                <View key={p.code} style={{ marginTop: DS.space.sm }}>
                  <Text style={styles.previewPromoCode}>{p.code}</Text>
                  <Text style={styles.previewDesc}>{p.details}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {cleanedLinks.length ? (
            <View style={{ marginTop: DS.space.md }}>
              <Text style={styles.previewSectionTitle}>Links</Text>
              {cleanedLinks.slice(0, 3).map((l) => (
                <Text key={`${l.label}-${l.url}`} style={styles.previewDesc}>
                  {l.label}: {l.url}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={styles.previewDivider} />
          <Text style={styles.previewSectionTitle}>How this helps athletes</Text>
          <Text style={styles.previewDesc} numberOfLines={6}>
            {helpsAthletes.trim()}
          </Text>
        </View>
      </View>
      <Pressable
        style={styles.cancelRow}
        onPress={() => {
          Alert.alert('Cancel editing?', 'Discard all changes?', [
            { text: 'Keep editing', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
          ]);
        }}
      >
        <FontAwesome name="times" size={14} color={DS.color.textMuted} />
        <Text style={styles.cancelText}> Cancel</Text>
      </Pressable>
    </>,
    {
      nextLabel: saving ? 'Saving…' : 'Save changes',
      onNext: () => void save(),
      nextDisabled: !dirty,
    },
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: DS.space.xl },
  lead: { color: DS.color.textMuted, fontFamily: DS.font.body, fontSize: 14, lineHeight: 20 },
  label: { marginTop: DS.space.lg, color: DS.color.text, fontFamily: DS.font.bodyBold, fontSize: 13 },
  input: {
    marginTop: DS.space.sm,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.md,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.md,
    color: DS.color.text,
    fontFamily: DS.font.body,
  },
  multi: { minHeight: 90, textAlignVertical: 'top' },
  multiSmall: { minHeight: 72, textAlignVertical: 'top' },
  linkBtn: { marginTop: DS.space.sm, color: DS.color.gold, fontFamily: DS.font.bodyBold },
  fileRow: { marginTop: DS.space.xs, color: DS.color.textMuted, fontFamily: DS.font.body, fontSize: 12 },
  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.sm,
    backgroundColor: DS.color.surfaceAlt,
  },
  heroImg: { width: '100%', height: 180, borderRadius: DS.radius.lg, marginTop: DS.space.sm },
  rowCard: {
    marginTop: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: DS.color.surface,
  },
  rowLabel: { marginTop: DS.space.sm, color: DS.color.textMuted, fontFamily: DS.font.bodyBold, fontSize: 12 },
  rowDanger: { marginTop: DS.space.md, alignSelf: 'flex-end' },
  rowDangerText: { color: '#ff6b6b', fontFamily: DS.font.bodyBold },
  addRowBtn: { marginTop: DS.space.md, alignItems: 'center' },
  addRowText: { color: DS.color.gold, fontFamily: DS.font.bodyBold },
  previewCard: {
    marginTop: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewImg: { width: '100%', height: 200 },
  previewBody: { padding: DS.space.lg },
  previewTitle: { color: DS.color.text, fontFamily: DS.font.display, fontSize: 20 },
  previewHook: { marginTop: DS.space.sm, color: DS.color.gold, fontFamily: DS.font.bodyBold, fontSize: 14, lineHeight: 20 },
  previewMeta: { marginTop: DS.space.sm, color: DS.color.textMuted, fontFamily: DS.font.body, fontSize: 12 },
  previewSectionTitle: { marginTop: DS.space.sm, color: DS.color.text, fontFamily: DS.font.bodyBold, fontSize: 13 },
  previewPromoCode: { color: DS.color.gold, fontFamily: DS.font.bodyBold },
  previewDesc: { marginTop: DS.space.xs, color: DS.color.textMuted, fontFamily: DS.font.body, lineHeight: 20 },
  previewDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: DS.space.md },
  cancelRow: { marginTop: DS.space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: DS.color.textMuted, fontFamily: DS.font.bodyBold },
  ghostBtn: {
    marginTop: DS.space.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
  },
  ghostText: { color: DS.color.text, fontFamily: DS.font.bodyBold },
});

