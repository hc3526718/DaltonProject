import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkUsernameAvailable,
  isValidUsernameFormat,
  normalizeUsernameTyping,
  USERNAME_MIN,
} from './usernameProfile';

export type UsernameAvailabilityState = {
  normalized: string;
  checking: boolean;
  /** null when empty / too short / skipped — not yet meaningful */
  available: boolean | null;
};

export function useUsernameAvailability(
  supabase: SupabaseClient | null,
  userId: string | undefined,
  rawInput: string,
  skipped: boolean,
  debounceMs = 280,
): UsernameAvailabilityState {
  const [state, setState] = useState<UsernameAvailabilityState>({
    normalized: '',
    checking: false,
    available: null,
  });

  useEffect(() => {
    if (!supabase || !userId || skipped) {
      setState({ normalized: '', checking: false, available: null });
      return;
    }

    const normalized = normalizeUsernameTyping(rawInput);

    if (!normalized || normalized.length < USERNAME_MIN) {
      setState({ normalized, checking: false, available: null });
      return;
    }

    if (!isValidUsernameFormat(normalized)) {
      setState({ normalized, checking: false, available: false });
      return;
    }

    let cancelled = false;
    setState({ normalized, checking: true, available: null });

    const t = setTimeout(() => {
      void (async () => {
        const available = await checkUsernameAvailable(supabase, normalized, userId);
        if (!cancelled) {
          setState({ normalized, checking: false, available });
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [supabase, userId, rawInput, skipped, debounceMs]);

  return state;
}
