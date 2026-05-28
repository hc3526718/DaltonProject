/** Title-case sport / persona labels for display and profile storage. */
export function capitalizeProfileTag(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function capitalizeProfileTags(values: string[]): string[] {
  return values.map(capitalizeProfileTag).filter(Boolean);
}
