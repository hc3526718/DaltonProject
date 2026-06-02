/** Client-side mirror of `user_settings.notification_channels.push` for foreground delivery. */
let pushDeliveryEnabled = true;

export function setPushDeliveryEnabled(enabled: boolean): void {
  pushDeliveryEnabled = enabled;
}

export function isPushDeliveryEnabled(): boolean {
  return pushDeliveryEnabled;
}
