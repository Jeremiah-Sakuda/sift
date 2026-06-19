/**
 * Content-script controller. Detects known AI surfaces on the page and applies
 * the effective intensity level (tag / verify / block), keeps in sync with
 * settings changes, and drives the on-demand Verify flow.
 *
 * Holds only DOM state; all persistent state lives in the background/storage.
 */

import { browser } from '../browser';
import { sendMessage } from '../messaging';
import {
  getSelectorList,
  surfacesForUrl,
  surfaceIsUniversal,
  findSurfaceElements,
  findCitations,
  extractAnswerText,
} from '../selectors';
import { getSettings, normalizeHostname, resolveLevel } from '../storage';
import { answerHash } from '../hash';
import { estimateUpfront } from '../verify/cost';
import { injectBaseStyles, createBadge, VerifyPanel, SIFT_ATTR } from './ui';
import type { Level, Settings, SelectorList, Surface, Message } from '../types';

interface ElementState {
  surface: Surface;
  badge?: HTMLElement;
  tagged: boolean;
  blocked: boolean;
  dismissed: boolean;
  prevInlinePosition?: string;
  prevInlineDisplay?: string;
}

const TAGGED_ATTR = `${SIFT_ATTR}-tagged`;
const SURFACE_ATTR = `${SIFT_ATTR}-surface`;

export class SiftController {
  private settings!: Settings;
  private level: Level = 'off';
  private list!: SelectorList;
  private states = new Map<Element, ElementState>();
  private observer?: MutationObserver;
  private rescanTimer?: ReturnType<typeof setTimeout>;
  private panel?: VerifyPanel;
  private blockStyle?: HTMLStyleElement;
  private activeVerifyHash?: string;
  private activeVerifySurface?: Surface;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    this.started = true;

    this.list = await getSelectorList();
    this.settings = await getSettings();
    this.level = resolveLevel(this.settings, location.hostname).level;

    // Bail entirely on origins no surface can ever match — no styles, no observer.
    const matched = surfacesForUrl(this.list, location.href);
    if (matched.length === 0) return;

    // Hide-before-paint: at document_start, inject the block CSS first so a
    // blocked surface never flashes on screen.
    this.applyBlockCss();
    injectBaseStyles();
    this.listenForChanges();
    this.listenForProgress();
    this.scan();

    if (matched.some((s) => !surfaceIsUniversal(s))) {
      // A host-specific AI surface (an SPA where answers stream in) — watch live.
      this.observeDom();
    } else {
      // Only a universal widget (e.g. ChatKit) could appear here; a permanent
      // subtree observer on every page is the panel's top perf concern. Do a few
      // bounded re-scans to catch a late-injected widget instead.
      for (const ms of [800, 2500, 6000]) {
        setTimeout(() => this.scan(), ms);
      }
    }
  }

  // --- reactivity ----------------------------------------------------------

  private listenForChanges(): void {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes['sift:settings']) return;
      const next = changes['sift:settings'].newValue as Settings | undefined;
      if (!next) return;
      this.settings = next;
      // Re-apply on any settings change — not just level — so appearance toggles
      // (show badges / outline) and per-site edits take effect live.
      this.level = resolveLevel(next, location.hostname).level;
      this.reconcile();
    });
  }

  private listenForProgress(): void {
    browser.runtime.onMessage.addListener((message: Message) => {
      if (
        message.type === 'VERIFY_PROGRESS' &&
        message.answerHash === this.activeVerifyHash &&
        this.panel &&
        this.activeVerifySurface
      ) {
        this.panel.showProgress(this.activeVerifySurface, message.stage, message.detail);
      }
    });
  }

  private observeDom(): void {
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  private scheduleScan(): void {
    clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(() => this.scan(), 350);
  }

  // --- detection + application --------------------------------------------

  private scan(): void {
    // Drop tracked elements that left the DOM.
    for (const el of [...this.states.keys()]) {
      if (!el.isConnected) this.states.delete(el);
    }
    if (this.level === 'off') {
      this.reconcile();
      return;
    }
    if (this.level === 'block') {
      // Hiding is done by injected CSS (flash-free); no per-element work needed.
      this.applyBlockCss();
      return;
    }
    for (const surface of surfacesForUrl(this.list, location.href)) {
      for (const el of findSurfaceElements(surface)) {
        this.applyToElement(el, surface);
      }
    }
  }

  /** Bring every tracked element in line with the current level (used on level change). */
  private reconcile(): void {
    if (this.level === 'off') {
      for (const [el, state] of this.states) this.clearElement(el, state);
      this.states.clear();
      this.applyBlockCss(); // removes the block stylesheet
      this.panel?.hide();
      return;
    }
    if (this.level === 'block') {
      // Drop any tag badges/outlines from a previous level, then CSS-hide.
      for (const [el, state] of this.states) this.clearElement(el, state);
      this.states.clear();
      this.applyBlockCss();
      return;
    }
    // tag / verify: ensure the block stylesheet is gone, then (re)apply markers.
    this.applyBlockCss();
    for (const [el, state] of this.states) {
      if (state.dismissed) continue;
      this.applyToElement(el, state.surface);
    }
    this.scan();
  }

  /**
   * Hide-before-paint for Block: inject a stylesheet whose rules are this host's
   * surface selectors set to display:none. CSS applies reactively, so when the
   * site later injects the AI surface it never paints. Removed for other levels.
   */
  private applyBlockCss(): void {
    if (this.level === 'block') {
      const selectors = surfacesForUrl(this.list, location.href)
        .flatMap((s) => s.selectors.map((sel) => sel.css))
        .filter(Boolean);
      if (!selectors.length) return;
      if (!this.blockStyle) {
        this.blockStyle = document.createElement('style');
        this.blockStyle.setAttribute(`${SIFT_ATTR}-block-css`, '');
        (document.head ?? document.documentElement).appendChild(this.blockStyle);
      }
      this.blockStyle.textContent = `${selectors.join(',\n')} { display: none !important; }`;
    } else if (this.blockStyle) {
      this.blockStyle.remove();
      this.blockStyle = undefined;
    }
  }

  private applyToElement(el: Element, surface: Surface): void {
    let state = this.states.get(el);
    if (state?.dismissed) return;
    if (!state) {
      state = { surface, tagged: false, blocked: false, dismissed: false };
      this.states.set(el, state);
    }

    if (this.level === 'block') {
      this.block(el, state);
      return;
    }
    // tag or verify
    if (state.blocked) this.unblock(el, state);
    const showVerify = this.level === 'verify' && surface.type === 'answer';
    this.tag(el, state, showVerify);
  }

  private tag(el: Element, state: ElementState, showVerify: boolean): void {
    el.setAttribute(SURFACE_ATTR, state.surface.id);
    if (this.settings.ui.showOutline) el.setAttribute(TAGGED_ATTR, '');
    else el.removeAttribute(TAGGED_ATTR);

    // Drop the badge if appearance turned it off or its verify affordance changed.
    const needsBadge = this.settings.ui.showBadges;
    const badgeHasVerify = !!state.badge?.querySelector('button[title^="Check whether"]');
    if (state.badge && (!needsBadge || badgeHasVerify !== showVerify)) {
      state.badge.remove();
      state.badge = undefined;
    }
    if (needsBadge && !state.badge) {
      this.ensurePositioned(el as HTMLElement, state);
      const badge = createBadge(state.surface, {
        showVerify,
        onVerify: () => void this.verifyElement(el, state.surface),
        onDismiss: () => this.dismiss(el, state),
      });
      el.appendChild(badge);
      state.badge = badge;
    }
    state.tagged = true;
  }

  private block(el: Element, state: ElementState): void {
    if (state.badge) {
      state.badge.remove();
      state.badge = undefined;
    }
    el.removeAttribute(TAGGED_ATTR);
    const html = el as HTMLElement;
    if (!state.blocked) {
      state.prevInlineDisplay = html.style.display;
      html.style.setProperty('display', 'none', 'important');
      el.setAttribute(`${SIFT_ATTR}-blocked`, '');
      state.blocked = true;
      state.tagged = false;
    }
  }

  private unblock(el: Element, state: ElementState): void {
    const html = el as HTMLElement;
    if (state.prevInlineDisplay !== undefined) html.style.display = state.prevInlineDisplay;
    else html.style.removeProperty('display');
    el.removeAttribute(`${SIFT_ATTR}-blocked`);
    state.blocked = false;
  }

  private clearElement(el: Element, state: ElementState): void {
    if (state.badge) state.badge.remove();
    if (state.blocked) this.unblock(el, state);
    el.removeAttribute(TAGGED_ATTR);
    el.removeAttribute(SURFACE_ATTR);
    el.removeAttribute(`${SIFT_ATTR}-verdict`);
    const html = el as HTMLElement;
    if (state.prevInlinePosition !== undefined) {
      html.style.position = state.prevInlinePosition;
      state.prevInlinePosition = undefined;
    }
  }

  private dismiss(el: Element, state: ElementState): void {
    state.dismissed = true;
    this.clearElement(el, state);
  }

  /** Give the badge a positioning context without disturbing layout when avoidable. */
  private ensurePositioned(el: HTMLElement, state: ElementState): void {
    const pos = getComputedStyle(el).position;
    if (pos === 'static') {
      state.prevInlinePosition = el.style.position;
      el.style.position = 'relative';
    }
  }

  // --- verify flow ---------------------------------------------------------

  private async verifyElement(el: Element, surface: Surface): Promise<void> {
    const answerText = extractAnswerText(surface, el);
    if (!answerText) return;
    const citations = findCitations(surface, el);
    const hash = answerHash(answerText, surface.id);
    this.activeVerifyHash = hash;
    this.activeVerifySurface = surface;

    if (!this.panel) this.panel = new VerifyPanel();
    const estimate = estimateUpfront({
      answerChars: answerText.length,
      citationCount: citations.length,
      maxSources: this.settings.verify.maxSourcesPerCheck,
      model: this.settings.verify.model,
    });
    this.panel.showProgress(surface, 'extracting', undefined, estimate.usd);

    try {
      const cached = await sendMessage({ type: 'GET_CACHED_VERIFY', answerHash: hash });
      if (cached) {
        el.setAttribute(`${SIFT_ATTR}-verdict`, cached.verdict);
        this.panel.showResult(surface, cached);
        return;
      }
      const result = await sendMessage({
        type: 'VERIFY_ANSWER',
        request: {
          surfaceId: surface.id,
          answerHash: hash,
          answerText,
          citations: citations.map((c) => ({ url: c.url, title: c.title })),
          pageUrl: location.href,
        },
      });
      el.setAttribute(`${SIFT_ATTR}-verdict`, result.verdict);
      this.panel.showResult(surface, result);
    } catch (err) {
      this.panel.showResult(surface, {
        surfaceId: surface.id,
        answerHash: hash,
        verdict: 'error',
        summary: err instanceof Error ? err.message : 'Verification failed.',
        claims: [],
        citations: [],
        assessments: [],
        model: '',
        createdAt: new Date().toISOString(),
        error: String(err),
      });
    }
  }
}

export { normalizeHostname };
