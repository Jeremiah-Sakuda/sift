import { describe, it, expect, beforeEach } from 'vitest';
import {
  hostMatches,
  surfaceMatchesUrl,
  surfacesForUrl,
  surfaceIsUniversal,
  findSurfaceElements,
  findCitations,
  extractAnswerText,
} from '@/lib/selectors/engine';
import { BUNDLED_SELECTOR_LIST } from '@/lib/selectors/list';
import type { Surface, SelectorList } from '@/lib/types';

describe('hostMatches', () => {
  it('matches exact and wildcard subdomains', () => {
    expect(hostMatches('google.com', 'google.com')).toBe(true);
    expect(hostMatches('*.google.com', 'gemini.google.com')).toBe(true);
    expect(hostMatches('*.google.com', 'google.com')).toBe(true);
    expect(hostMatches('*', 'anything.example')).toBe(true);
    expect(hostMatches('google.com', 'notgoogle.com')).toBe(false);
    expect(hostMatches('*.google.com', 'evilgoogle.com')).toBe(false);
  });
});

describe('surfaceMatchesUrl / surfacesForUrl', () => {
  const list: SelectorList = BUNDLED_SELECTOR_LIST;
  it('selects the right surfaces for a host', () => {
    const perplexity = list.surfaces.find((s) => s.id === 'perplexity-answer')!;
    expect(surfaceMatchesUrl(perplexity, 'https://www.perplexity.ai/search/abc')).toBe(true);
    const ids = surfacesForUrl(list, 'https://www.perplexity.ai/search/abc').map((s) => s.id);
    expect(ids).toContain('perplexity-answer');
    // openai-chatkit matches every site
    expect(ids).toContain('openai-chatkit');
    // google surfaces should not apply to perplexity
    expect(ids).not.toContain('google-ai-overview');
  });
});

describe('surfaceIsUniversal', () => {
  const list = BUNDLED_SELECTOR_LIST;
  it('flags the all-sites widget as universal and host-specific surfaces as not', () => {
    const chatkit = list.surfaces.find((s) => s.id === 'openai-chatkit')!;
    const perplexity = list.surfaces.find((s) => s.id === 'perplexity-answer')!;
    expect(surfaceIsUniversal(chatkit)).toBe(true);
    expect(surfaceIsUniversal(perplexity)).toBe(false);
  });

  it('an arbitrary site matches only the universal surface', () => {
    const matched = surfacesForUrl(list, 'https://example.com/some/page');
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every(surfaceIsUniversal)).toBe(true);
  });
});

describe('findSurfaceElements', () => {
  const surface: Surface = {
    id: 's',
    name: 'Test',
    vendor: 'X',
    type: 'answer',
    matches: ['*'],
    selectors: [
      { css: '[data-testid="answer"]' },
      { css: '.fallback' },
    ],
    citationSelector: 'a[href]',
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns elements from the first matching selector only', () => {
    document.body.innerHTML = `
      <div data-testid="answer" id="a1">one</div>
      <div data-testid="answer" id="a2">two</div>
      <div class="fallback" id="f1">fb</div>`;
    const els = findSurfaceElements(surface);
    expect(els.map((e) => e.id)).toEqual(['a1', 'a2']);
  });

  it('falls back when the first selector misses', () => {
    document.body.innerHTML = `<div class="fallback" id="f1">fb</div>`;
    expect(findSurfaceElements(surface).map((e) => e.id)).toEqual(['f1']);
  });

  it('keeps only the outermost element when matches are nested', () => {
    document.body.innerHTML = `
      <div data-testid="answer" id="outer"><div data-testid="answer" id="inner">x</div></div>`;
    expect(findSurfaceElements(surface).map((e) => e.id)).toEqual(['outer']);
  });

  it('survives an invalid selector by trying the next', () => {
    const bad: Surface = { ...surface, selectors: [{ css: ':has-text("nope")' }, { css: '.fallback' }] };
    document.body.innerHTML = `<div class="fallback" id="f1">fb</div>`;
    expect(findSurfaceElements(bad).map((e) => e.id)).toEqual(['f1']);
  });
});

describe('findCitations + extractAnswerText', () => {
  const surface: Surface = {
    id: 's',
    name: 'Test',
    vendor: 'X',
    type: 'answer',
    matches: ['*'],
    selectors: [{ css: '#answer' }],
    citationSelector: 'a[href]',
  };

  it('extracts unique http(s) citations and dedupes', () => {
    document.body.innerHTML = `
      <div id="answer">
        The sky is blue.
        <a href="https://example.com/a" title="A">1</a>
        <a href="https://example.com/a">dup</a>
        <a href="#frag">skip</a>
        <a href="mailto:x@y.com">skip</a>
      </div>`;
    const container = document.getElementById('answer')!;
    const cites = findCitations(surface, container);
    expect(cites.map((c) => c.url)).toEqual(['https://example.com/a']);
    expect(cites[0].title).toBe('A');
    expect(extractAnswerText(surface, container)).toContain('The sky is blue.');
  });
});
