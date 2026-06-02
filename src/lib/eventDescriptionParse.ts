/** Parse structured fields embedded in `events.description` (legacy) or `events.event_details` (current). */

export type EventAgendaItem = { time: string; title: string };
export type EventFaqItem = { q: string; a: string };

export type EventDetailsPayload = {
  level?: string;
  capacity?: number;
  tags?: string;
  bring?: string;
  duration?: string;
  agenda?: EventAgendaItem[];
  faqs?: EventFaqItem[];
};

export type ParsedEventDescription = {
  baseDescription: string;
  level: string;
  cap: string;
  tags: string;
  bring: string;
  duration: string;
  agenda: EventAgendaItem[];
  faqs: EventFaqItem[];
  entryPaymentExtra: string;
};

function pickLine(desc: string, label: string): string {
  const m = desc.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, 'mi'));
  return m?.[1]?.trim() ?? '';
}

/** Legacy combined description blob from older publishes. */
export function parseLegacyEventDescription(desc: string): ParsedEventDescription {
  const level = pickLine(desc, 'Level');
  const cap = pickLine(desc, 'Capacity');
  const tags = pickLine(desc, 'Tags');
  const bring = pickLine(desc, 'What to bring');
  const duration = pickLine(desc, 'Duration');

  const agendaBlock = (() => {
    const m = desc.match(/(?:^|\n)Agenda:\s*\n([\s\S]*?)(?:\n\s*\n(?:FAQs:|What to bring:|Free entry)|$)/i);
    return (m?.[1] ?? '').trim();
  })();
  const agenda = agendaBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('• '))
    .map((l) => l.replace(/^•\s+/, ''))
    .map((l) => {
      const mm = l.match(/^(.+?)\s+—\s+(.+)$/);
      return { time: (mm?.[1] ?? '').trim(), title: (mm?.[2] ?? '').trim() };
    })
    .filter((r) => r.time && r.title);

  const faqBlock = (() => {
    const m = desc.match(/(?:^|\n)FAQs:\s*\n([\s\S]*?)(?:\n\s*\n|$)/i);
    return (m?.[1] ?? '').trim();
  })();
  const faqs: EventFaqItem[] = [];
  if (faqBlock) {
    const lines = faqBlock.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const q = (lines[i] ?? '').trim();
      const a = (lines[i + 1] ?? '').trim();
      if (q.startsWith('Q:') && a.startsWith('A:')) {
        faqs.push({ q: q.replace(/^Q:\s*/, ''), a: a.replace(/^A:\s*/, '') });
        i += 1;
      }
    }
  }

  const base = desc.split(/\n\nLevel:/i)[0]?.trim() ?? desc.trim();
  const entryIdx = base.search(/\n\n(?:Free entry|Paid on arrival)/i);
  const baseDescription = entryIdx >= 0 ? base.slice(0, entryIdx).trim() : base;

  const entryPaymentExtra = (() => {
    const m = desc.match(/(\n\n(?:Free entry|Paid on arrival)[\s\S]*)$/i);
    return m?.[1]?.trim() ?? '';
  })();

  return {
    baseDescription,
    level,
    cap,
    tags,
    bring,
    duration,
    agenda,
    faqs,
    entryPaymentExtra,
  };
}

function fromEventDetailsJson(raw: unknown): Partial<ParsedEventDescription> {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as EventDetailsPayload;
  const out: Partial<ParsedEventDescription> = {};
  if (typeof o.level === 'string') out.level = o.level;
  if (typeof o.capacity === 'number' && o.capacity > 0) out.cap = String(o.capacity);
  if (typeof o.tags === 'string') out.tags = o.tags;
  if (typeof o.bring === 'string') out.bring = o.bring;
  if (typeof o.duration === 'string') out.duration = o.duration;
  if (Array.isArray(o.agenda)) {
    out.agenda = o.agenda
      .filter((a) => a && typeof a.time === 'string' && typeof a.title === 'string')
      .map((a) => ({ time: a.time.trim(), title: a.title.trim() }))
      .filter((a) => a.time && a.title);
  }
  if (Array.isArray(o.faqs)) {
    out.faqs = o.faqs
      .filter((f) => f && typeof f.q === 'string' && typeof f.a === 'string')
      .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
      .filter((f) => f.q && f.a);
  }
  return out;
}

export function buildEventDetailsPayload(input: {
  level: string;
  capacity: number;
  tags: string;
  bring: string;
  duration: string;
  agenda: EventAgendaItem[];
  faqs: EventFaqItem[];
}): EventDetailsPayload {
  return {
    level: input.level.trim() || undefined,
    capacity: input.capacity > 0 ? input.capacity : undefined,
    tags: input.tags.trim() || undefined,
    bring: input.bring.trim() || undefined,
    duration: input.duration.trim() || undefined,
    agenda: input.agenda.length ? input.agenda : undefined,
    faqs: input.faqs.length ? input.faqs : undefined,
  };
}

/** Resolve host narrative + structured fields for display. */
export function resolveEventPresentation(
  description: string | null | undefined,
  eventDetails: unknown,
): ParsedEventDescription {
  const fromJson = fromEventDetailsJson(eventDetails);
  const legacy = parseLegacyEventDescription((description ?? '').trim());
  const hasJson =
    fromJson.level ||
    fromJson.cap ||
    fromJson.tags ||
    fromJson.bring ||
    (fromJson.agenda?.length ?? 0) > 0;

  if (hasJson) {
    return {
      ...legacy,
      baseDescription: (description ?? '').trim(),
      level: fromJson.level ?? legacy.level,
      cap: fromJson.cap ?? legacy.cap,
      tags: fromJson.tags ?? legacy.tags,
      bring: fromJson.bring ?? legacy.bring,
      duration: fromJson.duration ?? legacy.duration,
      agenda: fromJson.agenda ?? legacy.agenda,
      faqs: fromJson.faqs ?? legacy.faqs,
    };
  }

  return legacy;
}

export function parseEventCapacity(
  description: string | null | undefined,
  eventDetails?: unknown,
): number | null {
  const fromJson = fromEventDetailsJson(eventDetails);
  if (fromJson.cap) {
    const n = parseInt(fromJson.cap, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const desc = (description ?? '').trim();
  if (!desc) return null;
  const m = desc.match(/^Capacity:\s*(\d+)/im);
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatEventSpotsLabel(registered: number, capacity: number | null): string {
  const reg = Math.max(0, registered);
  if (capacity != null && capacity > 0) {
    return `${reg}/${capacity} spots`;
  }
  if (reg === 1) return '1 attending';
  return `${reg} attending`;
}
