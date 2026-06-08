# Changelog

All notable changes to Sift are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
