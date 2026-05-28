import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import {
  DEFAULT_ACCESSIBILITY_PREFS,
  loadAccessibilityPrefs,
  prefsFromCloud,
  prefsToCloud,
  saveAccessibilityPrefs,
  type AccessibilityPrefs,
} from '../lib/accessibilityPrefs';
import {
  applyAccessibilityWebSurface,
  buildAccessibleColors,
  textScaleForPrefs,
  type AccessibleColors,
} from '../lib/accessibilityTheme';
import { fetchUserPrefsDoc, patchUserPrefsDoc } from '../roadmap/userSettingsService';
import { isSupabaseConfigured } from '../lib/env';

type AccessibilityContextValue = {
  prefs: AccessibilityPrefs;
  colors: AccessibleColors;
  textScale: number;
  ready: boolean;
  /** Persist locally and sync to Supabase when signed in. */
  updatePrefs: (patch: Partial<AccessibilityPrefs>) => Promise<AccessibilityPrefs>;
  /** Re-fetch cloud prefs (e.g. after sign-in on another device). */
  refreshFromCloud: () => Promise<void>;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

function applyTextDefaults(prefs: AccessibilityPrefs) {
  const scale = textScaleForPrefs(prefs);
  const existing = (Text as { defaultProps?: Record<string, unknown> }).defaultProps ?? {};
  (Text as { defaultProps?: Record<string, unknown> }).defaultProps = {
    ...existing,
    allowFontScaling: true,
    maxFontSizeMultiplier: scale,
  };
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(DEFAULT_ACCESSIBILITY_PREFS);
  const [ready, setReady] = useState(false);

  const hydrate = useCallback(async () => {
    let local = await loadAccessibilityPrefs();
    if (isSupabaseConfigured() && user?.id) {
      const doc = await fetchUserPrefsDoc(user.id);
      const cloud = prefsFromCloud(doc.accessibility);
      if (Object.keys(cloud).length > 0) {
        local = await saveAccessibilityPrefs(cloud);
      }
    }
    setPrefs(local);
    applyTextDefaults(local);
    applyAccessibilityWebSurface(local);
    setReady(true);
  }, [user?.id]);

  useEffect(() => {
    setReady(false);
    void hydrate();
  }, [hydrate]);

  const updatePrefs = useCallback(
    async (patch: Partial<AccessibilityPrefs>) => {
      const next = await saveAccessibilityPrefs(patch);
      setPrefs(next);
      applyTextDefaults(next);
      applyAccessibilityWebSurface(next);
      if (isSupabaseConfigured() && user?.id) {
        void patchUserPrefsDoc(user.id, { accessibility: prefsToCloud(next) });
      }
      return next;
    },
    [user?.id],
  );

  const refreshFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.id) return;
    const doc = await fetchUserPrefsDoc(user.id);
    const cloud = prefsFromCloud(doc.accessibility);
    if (Object.keys(cloud).length === 0) return;
    const next = await saveAccessibilityPrefs(cloud);
    setPrefs(next);
    applyTextDefaults(next);
    applyAccessibilityWebSurface(next);
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user?.id) void refreshFromCloud();
  }, [isAuthenticated, user?.id, refreshFromCloud]);

  const colors = useMemo(() => buildAccessibleColors(prefs), [prefs]);
  const textScale = useMemo(() => textScaleForPrefs(prefs), [prefs]);

  useEffect(() => {
    applyAccessibilityWebSurface(prefs);
  }, [prefs]);

  const value = useMemo(
    () => ({
      prefs,
      colors,
      textScale,
      ready,
      updatePrefs,
      refreshFromCloud,
    }),
    [prefs, colors, textScale, ready, updatePrefs, refreshFromCloud],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    return {
      prefs: DEFAULT_ACCESSIBILITY_PREFS,
      colors: buildAccessibleColors(DEFAULT_ACCESSIBILITY_PREFS),
      textScale: 1,
      ready: true,
      updatePrefs: async (patch) => saveAccessibilityPrefs(patch),
      refreshFromCloud: async () => {},
    };
  }
  return ctx;
}
