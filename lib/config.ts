/**
 * Tunable constants and storage keys. Kept in one place so cost/behaviour knobs
 * and the (movable) Anthropic API details are easy to find and adjust.
 */

import type { Settings, Level } from './types';

export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  /** The single Settings object. */
  settings: 'sift:settings',
  /** Map of answerHash -> VerifyResult. */
  verifyCache: 'sift:verifyCache',
} as const;

// --- Verify / Anthropic -----------------------------------------------------

export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
/** Required to permit direct calls from a browser/extension context (CORS). */
export const ANTHROPIC_BROWSER_HEADER = 'anthropic-dangerous-direct-browser-access';

/** Fast, low-cost model — good default for cheap entailment checks. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';

/** Suggested models surfaced in the options dropdown. */
export const SUGGESTED_MODELS: { id: string; label: string }[] = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast, low cost (recommended)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — higher quality, slower' },
];

/** USD per 1M tokens (input/output), for rough cost estimates. Approximate list prices. */
export const MODEL_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  'claude-haiku-4-5': { inputPerM: 1.0, outputPerM: 5.0 },
  'claude-sonnet-4-6': { inputPerM: 3.0, outputPerM: 15.0 },
  'claude-opus-4-8': { inputPerM: 5.0, outputPerM: 25.0 },
};

/** Fallback pricing when a custom/unknown model id is used. */
export const FALLBACK_PRICING = { inputPerM: 3.0, outputPerM: 15.0 };

/** Hard cap on cached verify results; oldest evicted first. */
export const VERIFY_CACHE_MAX = 200;

/** Default per-source fetch timeout (ms). */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/** Default cap on cited sources fetched per verification. */
export const DEFAULT_MAX_SOURCES = 5;

/** Cap on characters of fetched source text passed to the model (cost control). */
export const MAX_SOURCE_CHARS = 12_000;

/** Cap on characters of answer text passed to the model. */
export const MAX_ANSWER_CHARS = 8_000;

// --- Defaults ---------------------------------------------------------------

export const DEFAULT_LEVEL: Level = 'tag';

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  globalLevel: DEFAULT_LEVEL,
  siteOverrides: {},
  verify: {
    provider: 'anthropic',
    apiKey: '',
    baseUrl: '',
    model: DEFAULT_ANTHROPIC_MODEL,
    maxSourcesPerCheck: DEFAULT_MAX_SOURCES,
    fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
  },
  ui: {
    showBadges: true,
    showOutline: true,
  },
};

/** Donation link shown in popup/options (monetization placement is a tunable). */
export const DONATION_URL = 'https://github.com/sponsors/Jeremiah-Sakuda';
export const PROJECT_URL = 'https://github.com/Jeremiah-Sakuda/sift';
