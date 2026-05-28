import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import type { AccessibleColors } from '../lib/accessibilityTheme';
import { useThemeStyles } from '../theme/useThemeStyles';

type ShowOptions = { onPress?: () => void; durationMs?: number };

type ShowFn = (title: string, body?: string, options?: ShowOptions) => void;

const ActionBannerContext = createContext<ShowFn>(() => {});

export function ActionBannerProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(createActionBannerStyles);
  const translateY = useRef(new Animated.Value(-140)).current;
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<string | undefined>(undefined);
  const onPressRef = useRef<(() => void) | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotionRef = useRef(false);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -140,
      duration: reduceMotionRef.current ? 1 : 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [translateY]);

  const show = useCallback(
    (t: string, b?: string, options?: ShowOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setTitle(t);
      setBody(b);
      onPressRef.current = options?.onPress;
      setVisible(true);
      translateY.stopAnimation(() => {});
      if (reduceMotionRef.current) {
        translateY.setValue(0);
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 14,
        }).start();
      }
      hideTimer.current = setTimeout(() => hide(), options?.durationMs ?? 3200);
    },
    [hide, translateY],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ActionBannerContext.Provider value={value}>
      {children}
      {visible ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { paddingTop: insets.top + 8, transform: [{ translateY }] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.94}
            style={styles.card}
            onPress={() => {
              const fn = onPressRef.current;
              hide();
              fn?.();
            }}
          >
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </ActionBannerContext.Provider>
  );
}

export function useActionBanner(): ShowFn {
  return useContext(ActionBannerContext);
}

function createActionBannerStyles(c: AccessibleColors) {
  return {
    wrap: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center' as const,
      zIndex: 50,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        },
        android: { elevation: 14 },
        default: {},
      }),
    },
    card: {
      width: '92%' as const,
      maxWidth: 520,
      backgroundColor: c.panelStrong ?? c.surfaceAlt,
      borderRadius: DS.radius.xl,
      paddingVertical: DS.space.md,
      paddingHorizontal: DS.space.base,
      borderWidth: 1,
      borderColor: c.emphasisBorder ?? c.goldTint30,
    },
    title: {
      fontFamily: DS.font.bodyBold,
      fontSize: 15,
      color: c.text,
      marginBottom: 4,
    },
    body: {
      fontFamily: DS.font.body,
      fontSize: 13,
      lineHeight: 18,
      color: c.textMuted,
    },
  };
}
