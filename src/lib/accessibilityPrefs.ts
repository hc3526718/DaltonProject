import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dalton_accessibility_prefs_v2';

/** Text scale lock positions: 1× (base), 2×, 3×. */
export type TextScaleLevel = 1 | 2 | 3;

/** In-app accessibility toggles (App Store declaration subset). */
export type AccessibilityPrefs = {
  /** @deprecated Use textScaleLevel > 1; kept for cloud sync migration. */
  largerText: boolean;
  textScaleLevel: TextScaleLevel;
  differentiateWithoutColor: boolean;
  sufficientContrast: boolean;
};

export const DEFAULT_ACCESSIBILITY_PREFS: AccessibilityPrefs = {
  largerText: false,
  textScaleLevel: 1,
  differentiateWithoutColor: false,
  sufficientContrast: false,
};

const KEYS: (keyof AccessibilityPrefs)[] = [
  'largerText',
  'textScaleLevel',
  'differentiateWithoutColor',
  'sufficientContrast',
];

/** Cloud `user_settings.preferences.accessibility` shape (snake_case). */
export type AccessibilityPrefsCloud = {
  larger_text?: boolean;
  text_scale_level?: number;
  differentiate_without_color?: boolean;
  sufficient_contrast?: boolean;
};

export function prefsToCloud(p: AccessibilityPrefs): AccessibilityPrefsCloud {
  return {
    larger_text: p.textScaleLevel > 1 || p.largerText,
    text_scale_level: p.textScaleLevel,
    differentiate_without_color: p.differentiateWithoutColor,
    sufficient_contrast: p.sufficientContrast,
  };
}

export function prefsFromCloud(c: AccessibilityPrefsCloud | undefined): Partial<AccessibilityPrefs> {
  if (!c) return {};
  const out: Partial<AccessibilityPrefs> = {};
  if (typeof c.larger_text === 'boolean') out.largerText = c.larger_text;
  if (typeof c.text_scale_level === 'number' && [1, 2, 3].includes(c.text_scale_level)) {
    out.textScaleLevel = c.text_scale_level as TextScaleLevel;
  } else if (c.larger_text === true) {
    out.textScaleLevel = 2;
  }
  if (typeof c.differentiate_without_color === 'boolean') {
    out.differentiateWithoutColor = c.differentiate_without_color;
  }
  if (typeof c.sufficient_contrast === 'boolean') out.sufficientContrast = c.sufficient_contrast;
  return out;
}

function migrateLegacy(raw: Record<string, unknown>): Partial<AccessibilityPrefs> {
  const out: Partial<AccessibilityPrefs> = {};
  if (typeof raw.largerText === 'boolean') {
    out.largerText = raw.largerText;
    if (raw.largerText && !raw.textScaleLevel) out.textScaleLevel = 2;
  }
  if (typeof raw.textScaleLevel === 'number' && [1, 2, 3].includes(raw.textScaleLevel)) {
    out.textScaleLevel = raw.textScaleLevel as TextScaleLevel;
  }
  if (typeof raw.differentiateWithoutColor === 'boolean') {
    out.differentiateWithoutColor = raw.differentiateWithoutColor;
  }
  if (typeof raw.sufficientContrast === 'boolean') out.sufficientContrast = raw.sufficientContrast;
  return out;
}

function normalizePrefs(p: AccessibilityPrefs): AccessibilityPrefs {
  const level = p.textScaleLevel ?? (p.largerText ? 2 : 1);
  return {
    ...p,
    textScaleLevel: level,
    largerText: level > 1,
  };
}

export async function loadAccessibilityPrefs(): Promise<AccessibilityPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      const legacy = await AsyncStorage.getItem('dalton_accessibility_prefs_v1');
      if (!legacy) return { ...DEFAULT_ACCESSIBILITY_PREFS };
      const o = JSON.parse(legacy) as Record<string, unknown>;
      const merged = normalizePrefs({ ...DEFAULT_ACCESSIBILITY_PREFS, ...migrateLegacy(o) });
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    }
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: AccessibilityPrefs = { ...DEFAULT_ACCESSIBILITY_PREFS };
    for (const k of KEYS) {
      if (k === 'textScaleLevel' && typeof o[k] === 'number') {
        out.textScaleLevel = o[k] as TextScaleLevel;
      } else if (k !== 'textScaleLevel' && typeof o[k] === 'boolean') {
        out[k] = o[k] as boolean;
      }
    }
    return normalizePrefs(out);
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFS };
  }
}

export async function saveAccessibilityPrefs(prefs: Partial<AccessibilityPrefs>): Promise<AccessibilityPrefs> {
  const cur = await loadAccessibilityPrefs();
  const next = normalizePrefs({ ...cur, ...prefs });
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
