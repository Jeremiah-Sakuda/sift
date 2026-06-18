<div align="center">

<img src="public/icon/128.png" width="72" height="72" alt="Sift logo" />

# Sift

**When an AI answer cites sources, Sift checks whether those sources actually back the
claims — and tells you plainly when it can't.**

A browser extension for researchers, journalists, and anyone who reads AI answers but
doesn't take them on faith. It also tags or blocks the known AI surfaces sites ship at
you — but the part worth building is **Verify**.

**Free, no setup:** Tag and Block need no account, no API key, and no permissions.
**Verify** is the optional power feature (bring-your-own model, or a local one).

[Install (dev)](#getting-started) · [How Verify works](#verify-the-differentiator) · [Privacy](PRIVACY.md) · [Contributing](CONTRIBUTING.md)

</div>

---

## What is Sift?

AI features now show up on pages whether or not you asked for them, with no signal of
whether their output is grounded. Sift hands that decision back to you along a single
intensity gradient:

| Level | What it does | How | Cost |
|------|--------------|-----|------|
| **Tag** *(default)* | Marks known AI surfaces with a small, dismissible badge + outline | Known-surface selector list | Free, instant |
| **Verify** | Checks an AI answer's citations and claim support, then annotates trust | Selector list + on-demand source fetch + your own (or a local) model | Slower; your API cost, or free with a local model |
| **Block** | Removes known AI surfaces entirely (`display:none`) | Same selector list as Tag | Free, instant |
| **Off** | Sift does nothing on the page | — | — |

The shipped posture is **sift-and-verify**, not anti-AI. Block is the far end of the
dial, not the headline.

### One credibility rule

> **Sift only acts on AI it can identify with certainty.**

It labels and verifies *known AI surfaces* (the Google AI Overview block, the Copilot
panel, a Perplexity answer). It never guesses whether arbitrary text or an image was
AI-generated — that detection is unreliable, and one false "this is AI" on a human's
post would torch the trust the whole tool runs on. That's also why generic chat widgets
(Intercom, Crisp, Zendesk, …) are **deliberately excluded**: their DOM is identical
whether a human or a bot is answering.

---

## Verify (the differentiator)

For AI *answer* surfaces, click **Verify** on the badge and Sift will:

1. **Extract** the answer's discrete factual claims and the citations it provides.
2. **Check the links (model-free, cheap)** — resolve every cited URL. A cited page that
   returns 404/gone is a fabricated citation: a strong, zero-cost hallucination signal,
   and it's *fact*, not a judgment call.
3. **Check the support (advisory, LLM)** — fetch the live cited sources and judge whether
   they actually back each claim (entailment, one model call per claim). This is an
   advisory judgment, not ground truth — see the [accuracy eval](CONTRIBUTING.md#verify-accuracy-eval).
4. **Annotate** with an honest verdict and a per-claim breakdown:
   `Sourced & supported` · `Partially supported` · `Unsupported claims` ·
   `Fabricated citations` · `Unverifiable`. "Partial" never counts as a clean pass, and a
   single rotted link among good ones doesn't condemn the whole answer.
5. **Refuse, don't guess** — when Sift can't verify (no citations, a source that's blocked
   or JavaScript-rendered), it says exactly *why* instead of inventing confidence.

Verify is **on-demand**, shows an **estimated cost before you click** (and the real cost
after), and caches per answer. Bring your own **Anthropic** key, or point it at a
**local / OpenAI-compatible** server (Ollama, llama.cpp, LiteLLM) so page and source text
never leave your machine. Nothing leaves your device except the source fetches and the
model call *you* trigger.

---

## Getting started

Requires **Node 18+**.

```bash
npm install         # installs deps and runs `wxt prepare`
npm run dev         # launches Chrome with the extension loaded + HMR
npm run build       # production build into .output/chrome-mv3
npm run zip         # packaged .zip for the Chrome Web Store
npm test            # unit tests (Vitest)
npm run compile     # type-check (tsc --noEmit)
```

To load a production build manually: `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select `.output/chrome-mv3`. Publishing to the Chrome Web Store is
documented in [docs/STORE.md](docs/STORE.md).

### Using Verify

1. Open the extension **Options**.
2. Choose a provider: paste an [Anthropic API key](https://console.anthropic.com/settings/keys),
   or pick **Local / OpenAI-compatible** and enter your server URL. Click **Test**.
3. Click **Enable** under "Fetch cited sources" (grants Sift permission to read pages
   during a Verify — requested only when you opt in).
4. Set a site (or your default) to **Verify**, then click **Verify** on a tagged answer.
   You'll see an estimated cost before it runs and the actual cost after.

---

## Architecture

Manifest V3, TypeScript, [WXT](https://wxt.dev), React (popup + options).

```
entrypoints/
  background.ts     # service worker: orchestrates Verify, owns the API call + cache
  content.ts        # injected on every page; thin wrapper around the controller
  popup/            # React: the intensity dial + per-site toggle
  options/          # React: defaults, per-site lists, API key, surface list
lib/
  types.ts          # shared contracts across every context
  config.ts         # tunables, model ids, storage keys, defaults
  settings.ts       # pure level-resolution logic (unit-tested)
  storage.ts        # all persistence — chrome.storage.local only
  selectors/        # versioned surface list + decoupled matching engine
  verify/           # claim extraction → link check → source fetch → entailment → verdict
  content/          # detection lifecycle (controller) + in-page UI (vanilla DOM)
components/         # shared React (LevelSelector, Logo, useSettings) + styles
scripts/gen-icons.mjs   # dependency-free PNG icon generator
```

Design choices that matter:

- **Selector list is data, decoupled from logic** ([`lib/selectors/list.ts`](lib/selectors/list.ts)).
  Sites reship and A/B test their DOM constantly, so each surface carries multiple
  fallback selectors (most-stable first) and can be repaired without touching core code.
  v2 will fetch list updates remotely, ad-block style.
- **No in-memory state in the worker.** MV3 kills idle service workers; everything
  rehydrates from `chrome.storage.local`.
- **Browser API behind one chokepoint** ([`lib/browser.ts`](lib/browser.ts)) so Firefox
  support is a contained later change.
- **The worker has no DOM.** Fetched HTML is reduced to text with a regex extractor, not
  `DOMParser` (unavailable in MV3 workers).

See [docs/SELECTORS.md](docs/SELECTORS.md) for how to add or repair a surface.

---

## Covered surfaces (v0)

Google AI Overview · Google AI Mode · Perplexity answer · Microsoft Copilot
(copilot.microsoft.com) · Bing Copilot summary · Gemini · Meta AI · OpenAI ChatKit
(embeddable widget).

Each is identifiable by vendor-owned structure (data attributes, custom element tags,
stable hrefs). The full list with selectors and maintenance notes lives in
[`lib/selectors/list.ts`](lib/selectors/list.ts).

---

## Roadmap

- **v0 — Tag + Block** ✅ static bundled selector list, per-site + global, persistence.
- **v1 — Verify** ✅ claim/citation extraction, dead-link check, source-support entailment, caching.
- **v2 — Scale** ⏳ remote-updatable selector list, more surfaces, shadow-DOM piercing
  (legacy Bing chat), Firefox support, optional crowdsourced list.

---

## Privacy

No accounts, no servers, no analytics. All settings live in `chrome.storage.local`. The
only network traffic Sift originates is the source fetches and the single LLM call during
a Verify *you* initiate. See [PRIVACY.md](PRIVACY.md).

## Contributing

Selector fixes are the most valuable contribution — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Jeremiah Sakuda
