import { useCallback, useEffect, useState } from 'react';
import { getSettings, setSettings, onSettingsChanged } from '@/lib/storage';
import type { Settings } from '@/lib/types';

/**
 * React hook around the settings store. Loads once, stays in sync with edits
 * from any context (popup, options, other tabs) via chrome.storage.onChanged.
 */
export function useSettings() {
  const [settings, setLocal] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    void getSettings().then((s) => alive && setLocal(s));
    const off = onSettingsChanged((s) => setLocal(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const update = useCallback(async (patch: (s: Settings) => Settings) => {
    const current = await getSettings();
    const next = patch(current);
    await setSettings(next);
    setLocal(next);
  }, []);

  return { settings, update };
}
