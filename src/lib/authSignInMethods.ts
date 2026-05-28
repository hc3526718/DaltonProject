import { getSupabase } from './supabase';

export type SignInMethods = {
  hasEmailPassword: boolean;
  hasGoogle: boolean;
  hasApple: boolean;
};

/** Which auth providers are linked to the current session (from Supabase identities). */
export async function getSignInMethods(): Promise<SignInMethods | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const ids = data.user.identities ?? [];
  return {
    hasEmailPassword: ids.some((i) => i.provider === 'email'),
    hasGoogle: ids.some((i) => i.provider === 'google'),
    hasApple: ids.some((i) => i.provider === 'apple'),
  };
}
