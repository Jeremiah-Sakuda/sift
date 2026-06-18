# Contributing to Sift

Thanks for helping! The single most valuable contribution is **keeping the selector list
working** as sites reship their DOM.

## Setup

```bash
npm install
npm run dev        # Chrome with HMR
npm test           # Vitest
npm run compile    # tsc --noEmit
```

## Fixing or adding an AI surface

All surface definitions live in [`lib/selectors/list.ts`](lib/selectors/list.ts). Matching
logic is separate ([`lib/selectors/engine.ts`](lib/selectors/engine.ts)), so you only edit
data.

A surface looks like:

```ts
{
  id: 'google-ai-overview',     // stable, never reused
  name: 'Google AI Overview',   // shown on the badge
  vendor: 'Google',
  type: 'answer',               // 'answer' (verifiable) | 'feature' (tag/block only)
  matches: ['google.com', '*.google.com'],   // host globs
  selectors: [                  // most-reliable first; the engine uses the first that hits
    { css: '…', description: '…', confidence: 'high' },
  ],
  citationSelector: '…',        // 'answer' surfaces: where citation links live, scoped to the container
  notes: 'How to re-verify in DevTools when this breaks.',
}
```

### The rules

1. **Certainty only.** Only add a surface that is *unambiguously* AI by its structure
   (a vendor data attribute, a custom element tag, a stable AI-specific href). If a
   selector could match a human-authored element, don't add it. See
   [docs/SELECTORS.md](docs/SELECTORS.md).
2. **Prefer stable hooks** — `data-*` attributes, custom element tags, vendor-stable
   hrefs — over obfuscated class names.
3. **Provide fallbacks**, ordered most-stable first, each with an honest `confidence`.
4. **Write `notes`** explaining how to reproduce the surface and re-verify the selector
   in DevTools. Future-you will need it.
5. **Bump `version`** and `updatedAt` on the list when you change surfaces.

### Verifying a selector

Open a page with the surface, and in the console:

```js
document.querySelectorAll('your-selector-here')
```

It should return exactly the AI container(s), and nothing on pages without the surface.

## Verify accuracy eval

The entailment judge has a labeled eval in [`eval/`](eval/). The scoring logic is
unit-tested offline; the live model run is gated so ordinary `npm test` never hits
the network. To measure accuracy and the (critical) false-supported rate:

```bash
ANTHROPIC_API_KEY=sk-... npm run eval
```

It prints a confusion matrix and asserts loose guardrails. When you find a
real-world miss, add the case to [`eval/entailment-cases.ts`](eval/entailment-cases.ts).

## Code style

- TypeScript, `strict`. Keep `npm run compile` and `npm test` green.
- Keep extension-API calls behind `lib/browser.ts`.
- Add a unit test for any new pure logic (`tests/`).

## Commits & PRs

Small, focused commits. Describe what surface/behavior changed and how you verified it.
