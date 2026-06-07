/**
 * Bundled selector list (v0). The single source of truth for "known AI surfaces."
 *
 * Design rules (from the PRD):
 *  - Sift only acts on AI it can identify with CERTAINTY. Every surface here is
 *    unambiguously an AI feature by its vendor-owned structure. Generic vendor
 *    chat widgets (Intercom, Crisp, Zendesk, HubSpot, Tidio, Drift, Ada, …) are
 *    deliberately EXCLUDED: their DOM is identical whether a human or an AI is
 *    answering, so tagging them as "AI" would risk a false positive — the one
 *    thing that would torch the tool's trust. They can be revisited if/when a
 *    structural "AI is active" signal exists.
 *  - Matching logic lives in ./engine.ts and is decoupled from this data, so
 *    surfaces can be repaired/added without touching core code.
 *  - Each surface lists multiple fallback selectors, most-reliable first. Sites
 *    obfuscate and A/B test their DOM constantly, so prefer stable hooks
 *    (data-* attributes, custom element tags, vendor-stable hrefs) over classes.
 *
 * Selector sources: adblock filter-list discussions, the defuddle/readability
 * extractors, and live DOM inspection (2026). See each surface's `notes` for how
 * to re-verify in DevTools when a selector breaks.
 *
 * Known v0 limitation: surfaces rendered inside closed/open Shadow DOM (e.g. the
 * legacy Bing `cib-*` chat web components) are not reachable by flat
 * querySelector and are intentionally omitted until shadow-piercing lands (v2).
 */

import type { SelectorList } from '../types';

export const BUNDLED_SELECTOR_LIST: SelectorList = {
  version: 1,
  updatedAt: '2026-06-07',
  source: 'bundled',
  surfaces: [
    {
      id: 'google-ai-overview',
      name: 'Google AI Overview',
      vendor: 'Google',
      type: 'answer',
      matches: ['google.com', '*.google.com'],
      selectors: [
        {
          css: '#rcnt div[data-mcpr]:has(div[data-async-type="folsrch"])',
          description: 'Desktop AI Overview container, gated on the folsrch async block.',
          confidence: 'high',
        },
        {
          css: 'div:has(> a[href^="https://support.google.com/websearch?p=ai_overviews"])',
          description: 'Container holding the "About AI Overviews" info link — very stable.',
          confidence: 'high',
        },
        {
          css: 'h1 + div[data-async-context] > div:first-child:not(:only-child):has([data-async-type="folsrch"])',
          description: 'Mobile AI Overview, anchored on the off-screen a11y heading.',
          confidence: 'medium',
        },
        {
          css: '[data-attrid="AIOverview"], [aria-label="AI Overview"], [data-async-type="aiOverview"]',
          description: 'Semantic fallbacks; present only in some cohorts.',
          confidence: 'low',
        },
      ],
      citationSelector:
        'a[href^="http"]:not([href*="google.com"]):not([href*="gstatic.com"]):not([href*="googleusercontent.com"])',
      notes:
        'Trigger with a query like ?q=how+many+pickles. Re-verify: document.querySelectorAll(\'[data-async-type="folsrch"]\').length, then .closest(\'[data-mcpr]\'). Google obfuscates classes heavily; rely on data-* and the support-link href.',
    },
    {
      id: 'google-ai-mode',
      name: 'Google AI Mode',
      vendor: 'Google',
      type: 'feature',
      matches: ['google.com', '*.google.com'],
      selectors: [
        {
          css: 'div[role="listitem"]:has(a[href*="udm=50"])',
          description: 'AI Mode tab in the results filter bar (udm=50 is the stable AI-Mode param).',
          confidence: 'high',
        },
        {
          css: 'a[href*="udm=50"]',
          description: 'Any AI Mode entry link.',
          confidence: 'high',
        },
      ],
      notes:
        'AI Mode = udm=50. Appears as the filter-bar tab, a homepage entry button, and inline follow-up chips. The udm=50 href is the single most reliable hook.',
    },
    {
      id: 'perplexity-answer',
      name: 'Perplexity Answer',
      vendor: 'Perplexity',
      type: 'answer',
      matches: ['perplexity.ai', '*.perplexity.ai'],
      selectors: [
        {
          css: '[data-testid="answer"]',
          description: 'The generated answer container.',
          confidence: 'high',
        },
        {
          css: '[class*="prose"][class*="prose-invert"]',
          description: 'Tailwind prose answer block (class fragments shift between deploys).',
          confidence: 'medium',
        },
      ],
      citationSelector: 'a.citation[href], a[class*="citation"][href], a[href^="http"][target="_blank"]',
      notes:
        'Standard React/Next SPA, no shadow DOM. Prefer [data-testid="answer"]; inline citations are a.citation. Re-verify: document.querySelector(\'[data-testid="answer"]\').',
    },
    {
      id: 'copilot-answer',
      name: 'Microsoft Copilot',
      vendor: 'Microsoft',
      type: 'answer',
      matches: ['copilot.microsoft.com'],
      selectors: [
        {
          css: '[role="article"][data-content="ai-message"]',
          description: 'Consumer Copilot AI message (redesigned React app).',
          confidence: 'high',
        },
        {
          css: '[data-content="ai-message"]',
          description: 'AI message fallback without the role qualifier.',
          confidence: 'high',
        },
      ],
      citationSelector:
        'a[href^="http"]:not([href*="microsoft.com"]):not([href*="bing.com"]):not([href*="live.com"])',
      notes:
        'copilot.microsoft.com (NOT the legacy cib-* Bing chat, which is shadow DOM and omitted in v0). Re-verify: document.querySelectorAll(\'[data-content="ai-message"]\').',
    },
    {
      id: 'bing-copilot-summary',
      name: 'Bing Copilot Answer',
      vendor: 'Microsoft',
      type: 'answer',
      matches: ['bing.com', '*.bing.com'],
      selectors: [
        {
          css: '.b_chatResponse',
          description: 'Copilot Search summary rendered on the Bing SERP.',
          confidence: 'high',
        },
        {
          css: '.b_copilotSummary',
          description: 'Alternate Copilot summary container.',
          confidence: 'high',
        },
      ],
      citationSelector:
        'a[href^="http"]:not([href*="bing.com"]):not([href*="microsoft.com"]):not([href*="msn.com"])',
      notes:
        'The AI summary on the bing.com results page. b_* is Bing\'s long-standing SERP class prefix, so these are relatively stable.',
    },
    {
      id: 'gemini-response',
      name: 'Gemini',
      vendor: 'Google',
      type: 'answer',
      matches: ['gemini.google.com'],
      selectors: [
        {
          css: 'model-response .model-response-text .markdown',
          description: 'Rendered model answer inside the Angular custom element.',
          confidence: 'high',
        },
        {
          css: 'div.markdown.markdown-main-panel[id^="model-response-message-content"]',
          description: 'Answer markdown panel by id prefix.',
          confidence: 'high',
        },
      ],
      citationSelector: 'browse-item a[href], a[href^="http"]:not([href*="google.com"])',
      notes:
        'Angular app with semantic custom elements (model-response, message-content). Citations (browse-item) appear only for grounded answers / Deep Research.',
    },
    {
      id: 'meta-ai-answer',
      name: 'Meta AI',
      vendor: 'Meta',
      type: 'answer',
      matches: ['meta.ai', '*.meta.ai'],
      selectors: [
        {
          css: 'div[data-testid="assistant-message"]',
          description: 'Assistant answer message (Meta Unified Renderer).',
          confidence: 'high',
        },
        {
          css: '[data-message-id$="_assistant"]',
          description: 'Assistant message by id suffix.',
          confidence: 'high',
        },
      ],
      citationSelector: '[data-testid="citation-pill"][href], .ur-citation-pill a[href], a.ur-citation-pill[href]',
      notes:
        'meta.ai standalone. Class names are hashed/rotating — anchor on data-testid / data-message-id. Citations are .ur-citation-pill and appear only when Meta AI searched the web.',
    },
    {
      id: 'openai-chatkit',
      name: 'OpenAI ChatKit',
      vendor: 'OpenAI',
      type: 'feature',
      matches: ['*'],
      selectors: [
        {
          css: 'openai-chatkit',
          description: "OpenAI's embeddable ChatGPT-powered chat web component.",
          confidence: 'high',
        },
        {
          css: "[is='openai-chatkit'], iframe[src*='chatkit'][src*='openai']",
          description: 'Customized built-in element or hosted ChatKit iframe.',
          confidence: 'low',
        },
      ],
      notes:
        'A registered custom element, so its presence is an unambiguous "this is an AI chat" signal — the only embedded third-party AI widget that meets the certainty rule. Re-verify: document.querySelector(\'openai-chatkit\').',
    },
  ],
};
