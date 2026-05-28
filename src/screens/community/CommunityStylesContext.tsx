import { createContext, useContext, type ReactNode } from 'react';
import { useAccessibility } from '../../accessibility/AccessibilityContext';
import { useThemeStyles } from '../../theme/useThemeStyles';
import { createCommunityStyles, type CommunityStyles } from './createCommunityStyles';

const CommunityStylesContext = createContext<CommunityStyles | null>(null);

export function CommunityThemeProvider({ children }: { children: ReactNode }) {
  const styles = useThemeStyles(createCommunityStyles);
  return (
    <CommunityStylesContext.Provider value={styles}>{children}</CommunityStylesContext.Provider>
  );
}

export function useCommunityStyles(): CommunityStyles {
  const ctx = useContext(CommunityStylesContext);
  if (!ctx) {
    throw new Error('useCommunityStyles must be used within CommunityThemeProvider');
  }
  return ctx;
}

/** Styles + accessible colors for community screens (icons, placeholders). */
export function useCommunityTheme() {
  const styles = useCommunityStyles();
  const { colors, textScale, prefs } = useAccessibility();
  return { styles, colors, textScale, prefs };
}
