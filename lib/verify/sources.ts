/**
 * Source fetching + cheap citation classification (the "ship-first" check).
 *
 * One GET per cited URL, run in the background worker. From the result we get
 * BOTH the cheap signal (does the link resolve / is it a 404 = fabricated signal)
 * AND the readable text reused later for the entailment check — so we never
 * fetch a source twice.
 *
 * Note: MV3 service workers have no DOMParser, so HTML is reduced to text with
 * a small regex extractor rather than a DOM.
 */

import { MAX_SOURCE_CHARS } from '../config';
import { isBlockedHost, isPublicHttpUrl } from '../net';
import type { Citation, CitationStatus } from '../types';

export interface FetchedSource {
  citation: Citation;
  /** Extracted readable text, present only when status === 'ok'. */
  text?: string;
}

/** Fetch one cited URL, classify it, and extract readable text when reachable. */
export async function fetchCitation(
  id: string,
  url: string,
  title: string | undefined,
  timeoutMs: number,
  maxChars: number = MAX_SOURCE_CHARS,
): Promise<FetchedSource> {
  // SSRF guard: refuse internal/loopback/private targets before touching the network.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { citation: { id, url, title, status: 'unreachable' } };
  }
  if (!isPublicHttpUrl(parsed)) {
    return { citation: { id, url, title, status: 'unreachable' } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      // Never attach the user's cookies/session to a third-party source fetch.
      credentials: 'omit',
      headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
    });

    // A public URL can redirect into an internal host; never read that body.
    if (res.url && isInternalUrl(res.url)) {
      return { citation: { id, url, title, status: 'unreachable' } };
    }

    const base: Citation = { id, url, title, status: classifyStatus(res.status), httpStatus: res.status };
    if (base.status !== 'ok') return { citation: base };

    const contentType = res.headers.get('content-type') ?? '';
    const raw = await res.text();
    const text = /html|xml/i.test(contentType) ? htmlToText(raw) : collapse(raw);
    return { citation: { ...base, title: title || deriveTitle(raw) }, text: text.slice(0, maxChars) };
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    return {
      citation: {
        id,
        url,
        title,
        status: aborted ? 'unreachable' : 'unreachable',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function isInternalUrl(u: string): boolean {
  try {
    return isBlockedHost(new URL(u).hostname);
  } catch {
    return true;
  }
}

function classifyStatus(httpStatus: number): CitationStatus {
  if (httpStatus >= 200 && httpStatus < 300) return 'ok';
  // 404/410 are the strong "this source does not exist" / fabricated signal.
  if (httpStatus === 404 || httpStatus === 410) return 'dead';
  // Everything else (403/5xx/etc.) is a soft failure — reachable infra, not proof of fabrication.
  return 'unreachable';
}

// ---------------------------------------------------------------------------
// HTML -> text (no DOMParser available in the service worker)
// ---------------------------------------------------------------------------

const BLOCK_TAGS = /<\/(p|div|section|article|li|ul|ol|h[1-6]|tr|table|br|header|footer|main)>/gi;

export function htmlToText(html: string): string {
  let out = html;
  // Drop non-content regions entirely.
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
  out = out.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');
  out = out.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ');
  out = out.replace(/<!--[\s\S]*?-->/g, ' ');
  // Preserve paragraph-ish breaks before stripping tags.
  out = out.replace(BLOCK_TAGS, '\n');
  out = out.replace(/<[^>]+>/g, ' ');
  out = decodeEntities(out);
  return collapse(out);
}

function deriveTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? collapse(decodeEntities(m[1])).slice(0, 200) || undefined : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => safeFromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCharCode(parseInt(h, 16)));
}

function safeFromCharCode(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function collapse(s: string): string {
  return s.replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
