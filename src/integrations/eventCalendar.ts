import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type IcsEventInput = {
  uid: string;
  title: string;
  location?: string;
  start: Date;
  end: Date;
  description?: string;
};

function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Build RFC 5545 ICS content for a single event. */
export function buildIcsEvent(input: IcsEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Dalton Grant Academy//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}@grant-access.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(input.start)}`,
    `DTEND:${formatIcsDate(input.end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Write ICS to cache and open share sheet (Add to Calendar flow). */
export async function shareEventAsIcs(input: IcsEventInput): Promise<void> {
  const base = cacheDirectory;
  if (!base) {
    throw new Error('Calendar file export requires iOS or Android (not web).');
  }
  const ics = buildIcsEvent(input);
  const path = `${base}event-${input.uid}.ics`;
  await writeAsStringAsync(path, ics);
  const can = await Sharing.isAvailableAsync();
  if (!can) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(path, {
    mimeType: 'text/calendar',
    dialogTitle: 'Add to calendar',
  });
}

/** Simple “Add to Google Calendar” link (opens a pre-filled event). */
export function buildGoogleCalendarLink(input: IcsEventInput): string {
  const toCompact = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z'
    );
  };
  const dates = `${toCompact(input.start)}/${toCompact(input.end)}`;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates,
    ...(input.location ? { location: input.location } : {}),
    ...(input.description ? { details: input.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
