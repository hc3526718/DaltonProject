import { useCallback } from 'react';

/** Wizard back: previous step, or exit screen when on step 1. */
export function useWizardBack(step: number, setStep: (n: number) => void, onExit: () => void) {
  return useCallback(() => {
    if (step > 1) setStep(step - 1);
    else onExit();
  }, [step, setStep, onExit]);
}
