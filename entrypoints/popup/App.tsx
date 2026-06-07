import { useEffect, useState } from 'react';
import { browser } from '@/lib/browser';
import { useSettings } from '@/components/useSettings';
import { LevelSelector } from '@/components/LevelSelector';
import { Logo } from '@/components/Logo';
import { resolveLevel, normalizeHostname } from '@/lib/storage';
import { DONATION_URL } from '@/lib/config';
import type { Level } from '@/lib/types';

export function App() {
  const { settings, update } = useSettings();
  const [host, setHost] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      const url = tab?.url ?? '';
      if (url.startsWith('http://') || url.startsWith('https://')) setHost(normalizeHostname(url));
      else setHost(null);
    });
  }, []);

  if (!settings || host === undefined) {
    return (
      <div className="popup">
        <Header />
        <p className="empty">Loading…</p>
      </div>
    );
  }

  if (host === null) {
    return (
      <div className="popup">
        <Header onOptions={() => browser.runtime.openOptionsPage()} />
        <p className="empty">Sift only runs on web pages (http/https).</p>
      </div>
    );
  }

  const effective = resolveLevel(settings, host);
  const isOverride = effective.source === 'override';
  const hasKey = !!settings.verify.apiKey;
  const verifyChosen = effective.level === 'verify' || settings.globalLevel === 'verify';

  const setSiteLevel = (level: Level) =>
    update((s) => ({ ...s, siteOverrides: { ...s.siteOverrides, [host]: level } }));

  const resetSite = () =>
    update((s) => {
      const siteOverrides = { ...s.siteOverrides };
      delete siteOverrides[host];
      return { ...s, siteOverrides };
    });

  const setGlobal = (level: Level) => update((s) => ({ ...s, globalLevel: level }));

  return (
    <div className="popup">
      <Header onOptions={() => browser.runtime.openOptionsPage()} />

      <div>
        <div className="row spread" style={{ marginBottom: 8 }}>
          <div className="section-label" style={{ margin: 0 }}>
            On this site
          </div>
          <div className="site">
            <span className="host">{host}</span>
          </div>
        </div>
        <LevelSelector value={effective.level} onChange={setSiteLevel} />
        <div className="row spread small" style={{ marginTop: 6 }}>
          <span className="muted">
            {isOverride ? 'Custom setting for this site' : 'Following your default'}
          </span>
          {isOverride && (
            <button className="btn ghost small" onClick={resetSite}>
              Reset to default
            </button>
          )}
        </div>
      </div>

      {verifyChosen && !hasKey && (
        <div className="hint warn">
          Verify needs an Anthropic API key.{' '}
          <a href="#" onClick={(e) => (e.preventDefault(), browser.runtime.openOptionsPage())}>
            Add one in options →
          </a>
        </div>
      )}

      <div className="divider" />

      <div>
        <div className="section-label">Default for new sites</div>
        <LevelSelector size="sm" value={settings.globalLevel} onChange={setGlobal} />
      </div>

      <footer>
        <a href="#" onClick={(e) => (e.preventDefault(), browser.runtime.openOptionsPage())}>
          Settings
        </a>
        <a href={DONATION_URL} target="_blank" rel="noreferrer">
          ♥ Support Sift
        </a>
      </footer>
    </div>
  );
}

function Header({ onOptions }: { onOptions?: () => void }) {
  return (
    <header>
      <div className="brand">
        <Logo />
        <div>
          <div className="name">Sift</div>
          <div className="tagline">Tag · Verify · Block AI</div>
        </div>
      </div>
      {onOptions && (
        <button className="gear" title="Settings" onClick={onOptions} aria-label="Settings">
          ⚙
        </button>
      )}
    </header>
  );
}
