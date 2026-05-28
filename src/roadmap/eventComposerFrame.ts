/**
 * Structural model for **Create Event** — locked chrome vs reorderable content blocks.
 * UI: draggable list for `reorderable` kinds; fixed sections for `locked`.
 */

export type EventComposerBlockKind =
  | 'title'
  | 'banner'
  | 'schedule'
  | 'venue'
  | 'price'
  | 'description'
  | 'highlights'
  | 'faq'
  | 'cta';

export type EventComposerBlock = {
  id: string;
  kind: EventComposerBlockKind;
  /** When false, user may reorder among other reorderable blocks (same parent section). */
  locked: boolean;
};

/** Blocks that must stay in canonical order relative to each other (implement in screen logic). */
export const LOCKED_EVENT_COMPOSER_KINDS: ReadonlySet<EventComposerBlockKind> = new Set([
  'title',
  'banner',
  'price',
]);

const defaultBlueprint: EventComposerBlock[] = [
  { id: 'title', kind: 'title', locked: true },
  { id: 'banner', kind: 'banner', locked: true },
  { id: 'schedule', kind: 'schedule', locked: false },
  { id: 'venue', kind: 'venue', locked: false },
  { id: 'price', kind: 'price', locked: true },
  { id: 'description', kind: 'description', locked: false },
  { id: 'highlights', kind: 'highlights', locked: false },
  { id: 'faq', kind: 'faq', locked: false },
  { id: 'cta', kind: 'cta', locked: false },
];

export function defaultEventComposerLayout(): EventComposerBlock[] {
  return defaultBlueprint.map((b) => ({ ...b }));
}

/**
 * Validates a user-defined order: locked kinds must appear before any reorderable that depends on context
 * (simplified rule — extend when you add nested sections).
 */
export function assertValidComposerOrder(blocks: EventComposerBlock[]): boolean {
  const kinds = blocks.map((b) => b.kind);
  const ti = kinds.indexOf('title');
  const bi = kinds.indexOf('banner');
  const pi = kinds.indexOf('price');
  if (ti === -1 || bi === -1) return false;
  if (ti > bi) return false;
  if (pi !== -1 && pi < bi) return false;
  for (const b of blocks) {
    if (LOCKED_EVENT_COMPOSER_KINDS.has(b.kind) && !b.locked) return false;
  }
  return true;
}
