/**
 * Who can start a DM with the current user (aligned with `profiles.allow_messages_from` in the backend).
 */
export type AllowMessagesFrom = 'everyone' | 'followers_only' | 'friends_only';

let allowMessagesFrom: AllowMessagesFrom = 'everyone';

export function getAllowMessagesFrom(): AllowMessagesFrom {
  return allowMessagesFrom;
}

export function setAllowMessagesFrom(value: AllowMessagesFrom): void {
  allowMessagesFrom = value;
}
