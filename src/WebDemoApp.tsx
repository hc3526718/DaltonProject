import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoadingIndicator } from './components/AppLoadingIndicator';
import { DS } from './designSystem';

const ENV_URL = (process.env.EXPO_PUBLIC_DALTON_WEB_URL || '').trim();

function normalizeBaseUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) {
    u = `http://${u}`;
  }
  return u.replace(/\/+$/, '');
}

export default function WebDemoApp() {
  const insets = useSafeAreaInsets();
  const [baseUrl, setBaseUrl] = useState<string>(() => normalizeBaseUrl(ENV_URL));
  const [draft, setDraft] = useState<string>(() => ENV_URL || '');
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const entryUri = useMemo(() => {
    if (!baseUrl) return '';
    return `${baseUrl}/index.html`;
  }, [baseUrl]);

  const originWhitelist = useMemo(() => {
    if (!baseUrl) return ['https://', 'http://'];
    try {
      const normalized = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
      const u = new URL(normalized);
      return [`${u.protocol}//${u.host}`];
    } catch {
      return ['https://', 'http://'];
    }
  }, [baseUrl]);

  const openDraft = useCallback(() => {
    const next = normalizeBaseUrl(draft);
    if (next) {
      setBaseUrl(next);
      setKey((k) => k + 1);
      setLoading(true);
    }
  }, [draft]);

  if (!baseUrl) {
    return (
      <KeyboardAvoidingView
        style={styles.setupRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.setupTitle}>The Dalton Grant Academy</Text>
        <Text style={styles.setupBody}>
          Point this app at the folder served by your PC, or at a hosted copy (HTTPS).
        </Text>
        <Text style={styles.setupHint}>
          Example: 192.168.1.42:5173{'\n'}
          (run from project root: npx serve -l tcp://0.0.0.0:5173)
        </Text>
        <TextInput
          style={styles.input}
          placeholder="192.168.x.x:5173"
          placeholderTextColor={DS.color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={openDraft}
        />
        <TouchableOpacity style={styles.button} onPress={openDraft} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Open</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.webRoot}>
      <WebView
        key={key}
        source={{ uri: entryUri }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        originWhitelist={originWhitelist}
        mixedContentMode={entryUri.startsWith('https:') ? 'never' : 'compatibility'}
        setSupportMultipleWindows={false}
      />
      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <AppLoadingIndicator />
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.changeUrl, { top: insets.top + DS.space.sm }]}
        onPress={() => {
          setDraft(baseUrl.replace(/^https?:\/\//i, ''));
          setBaseUrl('');
          setLoading(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.changeUrlText}>Change URL</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  setupRoot: {
    flex: 1,
    backgroundColor: DS.color.background,
    justifyContent: 'center',
    paddingHorizontal: DS.space.lg,
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DS.color.gold,
    marginBottom: DS.space.md,
    letterSpacing: 1,
  },
  setupBody: {
    fontSize: 15,
    color: DS.color.text,
    lineHeight: 22,
    marginBottom: DS.space.sm,
  },
  setupHint: {
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    borderWidth: 1,
    borderColor: DS.color.border,
    borderRadius: DS.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: DS.space.md,
    fontSize: 16,
    color: DS.color.text,
    backgroundColor: DS.color.surface,
    marginBottom: DS.space.base,
  },
  button: {
    backgroundColor: DS.color.gold,
    paddingVertical: 14,
    borderRadius: DS.radius.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: DS.color.background,
    fontSize: 16,
    fontWeight: '700',
  },
  webRoot: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DS.color.overlayLight35,
  },
  changeUrl: {
    position: 'absolute',
    right: DS.space.md,
    paddingVertical: DS.space.sm,
    paddingHorizontal: DS.space.md,
    backgroundColor: DS.color.surfaceFloating92,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  changeUrlText: {
    color: DS.color.gold,
    fontSize: 12,
    fontWeight: '600',
  },
});
