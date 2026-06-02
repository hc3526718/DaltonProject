import type { TextStyle } from 'react-native';

/**
 * Dalton design tokens — aligned with shared/theme.css and HTML brand.* colors.
 * Use these references in StyleSheet instead of raw hex literals.
 */
export const DS = {
  color: {
    background: '#0A0A0A',
    surface: '#1C1C1C',
    surfaceAlt: '#1A1A1A',
    /** Bottom dock / raised bar (HTML community nav) */
    tabBarRaised: '#141414',
    input: '#2A2A2A',
    gold: '#C8A84B',
    text: '#D4D0C8',
    /** Screen titles (top-left, light grey) */
    screenTitle: '#B8B4AC',
    /** Softer label text (used in a11y + themed text). */
    textSubtle: '#B8B4AC',
    textMuted: '#9A9690',
    border: '#787570',
    /** Stronger divider for elevated contrast UI. */
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    /** Generic panel fill used by some screens. */
    panel: 'rgba(255, 255, 255, 0.06)',
    /** Slightly stronger panel fill (contrast mode). */
    panelStrong: 'rgba(255, 255, 255, 0.10)',
    error: '#E8533A',
    goldTint10: 'rgba(200, 168, 75, 0.1)',
    goldTint30: 'rgba(200, 168, 75, 0.3)',
    goldTint90: 'rgba(200, 168, 75, 0.9)',
    cardBorder: 'rgba(200, 168, 75, 0.3)',
    borderHairline: 'rgba(120, 117, 112, 0.2)',
    borderHairlineLight: 'rgba(120, 117, 112, 0.1)',
    scrimBottom: 'rgba(10, 10, 10, 0.88)',
    overlayDark80: 'rgba(10, 10, 10, 0.8)',
    /** WebView loading scrim */
    overlayLight35: 'rgba(10, 10, 10, 0.35)',
    /** Floating pill / chrome over content */
    surfaceFloating92: 'rgba(28, 28, 28, 0.92)',
    white: '#FFFFFF',
    black: '#000000',
    /** HTML `border-white/5` dividers on feed cards */
    borderWhite5: 'rgba(255, 255, 255, 0.05)',
    /** HTML `border-brand-gold/20` on community posts */
    postBorderGold20: 'rgba(200, 168, 75, 0.2)',
    /** Brand partner detail — HTML accentOrange */
    accentOrange: '#F95A1E',
    /** Status dot — HTML green-500 */
    onlineGreen: '#22c55e',
  },
  /** Register via `useFonts(appFontSources)` in App — mirrors mockup fonts */
  font: {
    /** Alias used by some older screens; keep as heading. */
    display: 'BebasNeue_400Regular',
    heading: 'BebasNeue_400Regular',
    body: 'DMSans_400Regular',
    bodyMedium: 'DMSans_500Medium',
    bodyBold: 'DMSans_700Bold',
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    xxl: 16,
    pill: 9999,
    fab: 28,
  },
  type: {
    /** Heading scale — system sans with tracking; swap for Bebas via expo-font later */
    headingLetterSpacing: 1.5,
    labelUppercaseSize: 11,
  },
  /**
   * Apple / Instagram-adjacent rhythm on dark canvas; field radii echo HeroUI `--field-radius` feel.
   */
  apple: {
    controlHeight: 50,
    radiusButton: 14,
    radiusField: 12,
    radiusCard: 16,
    fieldGap: 18,
    sectionGap: 28,
    fillSecondary: 'rgba(255, 255, 255, 0.06)',
    fillTertiary: 'rgba(255, 255, 255, 0.04)',
    separator: 'rgba(255, 255, 255, 0.1)',
    shadowButton: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5,
    },
  },
} as const;

export type DSColor = (typeof DS)['color'];

/** Top-left tab titles (same spec as Media → `MEDIA`). */
export const tabRootTitleText: TextStyle = {
  fontFamily: DS.font.heading,
  fontSize: 36,
  color: DS.color.text,
  letterSpacing: 2,
};

/** Horizontal + bottom padding for tab root title rows (Media `mediaTop`). */
export const tabRootHeaderPadding = {
  paddingHorizontal: DS.space.lg,
  paddingBottom: DS.space.md,
} as const;
