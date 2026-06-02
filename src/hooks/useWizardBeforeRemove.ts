import { useEffect } from 'react';
import { useNavigation, type EventArg } from '@react-navigation/native';

type BeforeRemoveEvent = EventArg<'beforeRemove', true, { action: { type: string; [key: string]: unknown } }>;

/**
 * Unsaved-changes guard for wizard screens.
 * Uses navigation.addListener — useBeforeRemove is unavailable on web bundles.
 */
export function useWizardBeforeRemove(listener: (e: BeforeRemoveEvent) => void): void {
  const navigation = useNavigation();
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', listener);
    return unsub;
  }, [navigation, listener]);
}
