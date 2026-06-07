/**
 * Pure settings logic — defaults merging and level resolution — with no
 * extension-API dependency, so it is unit-testable in plain Node. The I/O layer
 * (storage.ts) builds on top of this.
 */

import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './config';
import type { Settings, Level } from './types';

/** Merge stored settings over defaults, tolerant of partial/legacy shapes. */
export function withDefaults(stored: Partial<Settings> | undefined): Settings {
  if (!stored) return structuredClone(DEFAULT_SETTINGS);
  return {
    schemaVersion: SCHEMA_VERSION,
    globalLevel: stored.globalLevel ?? DEFAULT_SETTINGS.globalLevel,
    siteOverrides: { ...DEFAULT_SETTINGS.siteOverrides, ...(stored.siteOverrides ?? {}) },
    verify: { ...DEFAULT_SETTINGS.verify, ...(stored.verify ?? {}) },
    ui: { ...DEFAULT_SETTINGS.ui, ...(stored.ui ?? {}) },
  };
}

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
