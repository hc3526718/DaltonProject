import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus(): { online: boolean; state: NetInfoState | null } {
  const [online, setOnline] = useState(true);
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      setState(s);
      setOnline(Boolean(s.isConnected && s.isInternetReachable !== false));
    });
    void NetInfo.fetch().then((s) => {
      setState(s);
      setOnline(Boolean(s.isConnected && s.isInternetReachable !== false));
    });
    return () => sub();
  }, []);

  return { online, state };
}
