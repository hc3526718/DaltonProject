import type { ProposalKind } from '../roadmap/proposalService';

export type OutreachProposalContext = {
  kind: ProposalKind;
  payload: Record<string, unknown>;
  authorFirstName?: string | null;
  authorUsername?: string | null;
  authorDisplayName?: string | null;
};

function proposalSubjectLabel(kind: ProposalKind, payload: Record<string, unknown>): string {
  if (kind === 'sponsor') {
    const brand = String(payload.brand_name ?? payload.business_name ?? '').trim();
    if (brand) return `${brand} sponsor`;
  }
  if (kind === 'media') {
    const title = String(payload.title ?? '').trim();
    if (title) return `${title} media`;
  }
  const title = String(payload.title ?? payload.event_title ?? '').trim();
  if (title) return `${title} event`;
  return kind === 'event' ? 'event' : kind === 'media' ? 'media' : 'sponsor';
}

function greetName(ctx: OutreachProposalContext): string {
  const first = ctx.authorFirstName?.trim();
  if (first) return first;
  const user = ctx.authorUsername?.trim();
  if (user) return user.startsWith('@') ? user.slice(1) : user;
  const dn = ctx.authorDisplayName?.trim();
  if (dn && !dn.includes('@')) return dn.split(/\s+/)[0] ?? dn;
  if (dn?.includes('@')) return dn.split('@')[0]?.trim() || 'there';
  return 'there';
}

/** Standard master outreach draft for mandatory applicant contact before approve/reject. */
export function buildProposalOutreachMessage(ctx: OutreachProposalContext): string {
  const name = greetName(ctx);
  const subject = proposalSubjectLabel(ctx.kind, ctx.payload);
  return `Hi there ${name}. I am reaching out in regards to your ${subject} proposal. We wanted to find out some more information with relation to your proposal and if you would be available to have a zoom meeting to discuss further before we move forward.`;
}
