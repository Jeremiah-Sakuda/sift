# Maintaining the selector list

Sift's detection is only as good as its selector list. This doc explains how matching
works, what qualifies as a surface, and how to debug a broken one.

## How matching works

1. For the current page URL, the engine collects every surface whose `matches` host-glob
   applies ([`surfacesForUrl`](../lib/selectors/engine.ts)).
2. For each surface it tries the `selectors` **in order** and uses the **first** one that
   returns any elements (`findSurfaceElements`). Later selectors are fallbacks.
3. Nested matches are collapsed to the outermost element, so a surface is never
   double-tagged.
4. For `answer` surfaces, `citationSelector` (scoped to the matched container) collects
   the cited links, and `answerTextSelector` (optional) narrows the text used for hashing
   and claim extraction.

Invalid CSS (e.g. a stray `:has-text()`) is caught and skipped to the next fallback, so a
bad selector degrades gracefully instead of throwing.

## What qualifies as a surface — the certainty rule

> Add a surface only if it is **unambiguously AI by structure.**

Good signals (use these):

- A **custom element tag** that only an AI feature registers — e.g. `openai-chatkit`,
  `model-response` (Gemini).
- A **vendor data attribute** that names the AI surface — e.g. `[data-content="ai-message"]`
  (Copilot), `[data-testid="assistant-message"]` (Meta AI), `[data-async-type="folsrch"]`
  (Google AI Overview).
- A **stable, AI-specific href** — e.g. the "About AI Overviews" support link, or
  Google's `udm=50` AI Mode parameter.

Bad signals (never ship these as "this is AI"):

- Generic class names like `.chat-widget`, `.ai`, `.response`.
- Heuristics on text content ("this *looks* AI-written").
- A vendor widget that is **identical whether a human or a bot answers.**

### Deliberately excluded

Intercom, Crisp, Zendesk, HubSpot, Tidio, Drift, and Ada widgets are **intentionally not
in the list.** They can be detected as *widgets*, but their DOM gives no structural signal
that an AI (vs a human agent) is actually answering. Tagging them "AI" would risk a false
positive, which is the one failure the product can't afford. Revisit only if a vendor
exposes a real "AI is active" attribute.

## Known limitations

- **Shadow DOM.** Surfaces rendered inside closed/open shadow roots (e.g. the legacy Bing
  `cib-*` chat web components) are not reachable by flat `querySelectorAll` and are omitted
  until shadow-piercing lands (v2). The light-DOM Bing Copilot summary (`.b_chatResponse`)
  is covered.
- **ccTLDs.** Host globs cover `google.com`/`*.google.com`; non-`.com` Google ccTLDs are
  not yet enumerated.

## Debugging a broken surface

1. Open the page where the surface should appear (the surface's `notes` usually include a
   trigger query).
2. In DevTools console, test each selector top-to-bottom:
   ```js
   document.querySelectorAll('the-selector')
   ```
   The first one returning the AI container is the one the engine will use.
3. If all miss, inspect the container and find a new **stable** hook (prefer `data-*` /
   custom tags). Add it as the new highest-confidence selector, keep the old ones as
   fallbacks.
4. Bump `version` + `updatedAt` in [`list.ts`](../lib/selectors/list.ts).
5. `npm run compile && npm test`.

## Why a list (and not detection)?

Sites A/B test and reship DOM constantly — this is an arms race. Keeping surfaces as
**versioned data**, decoupled from logic, means a break is a one-line data fix, and v2 can
push list updates remotely (ad-block style) without shipping a new extension build.
