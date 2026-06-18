/**
 * Sift — shared type contracts.
 *
 * These types are the single source of truth shared across the content script,
 * background service worker, popup, and options page. They have no runtime
 * dependencies so they can be imported from any extension context.
 */

// ---------------------------------------------------------------------------
// Intensity gradient
// ---------------------------------------------------------------------------

/**
 * The single intensity control. Each step is the same idea — separating signal
 * from noise — at increasing strength.
 *
 * - `off`    — Sift does nothing on the page.
 * - `tag`    — mark known AI surfaces with an unobtrusive badge/outline.
 * - `verify` — tag, plus offer per-answer citation/support verification.
 * - `block`  — remove known AI surfaces entirely.
 */
export type Level = 'off' | 'tag' | 'verify' | 'block';

export const LEVELS: Level[] = ['off', 'tag', 'verify', 'block'];

export const LEVEL_LABELS: Record<Level, string> = {
  off: 'Off',
  tag: 'Tag',
  verify: 'Verify',
  block: 'Block',
};

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  off: 'Sift takes no action on this page.',
  tag: 'Mark known AI features with a small badge you can hover and dismiss.',
  verify: 'Tag, plus check whether an AI answer is actually backed by its sources.',
  block: 'Remove known AI features from the page entirely.',
};

// ---------------------------------------------------------------------------
// Selector list — the versioned description of known AI surfaces
// ---------------------------------------------------------------------------

/**
 * `answer` surfaces produce a citable AI answer worth verifying.
 * `feature` surfaces are generic AI UI (panels, entry points) — tag/block only.
 */
export type SurfaceType = 'feature' | 'answer';

export type Confidence = 'high' | 'medium' | 'low';

export interface SurfaceSelector {
  /** A CSS selector matching the surface container. */
  css: string;
  /** Human note on what this selector targets / why. */
  description?: string;
  /** How reliable this selector is expected to be over time. */
  confidence?: Confidence;
}

export interface Surface {
  /** Stable identifier, e.g. `google-ai-overview`. Never reused for a different surface. */
  id: string;
  /** Display name shown on the tag badge, e.g. "Google AI Overview". */
  name: string;
  /** Owning product/vendor, e.g. "Google". */
  vendor: string;
  /** Whether this is a verifiable answer or a generic AI feature. */
  type: SurfaceType;
  /**
   * URL match patterns (host globs, e.g. `*.google.com`, `www.bing.com`) where
   * this surface can appear. Matching is decoupled from the engine so surfaces
   * can be repaired/added without touching core logic.
   */
  matches: string[];
  /** Container selectors, most-specific/most-reliable first (fallback ordered). */
  selectors: SurfaceSelector[];
  /** For `answer` surfaces: selector (scoped to the container) for citation links. */
  citationSelector?: string;
  /** For `answer` surfaces: selector (scoped to the container) for the answer text region. */
  answerTextSelector?: string;
  /** Maintenance notes: stability, A/B variance, how to re-verify in DevTools. */
  notes?: string;
  /** Allow shipping a surface disabled by default. Defaults to true. */
  enabled?: boolean;
}

export interface SelectorList {
  /** Monotonic content version. Bump whenever surfaces change. */
  version: number;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
  /** Where this list came from. v0 is always `bundled`; v2 adds `remote`. */
  source: 'bundled' | 'remote';
  surfaces: Surface[];
}

// ---------------------------------------------------------------------------
// Settings (persisted in chrome.storage.local)
// ---------------------------------------------------------------------------

export type VerifyProvider = 'anthropic' | 'openai-compatible';

export interface VerifySettings {
  provider: VerifyProvider;
  /** Bring-your-own API key. Stored in chrome.storage.local, never leaves device except the verify call. */
  apiKey: string;
  /**
   * Endpoint base override. Empty = the provider default. Lets a privacy-minded
   * user point Verify at a local / self-hosted OpenAI-compatible server (Ollama,
   * llama.cpp, LiteLLM) so page + source text never reaches a commercial cloud.
   */
  baseUrl: string;
  /** Model id used for claim extraction + entailment. */
  model: string;
  /** Cap on how many cited sources are fetched per verification (cost control). */
  maxSourcesPerCheck: number;
  /** Per-source fetch timeout (ms). */
  fetchTimeoutMs: number;
}

export interface UiSettings {
  /** Show the hover badge on tagged surfaces. */
  showBadges: boolean;
  /** Outline tagged surfaces (vs. badge only). */
  showOutline: boolean;
}

export interface Settings {
  /** Storage schema version, for migrations. */
  schemaVersion: number;
  /** Default intensity applied to sites without an explicit override. */
  globalLevel: Level;
  /** Per-hostname explicit level. Absent host => use globalLevel. */
  siteOverrides: Record<string, Level>;
  verify: VerifySettings;
  ui: UiSettings;
}

// ---------------------------------------------------------------------------
// Verify pipeline
// ---------------------------------------------------------------------------

export type CitationStatus = 'ok' | 'dead' | 'unreachable' | 'unchecked';

export interface Citation {
  id: string;
  url: string;
  title?: string;
  status: CitationStatus;
  httpStatus?: number;
}

export interface Claim {
  id: string;
  text: string;
  /** Citation ids the answer attributes this claim to (may be empty). */
  citationIds: string[];
}

export type ClaimSupport =
  | 'supported'
  | 'partial'
  | 'unsupported'
  | 'no_source'
  | 'unverifiable';

export interface ClaimAssessment {
  claimId: string;
  support: ClaimSupport;
  /** Short, plain-language reason. Sift never fabricates a verdict. */
  rationale: string;
  /** Citation ids actually consulted for this judgement. */
  citationIds: string[];
}

/**
 * Overall confidence state surfaced to the user.
 * REFUSE semantics: `unverifiable` and `error` mean Sift could not check —
 * it says so plainly rather than guessing.
 */
export type VerifyVerdict =
  | 'sourced_supported'
  | 'partially_supported'
  | 'unsupported_claims'
  | 'fabricated_citations'
  | 'unverifiable'
  | 'error';

export const VERDICT_LABELS: Record<VerifyVerdict, string> = {
  sourced_supported: 'Sourced & supported',
  partially_supported: 'Partially supported',
  unsupported_claims: 'Unsupported claims',
  fabricated_citations: 'Fabricated citations',
  unverifiable: 'Unverifiable',
  error: 'Verification failed',
};

export type VerifyStage =
  | 'idle'
  | 'extracting'
  | 'fetching_sources'
  | 'judging'
  | 'done'
  | 'error';

export interface VerifyResult {
  surfaceId: string;
  /** Stable hash of the answer text — the cache key. */
  answerHash: string;
  verdict: VerifyVerdict;
  summary: string;
  claims: Claim[];
  citations: Citation[];
  assessments: ClaimAssessment[];
  model: string;
  createdAt: string;
  /** Token usage + rough USD cost of this verification (absent on cached/error short-circuits). */
  usage?: { inputTokens: number; outputTokens: number; estimatedUsd: number };
  /** Present when verdict is `error`. */
  error?: string;
}

/** Payload the content script sends to request verification of one answer. */
export interface VerifyRequest {
  surfaceId: string;
  answerHash: string;
  /** The extracted answer text (claims are extracted in the worker). */
  answerText: string;
  /** Citations discovered in the DOM (url + optional title). */
  citations: Array<{ url: string; title?: string }>;
  /** Page the answer was seen on (for logging/cache scoping, not transmitted to the LLM). */
  pageUrl: string;
}

// ---------------------------------------------------------------------------
// Messaging (content <-> background <-> popup/options)
// ---------------------------------------------------------------------------

export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'GET_EFFECTIVE_LEVEL'; hostname: string }
  | { type: 'GET_SELECTOR_LIST' }
  | { type: 'VERIFY_ANSWER'; request: VerifyRequest }
  | { type: 'GET_CACHED_VERIFY'; answerHash: string }
  | { type: 'VERIFY_PROGRESS'; answerHash: string; stage: VerifyStage; detail?: string }
  | { type: 'PING' };

export interface MessageResponseMap {
  GET_SETTINGS: Settings;
  GET_EFFECTIVE_LEVEL: { level: Level; source: 'override' | 'global' };
  GET_SELECTOR_LIST: SelectorList;
  VERIFY_ANSWER: VerifyResult;
  GET_CACHED_VERIFY: VerifyResult | null;
  VERIFY_PROGRESS: void;
  PING: { ok: true };
}
