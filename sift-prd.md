# Sift — Product Requirements Document

**Owner:** Jeremiah
**Status:** Draft for build handoff
**Target:** Browser extension (Chromium first), TypeScript

---

## Summary

Sift is a browser extension that gives users control over AI on the pages they visit, along a single intensity gradient: **tag** it, **verify** it, or **block** it. The stance is user agency and verification over assertion — not "AI is bad." The differentiated layer is verify, which checks whether an AI answer's claims are actually backed by the sources it cites and tags its trustworthiness instead of guessing.

---

## Problem & positioning

AI features now ship into pages whether or not the user asked for them, with no signal of whether their output is grounded. Sift puts that decision back with the user. The default posture is sift-and-verify; full blocking is the far end of the dial, not the headline. This framing keeps the product pro-trustworthy-AI rather than anti-AI, which matters because the verify layer — not the blocker — is the part worth building and the part that argues for good AI.

One credibility rule governs the whole product: **Sift only acts on AI it can identify with certainty.** It labels and verifies known AI *surfaces* (the AI Overview block, the Copilot panel). It never tries to guess whether arbitrary text or an image was AI-generated — that detection is unreliable, and one false "this is AI" on a human's post would torch the trust the tool runs on.

---

## Core concept: the intensity gradient

A single control with three levels. Each is the same idea — separating signal from noise — at increasing strength.

| Level | What it does | Detection basis | Cost |
|-------|--------------|-----------------|------|
| **Tag** | Marks AI features on the page with an unobtrusive badge/outline | Known-surface selector list | Free, instant |
| **Verify** | Checks an AI answer's citations and claim support, annotates trust | Known answer surfaces + on-demand source fetch | Slow / paid (LLM) |
| **Block** | Removes AI features entirely (`display:none`) | Same selector list as Tag | Free, instant |

Default level is **Tag**. Block is opt-in.

---

## Tiers in detail

### Tag
- Match known AI UI elements against a versioned selector list and apply a small, dismissible visual marker.
- Marker shows the surface name on hover (e.g. "Google AI Overview").
- **Constraint:** no heuristic content detection. Only structurally identifiable AI features are tagged.

### Verify (the differentiator)
For AI *answer* surfaces identified by the selector list:
1. **Extract** the answer's factual claims and the citations it provides.
2. **Cheap check (ship first):** resolve each cited URL; flag dead links and fabricated citations (a strong, low-cost hallucination signal — papers/links that don't exist).
3. **Support check:** fetch live cited sources and test whether they actually back each claim (entailment via an LLM call).
4. **Annotate** each answer with a confidence state: `sourced & supported` / `unsupported claims` / `fabricated citations` / `unverifiable`.
5. **REFUSE semantics:** when Sift cannot verify, it says so plainly. It never fabricates a verdict or guesses confidence.
- **On-demand by default** ("Verify this" button per answer). Always-on verification is too slow and too expensive to be the default.
- Cache results per answer to avoid re-checking.

### Block
- Same detection as Tag, action is removal.
- Global toggle plus per-site override.
- Must not break page layout or leave dangling containers.

---

## Settings & UX surfaces

- **Popup:** the intensity selector (Off / Tag / Verify / Block), a per-site toggle, and a link to settings. A donation link lives here (see Open Questions).
- **Options page:** global default level, per-site allow/deny lists, selector-list status, and the API key field for the verify tier.
- **Persistence:** `chrome.storage.local` for all settings. (Do not use `localStorage`; in MV3 the service worker is ephemeral and `chrome.storage` is the correct API.)

---

## Architecture & tech stack

- **Manifest V3.** Chromium targets first (Chrome, Edge, Brave). Firefox is a later target — its MV3 has differences; isolate browser-specific code.
- **Framework:** WXT (MV3-native, TypeScript-first, handles cross-browser boilerplate). Alternative: Vite + `@crxjs/vite-plugin`.
- **Language:** TypeScript.
- **UI:** React for popup and options page. Tailwind optional.
- **Components:**
  - *Content script* — detects elements, applies tags/removal, injects the per-answer Verify button.
  - *Background service worker* — orchestrates verify (claim extraction, fetches, LLM call), reads/writes settings. Hold no state in memory; persist to storage.
  - *Popup* and *Options* — React apps.
- **Selector list:** a versioned JSON describing known AI surfaces (CSS selectors + surface name + type: `feature` | `answer`). v0 bundles a static list; v2 fetches updates remotely, ad-block style. Keep matching logic decoupled from the list so surfaces can be added without touching core code.
- **Verify backend:** **bring-your-own API key** (Anthropic by default), stored in `chrome.storage.local`. This keeps hosting cost at zero, which fits the free + donation model. No server, no proxy in early versions.
- **Privacy:** no browsing data leaves the device except the explicit, user-initiated source fetches and LLM call during a Verify action. No analytics in v0; any future telemetry is local and opt-in.

> Claude Code: confirm current MV3 APIs and WXT conventions against their docs before scaffolding — extension APIs move.

---

## Phased scope

**v0 (MVP) — Tag + Block**
- Static bundled selector list covering 6–8 major surfaces (Google AI Overview, Microsoft Copilot panel, Gemini app, Meta AI, ChatGPT/Claude widgets embedded on third-party sites, Perplexity answer block).
- Popup with Off / Tag / Block; per-site and global; persistence.
- Verify level present in the UI but disabled/"coming soon."
- Ships useful on day one and validates the detection approach.

**v1 — Verify**
- Claim + citation extraction; cheap fabricated-citation check first; then source-support entailment via BYO key.
- Confidence annotation UI; on-demand button; result caching.

**v2 — Scale**
- Remote-updatable selector list; more surfaces; Firefox support; optional crowdsourced list.

---

## Acceptance criteria (v0)

- On a Google search showing an AI Overview: Tag outlines and labels it; Block removes it; the rest of the page stays usable.
- Per-site override and global default both persist across reloads and browser restart.
- Blocking an element leaves no broken layout or empty container.
- No console errors during detect/tag/block on any covered surface.
- All settings read/write through `chrome.storage.local`.

---

## Non-goals

- No heuristic detection of AI-*written* text or AI-*generated* images. Only known AI surfaces.
- No always-on verification in v0.
- No accounts, no server, no collection of browsing data.
- Not a general-purpose ad blocker.

---

## Key constraints & risks

- **Selector arms race.** Sites reship and A/B test their DOM. Design the selector list to be updatable and keep it out of core logic so surfaces can be repaired quickly.
- **Verify latency and cost.** On-demand only, cheap checks before expensive ones, cache aggressively.
- **MV3 service worker lifecycle.** Workers are killed when idle; never rely on in-memory state, always rehydrate from storage.
- **Positioning in defaults.** Default level is Tag, not Block, so the shipped posture reads as sift-and-verify rather than anti-AI.

---

## Open questions (human decisions before handoff)

- **Verify LLM:** Anthropic as default, BYO key — confirm. Any hosted fallback later?
- **v0 surface list:** lock the exact 6–8 surfaces to bundle.
- **Monetization placement:** donation link in popup and/or options — GitHub Sponsors vs Open Collective (Open Collective gives a public ledger that fits the trust brand).
- **License:** MIT recommended — open source strengthens both the trust narrative and the donation case.
- **Name:** Sift (confirmed).
