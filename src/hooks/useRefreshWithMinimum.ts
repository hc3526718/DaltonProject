import { useCallback, useState } from 'react';

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Pull-to-refresh that runs `loader` then waits until at least `minimumMs` have elapsed (default 4000). */
export function useRefreshWithMinimum(loader: () => void | Promise<void>, minimumMs = 4000) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    const started = Date.now();
    setRefreshing(true);
    try {
      await Promise.resolve(loader());
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed < minimumMs) await delay(minimumMs - elapsed);
      setRefreshing(false);
    }
  }, [loader, minimumMs]);
  return { refreshing, onRefresh };
}
