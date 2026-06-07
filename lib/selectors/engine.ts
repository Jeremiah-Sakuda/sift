/**
 * Selector matching engine — decoupled from the selector list data (PRD: keep
 * matching logic separate so surfaces can be added/repaired without touching core).
 *
 * Pure DOM/string logic, no extension APIs, so it is unit-testable in jsdom.
 */

import type { Surface, SelectorList } from '../types';

/** Host glob match: `*` (any), `example.com` (exact), `*.example.com` (domain + subdomains). */
export function hostMatches(pattern: string, hostname: string): boolean {
  const p = pattern.trim().toLowerCase();
  const h = hostname.trim().toLowerCase();
  if (p === '*' || p === h) return true;
  if (p.startsWith('*.')) {
    const base = p.slice(2);
    return h === base || h.endsWith('.' + base);
  }
  return false;
}

export function surfaceMatchesUrl(surface: Surface, url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return surface.matches.some((pattern) => hostMatches(pattern, hostname));
}

/** Surfaces (enabled) whose match patterns apply to the given URL. */
export function surfacesForUrl(list: SelectorList, url: string): Surface[] {
  return list.surfaces.filter(
    (s) => s.enabled !== false && surfaceMatchesUrl(s, url),
  );
}

/**
 * Find the elements for a surface on the page. Tries selectors in order and
 * returns the matches from the FIRST selector that hits — avoids double-tagging
 * the same surface via overlapping fallback selectors.
 */
export function findSurfaceElements(surface: Surface, root: ParentNode = document): Element[] {
  for (const sel of surface.selectors) {
    let matches: Element[] = [];
    try {
      matches = Array.from(root.querySelectorAll(sel.css));
    } catch {
      // Invalid/unsupported selector syntax — skip to next fallback.
      continue;
    }
    if (matches.length > 0) {
      // Drop elements nested inside an already-matched element (keep outermost).
      return matches.filter(
        (el) => !matches.some((other) => other !== el && other.contains(el)),
      );
    }
  }
  return [];
}

export interface ExtractedCitation {
  url: string;
  title?: string;
}

/** Pull citation links from inside a matched answer container. */
export function findCitations(surface: Surface, container: Element): ExtractedCitation[] {
  if (!surface.citationSelector) return [];
  let anchors: Element[] = [];
  try {
    anchors = Array.from(container.querySelectorAll(surface.citationSelector));
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const citations: ExtractedCitation[] = [];
  for (const el of anchors) {
    const href = el.getAttribute('href') ?? (el as HTMLAnchorElement).href ?? '';
    const url = normalizeCitationUrl(href);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = (el.getAttribute('title') || el.textContent || '').trim() || undefined;
    citations.push({ url, title });
  }
  return citations;
}

/** Resolve/clean a citation href; reject non-http and in-page anchors. */
export function normalizeCitationUrl(href: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Best-effort answer text for hashing / claim extraction. */
export function extractAnswerText(surface: Surface, container: Element): string {
  const target = surface.answerTextSelector
    ? container.querySelector(surface.answerTextSelector) ?? container
    : container;
  return (target.textContent ?? '').replace(/\s+/g, ' ').trim();
}
