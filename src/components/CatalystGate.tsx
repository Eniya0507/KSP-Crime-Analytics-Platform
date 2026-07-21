import { useEffect, type ReactNode } from 'react';
import { getCatalystConfig } from '../lib/catalyst';
import { reloadLiveCache } from '../lib/db';
import { initLocalDb } from '../lib/localDb';

interface Props { children: ReactNode; }

export default function CatalystGate({ children }: Props) {
  useEffect(() => {
    // 1 — Initialize local database fallback first
    initLocalDb();

    // 2 — In the background, reload the live cache if configured
    const cfg = getCatalystConfig();
    if (cfg.projectId && cfg.token) {
      reloadLiveCache().catch(err => {
        console.warn('[CatalystGate] Background live cache sync failed:', err);
      });
    }
  }, []);

  return <>{children}</>;
}
