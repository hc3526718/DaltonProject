type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeSavedMediaChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySavedMediaChange(): void {
  listeners.forEach((fn) => fn());
}
