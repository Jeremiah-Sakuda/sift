/**
 * Storage layer. ALL persistence goes through chrome.storage.local — never
 * localStorage — because the MV3 service worker is ephemeral and only
 * chrome.storage survives worker shutdown (PRD constraint).
 *
 * The background worker holds no state in memory; it rehydrates from here.
 */

import { browser } from './browser';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  SCHEMA_VERSION,
  VERIFY_CACHE_MAX,
} from './config';
import type { Settings, Level, VerifyResult } from './types';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Deep-ish merge of stored settings over defaults, tolerant of partial/legacy shapes. */
function withDefaults(stored: Partial<Settings> | undefined): Settings {
  if (!stored) return structuredClone(DEFAULT_SETTINGS);
  return {
    schemaVersion: SCHEMA_VERSION,
    globalLevel: stored.globalLevel ?? DEFAULT_SETTINGS.globalLevel,
    siteOverrides: { ...DEFAULT_SETTINGS.siteOverrides, ...(stored.siteOverrides ?? {}) },
    verify: { ...DEFAULT_SETTINGS.verify, ...(stored.verify ?? {}) },
    ui: { ...DEFAULT_SETTINGS.ui, ...(stored.ui ?? {}) },
  };
}

export async function getSettings(): Promise<Settings> {
  const raw = await browser.storage.local.get(STORAGE_KEYS.settings);
  return withDefaults(raw[STORAGE_KEYS.settings] as Partial<Settings> | undefined);
}

export async function setSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

/** Read-modify-write a single update onto settings, atomically enough for our needs. */
export async function updateSettings(
  patch: (current: Settings) => Settings,
): Promise<Settings> {
  const current = await getSettings();
  const next = patch(current);
  await setSettings(next);
  return next;
}

// ---------------------------------------------------------------------------
// Effective level resolution (per-site override beats global default)
// ---------------------------------------------------------------------------

export interface EffectiveLevel {
  level: Level;
  source: 'override' | 'global';
}

export function resolveLevel(settings: Settings, hostname: string): EffectiveLevel {
  const host = normalizeHostname(hostname);
  const override = settings.siteOverrides[host];
  if (override) return { level: override, source: 'override' };
  return { level: settings.globalLevel, source: 'global' };
}

export async function getEffectiveLevel(hostname: string): Promise<EffectiveLevel> {
  return resolveLevel(await getSettings(), hostname);
}

/** Strip protocol, port, leading www., and lowercase. Tolerant of full URLs. */
export function normalizeHostname(input: string): string {
  let host = input.trim().toLowerCase();
  try {
    if (host.includes('://')) host = new URL(host).hostname;
  } catch {
    /* fall through, treat as bare host */
  }
  host = host.replace(/^www\./, '').replace(/:\d+$/, '');
  return host;
}

export async function setGlobalLevel(level: Level): Promise<Settings> {
  return updateSettings((s) => ({ ...s, globalLevel: level }));
}

export async function setSiteOverride(hostname: string, level: Level | null): Promise<Settings> {
  const host = normalizeHostname(hostname);
  return updateSettings((s) => {
    const siteOverrides = { ...s.siteOverrides };
    if (level === null) delete siteOverrides[host];
    else siteOverrides[host] = level;
    return { ...s, siteOverrides };
  });
}

// ---------------------------------------------------------------------------
// Verify result cache (answerHash -> VerifyResult)
// ---------------------------------------------------------------------------

type VerifyCache = Record<string, VerifyResult>;

async function getVerifyCache(): Promise<VerifyCache> {
  const raw = await browser.storage.local.get(STORAGE_KEYS.verifyCache);
  return (raw[STORAGE_KEYS.verifyCache] as VerifyCache | undefined) ?? {};
}

export async function getCachedVerify(answerHash: string): Promise<VerifyResult | null> {
  const cache = await getVerifyCache();
  return cache[answerHash] ?? null;
}

export async function putCachedVerify(result: VerifyResult): Promise<void> {
  const cache = await getVerifyCache();
  cache[result.answerHash] = result;

  // Evict oldest by createdAt once over the cap.
  const keys = Object.keys(cache);
  if (keys.length > VERIFY_CACHE_MAX) {
    const sorted = keys.sort(
      (a, b) => Date.parse(cache[a].createdAt) - Date.parse(cache[b].createdAt),
    );
    for (const key of sorted.slice(0, keys.length - VERIFY_CACHE_MAX)) {
      delete cache[key];
    }
  }
  await browser.storage.local.set({ [STORAGE_KEYS.verifyCache]: cache });
}

export async function clearVerifyCache(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEYS.verifyCache);
}

// ---------------------------------------------------------------------------
// Change subscription (popup/options/content react to settings edits live)
// ---------------------------------------------------------------------------

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEYS.settings];
    if (change) callback(withDefaults(change.newValue as Partial<Settings> | undefined));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** Ensure settings exist on first run so other contexts read a complete object. */
export async function ensureInitialized(): Promise<Settings> {
  const raw = await browser.storage.local.get(STORAGE_KEYS.settings);
  if (!raw[STORAGE_KEYS.settings]) {
    const settings = structuredClone(DEFAULT_SETTINGS);
    await setSettings(settings);
    return settings;
  }
  return withDefaults(raw[STORAGE_KEYS.settings] as Partial<Settings>);
}
