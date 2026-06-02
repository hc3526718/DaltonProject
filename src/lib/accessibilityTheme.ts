import { Platform } from 'react-native';
import { DS } from '../designSystem';
import type { AccessibilityPrefs } from './accessibilityPrefs';

/**
 * `DS.color` is defined `as const`, so `typeof DS.color` would otherwise infer
 * *literal* string types (e.g. `background` must be exactly "#0A0A0A").
 * For accessibility variants we intentionally widen these to plain strings.
 */
export type AccessibleColors = {
  [K in keyof typeof DS.color]: string;
} & {
  emphasisBorder: string;
  /** Used in some screens as a softer label color. */
  textSubtle: string;
  /** Stronger border for high-contrast mode. */
  borderStrong: string;
  /** Stronger panel fill for high-contrast mode. */
  panelStrong: string;
};

const CONTRAST = {
  background: '#000000',
  text: '#FFFFFF',
  textMuted: '#E8E4DC',
  textSubtle: '#CFCAC2',
  border: 'rgba(255,255,255,0.22)',
  borderStrong: 'rgba(255,255,255,0.38)',
  panel: 'rgba(255,255,255,0.1)',
  panelStrong: 'rgba(255,255,255,0.14)',
  gold: '#E8C96A',
  goldTint30: 'rgba(232, 201, 106, 0.45)',
};

const MONO = {
  background: '#000000',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F2',
  gold: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#FFFFFF',
  textSubtle: '#E0E0E0',
  border: '#FFFFFF',
  borderStrong: '#FFFFFF',
  goldTint10: 'rgba(255,255,255,0.12)',
  goldTint30: 'rgba(255,255,255,0.35)',
  cardBorder: 'rgba(255,255,255,0.5)',
  postBorderGold20: 'rgba(255,255,255,0.35)',
};

export function buildAccessibleColors(prefs: AccessibilityPrefs): AccessibleColors {
  const base = { ...DS.color, emphasisBorder: DS.color.borderStrong };

  if (prefs.differentiateWithoutColor) {
    return {
      ...base,
      ...MONO,
      emphasisBorder: MONO.borderStrong,
    };
  }

  if (prefs.sufficientContrast) {
    return {
      ...base,
      ...CONTRAST,
      emphasisBorder: CONTRAST.borderStrong,
    };
  }

  return {
    ...base,
    emphasisBorder: prefs.differentiateWithoutColor ? DS.color.borderStrong : DS.color.border,
  };
}

/** Text scale multiplier (1×, 2×, 3× lock positions). */
export function textScaleForPrefs(prefs: AccessibilityPrefs): number {
  const level = prefs.textScaleLevel ?? (prefs.largerText ? 2 : 1);
  if (level >= 3) return 1.42;
  if (level >= 2) return 1.28;
  return 1;
}

export function scaledFontSize(size: number, prefs: AccessibilityPrefs): number {
  return Math.round(size * textScaleForPrefs(prefs));
}

/** Apply CSS variables / classes on marketing + Expo web. */
export function applyAccessibilityWebSurface(prefs: AccessibilityPrefs): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  const scale = textScaleForPrefs(prefs);
  root.style.setProperty('--demo-bg', prefs.sufficientContrast ? '#000000' : '#0a0a0a');
  root.style.setProperty('--demo-text', prefs.sufficientContrast ? '#ffffff' : '#d4d0c8');
  root.style.setProperty('--demo-gold', prefs.differentiateWithoutColor ? '#ffffff' : prefs.sufficientContrast ? '#e8c96a' : '#c8a84b');
  root.style.setProperty('--dalton-text-scale', String(scale));
  root.classList.toggle('dalton-a11y-mono', prefs.differentiateWithoutColor);
  root.classList.toggle('dalton-a11y-contrast', prefs.sufficientContrast);
  root.classList.toggle('dalton-a11y-text-lg', scale > 1.1);
}
