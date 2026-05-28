let openOutcomeModal: ((proposalId: string) => void) | null = null;

export function registerProposalOutcomeOpener(fn: (proposalId: string) => void): void {
  openOutcomeModal = fn;
}

export function requestProposalOutcomeModal(proposalId: string): void {
  openOutcomeModal?.(proposalId);
}
