import { describe, it, expect, beforeEach } from 'vitest';
import { BUNDLED_SELECTOR_LIST } from '@/lib/selectors/list';
import { findSurfaceElements } from '@/lib/selectors/engine';

/**
 * Minimal HTML fixtures carrying each surface's structural hook. They guard
 * against selector rot: if a primary selector stops matching its fixture (or
 * starts matching the generic decoy page), CI fails. When you add a surface to
 * the list, add a fixture here — the coverage test below enforces it.
 */
const FIXTURES: Record<string, string> = {
  'google-ai-overview':
    '<div id="rcnt"><div data-mcpr data-mcp><div data-async-type="folsrch">overview</div>' +
    '<a href="https://support.google.com/websearch?p=ai_overviews">About AI Overviews</a></div></div>',
  'google-ai-mode': '<div role="listitem"><a href="/search?udm=50&q=x">AI Mode</a></div>',
  'perplexity-answer': '<div data-testid="answer">The answer text.</div>',
  'copilot-answer': '<div role="article" data-content="ai-message">Copilot says…</div>',
  'bing-copilot-summary': '<div class="b_chatResponse">Bing Copilot summary</div>',
  'gemini-response':
    '<model-response><div class="model-response-text"><div class="markdown">Gemini answer</div></div></model-response>',
  'meta-ai-answer': '<div data-testid="assistant-message">Meta AI answer</div>',
  'openai-chatkit': '<openai-chatkit></openai-chatkit>',
};

// A generic content page that must NOT match any AI surface selector.
const DECOY =
  '<header><nav><a href="/">Home</a></nav></header>' +
  '<main><article><h1>Ordinary news story</h1><p>Body text with a <a href="https://example.com">link</a>.</p></article></main>' +
  '<footer>© 2026</footer>';

describe('selector fixtures', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has a fixture for every bundled surface', () => {
    for (const s of BUNDLED_SELECTOR_LIST.surfaces) {
      expect(FIXTURES[s.id], `missing fixture for surface "${s.id}"`).toBeTypeOf('string');
    }
  });

  for (const surface of BUNDLED_SELECTOR_LIST.surfaces) {
    it(`matches its fixture: ${surface.id}`, () => {
      document.body.innerHTML = FIXTURES[surface.id] ?? '';
      const els = findSurfaceElements(surface);
      expect(els.length, `no selector matched the ${surface.id} fixture`).toBeGreaterThan(0);
    });

    it(`does not match the decoy page: ${surface.id}`, () => {
      document.body.innerHTML = DECOY;
      expect(findSurfaceElements(surface).length, `${surface.id} over-matched a generic page`).toBe(0);
    });
  }
});
