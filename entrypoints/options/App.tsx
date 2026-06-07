import { useEffect, useState, type ReactNode } from 'react';
import { browser } from '@/lib/browser';
import { useSettings } from '@/components/useSettings';
import { LevelSelector } from '@/components/LevelSelector';
import { Logo } from '@/components/Logo';
import { normalizeHostname, clearVerifyCache } from '@/lib/storage';
import { testApiKey } from '@/lib/verify/anthropic';
import { BUNDLED_SELECTOR_LIST } from '@/lib/selectors';
import { SUGGESTED_MODELS, DONATION_URL, PROJECT_URL } from '@/lib/config';
import { LEVELS, LEVEL_LABELS } from '@/lib/types';
import type { Level, Settings } from '@/lib/types';

const SOURCE_ORIGINS: { origins: string[] } = { origins: ['*://*/*'] };

export function App() {
  const { settings, update } = useSettings();
  if (!settings) return <div className="options">Loading…</div>;

  return (
    <div className="options">
      <header>
        <div className="brand">
          <Logo size={34} />
          <div>
            <div className="name" style={{ fontSize: 20 }}>
              Sift
            </div>
            <div className="tagline">Control AI on the pages you visit</div>
          </div>
        </div>
        <span className="pill">v{browser.runtime.getManifest().version}</span>
      </header>

      <DefaultLevelCard settings={settings} update={update} />
      <VerifyCard settings={settings} update={update} />
      <OverridesCard settings={settings} update={update} />
      <AppearanceCard settings={settings} update={update} />
      <SurfacesCard />
      <About />
    </div>
  );
}

type Props = { settings: Settings; update: (p: (s: Settings) => Settings) => Promise<void> };

function Card({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {desc && <p className="desc">{desc}</p>}
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function DefaultLevelCard({ settings, update }: Props) {
  return (
    <Card
      title="Default intensity"
      desc="Applied to every site that doesn't have its own setting. Tag is the recommended default."
    >
      <LevelSelector
        value={settings.globalLevel}
        onChange={(level) => update((s) => ({ ...s, globalLevel: level }))}
      />
    </Card>
  );
}

function VerifyCard({ settings, update }: Props) {
  const v = settings.verify;
  const [showKey, setShowKey] = useState(false);
  const [keyState, setKeyState] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');
  const [keyMsg, setKeyMsg] = useState('');
  const [canFetch, setCanFetch] = useState<boolean | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    void browser.permissions.contains(SOURCE_ORIGINS).then(setCanFetch);
  }, []);

  const isCustomModel = !SUGGESTED_MODELS.some((m) => m.id === v.model);

  const setVerify = (patch: Partial<Settings['verify']>) =>
    update((s) => ({ ...s, verify: { ...s.verify, ...patch } }));

  const test = async () => {
    setKeyState('testing');
    setKeyMsg('');
    const r = await testApiKey(v.apiKey, v.model);
    setKeyState(r.ok ? 'ok' : 'err');
    setKeyMsg(r.ok ? 'Key works.' : r.error ?? 'Failed.');
  };

  const enableFetch = async () => {
    const ok = await browser.permissions.request(SOURCE_ORIGINS);
    setCanFetch(ok);
  };
  const disableFetch = async () => {
    await browser.permissions.remove(SOURCE_ORIGINS);
    setCanFetch(false);
  };

  return (
    <Card
      title="Verify"
      desc="Verify checks whether an AI answer's claims are actually backed by the sources it cites — using your own Anthropic API key. Nothing leaves your device except the source fetches and the model call you trigger."
    >
      <div className="field">
        <label htmlFor="apikey">Anthropic API key</label>
        <div className="row">
          <input
            id="apikey"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-ant-…"
            value={v.apiKey}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setKeyState('idle');
              void setVerify({ apiKey: e.target.value.trim() });
            }}
          />
          <button className="btn" onClick={() => setShowKey((s) => !s)} type="button">
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button className="btn primary" onClick={test} disabled={!v.apiKey || keyState === 'testing'}>
            {keyState === 'testing' ? 'Testing…' : 'Test'}
          </button>
        </div>
        <span className="help">
          Stored only in this browser (chrome.storage.local).{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Get a key →
          </a>
        </span>
        {keyState === 'ok' && <div className="hint ok">{keyMsg}</div>}
        {keyState === 'err' && <div className="hint warn">{keyMsg}</div>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="model">Model</label>
          <select
            id="model"
            value={isCustomModel ? '__custom__' : v.model}
            onChange={(e) => {
              if (e.target.value !== '__custom__') void setVerify({ model: e.target.value });
            }}
          >
            {SUGGESTED_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          {isCustomModel && (
            <input
              type="text"
              value={v.model}
              placeholder="model-id"
              onChange={(e) => void setVerify({ model: e.target.value.trim() })}
            />
          )}
        </div>
        <div className="field">
          <label htmlFor="maxsrc">Max sources fetched per check</label>
          <input
            id="maxsrc"
            type="number"
            min={1}
            max={20}
            value={v.maxSourcesPerCheck}
            onChange={(e) =>
              void setVerify({ maxSourcesPerCheck: clampInt(e.target.value, 1, 20, 5) })
            }
          />
          <span className="help">Higher = more thorough, slower and more tokens.</span>
        </div>
      </div>

      <div className="field">
        <label>Fetch cited sources</label>
        <span className="help">
          Verify must download each cited page to check it. Grant Sift permission to read pages
          during a Verify (requested only when you enable it here).
        </span>
        {canFetch === null ? null : canFetch ? (
          <div className="row spread">
            <span className="hint ok" style={{ flex: 1 }}>
              <span className="status-dot" style={{ background: 'var(--ok)' }} />
              Source fetching is enabled.
            </span>
            <button className="btn" onClick={disableFetch}>
              Disable
            </button>
          </div>
        ) : (
          <div className="row spread">
            <span className="hint warn" style={{ flex: 1 }}>
              <span className="status-dot" style={{ background: 'var(--warn)' }} />
              Source fetching is off — Verify can't run until you enable it.
            </span>
            <button className="btn primary" onClick={enableFetch}>
              Enable
            </button>
          </div>
        )}
      </div>

      <div className="row spread">
        <span className="help">Cached verdicts are reused so the same answer isn't re-checked.</span>
        <button
          className="btn"
          onClick={async () => {
            await clearVerifyCache();
            setCacheCleared(true);
            setTimeout(() => setCacheCleared(false), 1500);
          }}
        >
          {cacheCleared ? 'Cleared ✓' : 'Clear verify cache'}
        </button>
      </div>
    </Card>
  );
}

function OverridesCard({ settings, update }: Props) {
  const [host, setHost] = useState('');
  const [level, setLevel] = useState<Level>('block');
  const entries = Object.entries(settings.siteOverrides).sort(([a], [b]) => a.localeCompare(b));

  const add = () => {
    const h = normalizeHostname(host);
    if (!h) return;
    void update((s) => ({ ...s, siteOverrides: { ...s.siteOverrides, [h]: level } }));
    setHost('');
  };
  const setOne = (h: string, l: Level) =>
    update((s) => ({ ...s, siteOverrides: { ...s.siteOverrides, [h]: l } }));
  const remove = (h: string) =>
    update((s) => {
      const o = { ...s.siteOverrides };
      delete o[h];
      return { ...s, siteOverrides: o };
    });

  return (
    <Card
      title="Per-site overrides"
      desc="Pin specific sites to a level regardless of your default. Useful for always-blocking one site or always-tagging another."
    >
      <div className="overrides">
        {entries.length === 0 && <p className="muted small">No overrides yet.</p>}
        {entries.map(([h, l]) => (
          <div className="override-row" key={h}>
            <span className="host" title={h}>
              {h}
            </span>
            <select value={l} onChange={(e) => setOne(h, e.target.value as Level)}>
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {LEVEL_LABELS[lv]}
                </option>
              ))}
            </select>
            <button className="btn ghost" onClick={() => remove(h)} aria-label={`Remove ${h}`}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="override-row" style={{ marginTop: 12 }}>
        <input
          type="text"
          placeholder="example.com"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
          {LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {LEVEL_LABELS[lv]}
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={add} disabled={!host.trim()}>
          Add
        </button>
      </div>
    </Card>
  );
}

function AppearanceCard({ settings, update }: Props) {
  return (
    <Card title="Appearance" desc="How tagged AI surfaces look on the page.">
      <div className="field">
        <Toggle
          checked={settings.ui.showOutline}
          onChange={(val) => update((s) => ({ ...s, ui: { ...s.ui, showOutline: val } }))}
          label="Outline tagged AI surfaces"
        />
      </div>
      <div className="field">
        <Toggle
          checked={settings.ui.showBadges}
          onChange={(val) => update((s) => ({ ...s, ui: { ...s.ui, showBadges: val } }))}
          label="Show the Sift badge (and Verify button) on tagged surfaces"
        />
      </div>
    </Card>
  );
}

function SurfacesCard() {
  const list = BUNDLED_SELECTOR_LIST;
  return (
    <Card
      title="Known AI surfaces"
      desc={`Sift only acts on AI it can identify with certainty. Bundled list v${list.version} (${list.updatedAt}).`}
    >
      <div className="surface-list">
        {list.surfaces.map((s) => (
          <div className="surface" key={s.id}>
            <div>
              <div>{s.name}</div>
              <div className="vendor">{s.vendor}</div>
            </div>
            <span className={`tag-type ${s.type}`}>{s.type}</span>
            <span className="muted small">{s.matches.join(', ')}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function About() {
  return (
    <div className="about">
      <div className="links">
        <a href={PROJECT_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={DONATION_URL} target="_blank" rel="noreferrer">
          ♥ Support Sift
        </a>
        <a href={`${PROJECT_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noreferrer">
          Privacy
        </a>
      </div>
      <div>Sift is open source under the MIT license. No accounts, no servers, no tracking.</div>
    </div>
  );
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
