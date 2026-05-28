import { updateProfileAllowMessagesFrom } from '../roadmap/profileService';
import type { AllowMessagesFrom } from './messagingPrefs';

const RETRY_DELAYS_MS = [300, 1200, 2800];

/**
 * Push DM visibility preference to `profiles.allow_messages_from` with exponential-ish retries.
 * Call after optimistic local update in the UI.
 */
export async function syncAllowMessagesFromRemote(
  userId: string,
  value: AllowMessagesFrom,
): Promise<boolean> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ok = await updateProfileAllowMessagesFrom(userId, value);
    if (ok) return true;
    const wait = RETRY_DELAYS_MS[attempt];
    if (wait == null) break;
    await new Promise((r) => setTimeout(r, wait));
  }
  return false;
}
