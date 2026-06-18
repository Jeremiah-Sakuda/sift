# Changelog

All notable changes to Sift are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

Improvements from an unbiased reaction panel (OSS devs, reviewers, consumers).

### Verify — honesty & quality
- Verdict aggregation no longer over-claims: a single dead link among live sources
  no longer forces "Fabricated citations", and a `partial` no longer earns the green
  "Sourced & supported" badge — partial support is its own `Partially supported`
  verdict, with a per-claim coverage breakdown.
- Per-claim rationale now explains *why* a check was unverifiable (404, blocked /
  timed-out / JS-rendered, or beyond the source limit).
- Readability-lite source extraction: drops nav/footer/aside/form chrome and isolates
  `<main>`/`<article>` so the judge sees the article, not boilerplate.
- Cost is visible: an estimate before you click Verify and the measured cost after.
- A labeled entailment eval (`npm run eval`) reports accuracy and the false-supported rate.

### Verify — security
- SSRF guard on cited-source fetches: internal/loopback/link-local (incl. the cloud
  metadata IP)/private hosts are blocked, before fetch and after redirects.
- Source fetches omit credentials (no cookie/session leakage to third parties).
- Entailment is hardened against prompt injection: fetched text is fenced as untrusted
  and blatant override lines are defanged.

### Verify — flexibility
- Configurable provider: Anthropic, or a local / OpenAI-compatible server (Ollama,
  llama.cpp, LiteLLM) so page + source text can stay on-device.

### Performance & UX
- The all-pages MutationObserver is gated: a permanent observer attaches only on
  host-specific AI surfaces; other origins get a few bounded re-scans.
- Popup always exposes the default-level control, even on non-web pages.
- Appearance toggles (badges/outline) now apply live to open tabs.

### Project health
- GitHub Actions CI (type-check + test + chrome/firefox build) on PRs.
- Per-surface selector fixtures guard against selector rot; a pipeline contract test
  pins the claim→citation indexing.
- Issue forms (broken AI surface, bug) and a PR template.
- README repositioned around the fact-checker use case; Chrome Web Store listing guide
  (`docs/STORE.md`).

## [0.1.0] — 2026-06-08

Initial release. Implements the v0 (Tag + Block) and v1 (Verify) scope from the PRD.

### Added

- **Intensity gradient** — a single Off · Tag · Verify · Block dial, with a global
  default and per-site overrides, all persisted in `chrome.storage.local`.
- **Tag** — outlines and badges known AI surfaces; the badge names the surface on hover
  and can be dismissed per element.
- **Block** — removes known AI surfaces via `display:none`, restoring layout cleanly on
  toggle-off.
- **Verify** (the differentiator) — for AI answer surfaces, a per-answer check that:
  extracts factual claims and citations, flags dead/fabricated cited links (cheap check
  first), fetches live sources and tests claim support via the Anthropic API
  (bring-your-own key), and annotates an honest verdict
  (`Sourced & supported` / `Unsupported claims` / `Fabricated citations` / `Unverifiable`).
  On-demand, cached per answer, and refuses rather than guesses when it can't verify.
- **Bundled selector list** (v1) covering Google AI Overview, Google AI Mode, Perplexity,
  Microsoft Copilot, Bing Copilot summary, Gemini, Meta AI, and OpenAI ChatKit — each
  identified only by certain, vendor-owned structure.
- **Popup** (intensity dial, per-site toggle) and **Options** page (defaults, per-site
  lists, API key + test, model picker, source-fetch permission, appearance, surface list).
- Privacy-first design: no servers, no analytics; source fetching is an explicit,
  runtime-granted opt-in.
- Unit tests (Vitest), generated icons, and full docs (README, PRIVACY, CONTRIBUTING,
  SELECTORS).

### Known limitations

- Shadow-DOM surfaces (e.g. legacy Bing `cib-*` chat) are not yet detectable.
- Selector list is bundled; remote updates land in v2.
- Firefox support is a later target.
