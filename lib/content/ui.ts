/**
 * In-page UI for the content script: the tag badge/outline, the per-answer
 * "Verify" button, and the result panel.
 *
 * Deliberately vanilla DOM (no React) so the content script stays small and
 * robust on hostile pages. The result panel lives in a Shadow DOM host so page
 * CSS cannot bleed into it; badges are light-DOM pills with inline !important
 * styles (small enough that isolation isn't worth a shadow root each).
 */

import type { Surface, VerifyResult, VerifyStage, VerifyVerdict } from '../types';
import { VERDICT_LABELS } from '../types';
import { formatUsd } from '../verify/cost';

export const SIFT_ATTR = 'data-sift';
const STYLE_ID = 'sift-base-styles';

const VERDICT_COLOR: Record<VerifyVerdict, string> = {
  sourced_supported: '#15803d',
  partially_supported: '#b45309',
  unsupported_claims: '#b45309',
  fabricated_citations: '#b91c1c',
  unverifiable: '#4b5563',
  error: '#4b5563',
};

const SUPPORT_LABEL: Record<string, string> = {
  supported: 'Supported',
  partial: 'Partially supported',
  unsupported: 'Not supported',
  no_source: 'No source cited',
  unverifiable: 'Unverifiable',
};

const STAGE_LABEL: Record<VerifyStage, string> = {
  idle: 'Ready',
  extracting: 'Extracting claims…',
  fetching_sources: 'Fetching & checking sources…',
  judging: 'Checking support…',
  done: 'Done',
  error: 'Error',
};

/** Outline rule for tagged surfaces. Outline (not border) keeps layout intact. */
export function injectBaseStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [${SIFT_ATTR}-tagged] {
      outline: 2px dashed rgba(99, 102, 241, 0.7) !important;
      outline-offset: 2px !important;
    }
    [${SIFT_ATTR}-verdict="fabricated_citations"],
    [${SIFT_ATTR}-verdict="unsupported_claims"] {
      outline-color: rgba(220, 38, 38, 0.8) !important;
    }
    [${SIFT_ATTR}-verdict="partially_supported"] {
      outline-color: rgba(180, 83, 9, 0.85) !important;
    }
    [${SIFT_ATTR}-verdict="sourced_supported"] {
      outline-color: rgba(21, 128, 61, 0.8) !important;
    }
  `;
  (doc.head ?? doc.documentElement).appendChild(style);
}

interface BadgeCallbacks {
  showVerify: boolean;
  onVerify?: () => void;
  onDismiss?: () => void;
}

const PILL_CSS =
  'all: initial; font: 600 11px/1.4 system-ui, sans-serif; color: #fff; ' +
  'background: #4f46e5; padding: 2px 7px; border-radius: 9999px; ' +
  'display: inline-flex; align-items: center; gap: 4px; cursor: default; ' +
  'box-shadow: 0 1px 3px rgba(0,0,0,0.3); user-select: none; white-space: nowrap;';

const BTN_CSS =
  'all: initial; font: 600 11px/1.4 system-ui, sans-serif; color: #fff; ' +
  'background: #6366f1; padding: 2px 7px; border-radius: 9999px; cursor: pointer; ' +
  'display: inline-flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3);';

/** Build the badge cluster (label pill + optional Verify button + dismiss ×). */
export function createBadge(surface: Surface, cb: BadgeCallbacks): HTMLElement {
  const wrap = document.createElement('div');
  wrap.setAttribute(`${SIFT_ATTR}-badge`, '');
  wrap.style.cssText =
    'all: initial; position: absolute !important; top: 4px; right: 4px; z-index: 2147483646; ' +
    'display: inline-flex; gap: 4px; align-items: center; pointer-events: auto;';

  const pill = document.createElement('span');
  pill.style.cssText = PILL_CSS;
  pill.title = `Sift: ${surface.name}`;
  pill.textContent = `Sift · ${surface.vendor}`;
  wrap.appendChild(pill);

  if (cb.showVerify) {
    const verifyBtn = document.createElement('button');
    verifyBtn.style.cssText = BTN_CSS;
    verifyBtn.textContent = 'Verify';
    verifyBtn.title = `Check whether this ${surface.name} answer is backed by its sources`;
    verifyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cb.onVerify?.();
    });
    wrap.appendChild(verifyBtn);
  }

  const dismiss = document.createElement('button');
  dismiss.style.cssText = BTN_CSS + 'background: rgba(0,0,0,0.35); padding: 2px 6px;';
  dismiss.textContent = '×';
  dismiss.title = 'Dismiss Sift marker on this element';
  dismiss.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cb.onDismiss?.();
  });
  wrap.appendChild(dismiss);

  return wrap;
}

// ---------------------------------------------------------------------------
// Verify result panel (Shadow DOM, fully style-isolated, fixed bottom-right)
// ---------------------------------------------------------------------------

export class VerifyPanel {
  private host: HTMLElement;
  private root: ShadowRoot;
  private body!: HTMLElement;
  private titleEl!: HTMLElement;

  constructor() {
    this.host = document.createElement('div');
    this.host.setAttribute(`${SIFT_ATTR}-panel-host`, '');
    this.host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
    this.root = this.host.attachShadow({ mode: 'open' });
    this.render();
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .card {
        position: fixed; right: 16px; bottom: 16px; width: 360px; max-height: 70vh;
        overflow: auto; background: #fff; color: #111827; border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.25); border: 1px solid #e5e7eb;
        font: 13px/1.5 system-ui, -apple-system, sans-serif;
      }
      header { display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px; border-bottom: 1px solid #f0f0f0; position: sticky; top: 0; background: #fff; }
      header .t { font-weight: 700; display: flex; align-items: center; gap: 8px; }
      header .dot { width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; }
      .close { cursor: pointer; border: none; background: none; font-size: 18px; color: #6b7280; line-height: 1; }
      .content { padding: 12px 14px; }
      .summary { font-size: 13px; margin: 0 0 10px; }
      .stage { display: flex; align-items: center; gap: 8px; color: #4b5563; }
      .spinner { width: 14px; height: 14px; border: 2px solid #c7d2fe; border-top-color: #4f46e5;
        border-radius: 50%; animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .claim { border-top: 1px solid #f3f4f6; padding: 8px 0; }
      .claim:first-child { border-top: none; }
      .claim .txt { margin: 0 0 4px; }
      .tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 6px;
        border-radius: 6px; color: #fff; }
      .rationale { color: #4b5563; font-size: 12px; margin: 4px 0 0; }
      .cites { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12px; }
      .cites li { display: flex; gap: 6px; align-items: baseline; padding: 1px 0; }
      .cites a { color: #4338ca; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cites .st { font-size: 10px; font-weight: 700; padding: 0 4px; border-radius: 4px; }
      .st-ok { background: #dcfce7; color: #166534; }
      .st-dead { background: #fee2e2; color: #991b1b; }
      .st-unreachable, .st-unchecked { background: #f3f4f6; color: #6b7280; }
      .foot { font-size: 11px; color: #9ca3af; padding: 8px 14px 12px; }
    `;
    this.root.appendChild(style);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <header>
        <div class="t"><span class="dot"></span><span class="ttl">Sift · Verify</span></div>
        <button class="close" aria-label="Close">×</button>
      </header>
      <div class="content"><div class="body"></div></div>
      <div class="foot"></div>
    `;
    this.root.appendChild(card);
    this.body = card.querySelector('.body') as HTMLElement;
    this.titleEl = card.querySelector('.ttl') as HTMLElement;
    (card.querySelector('.close') as HTMLElement).addEventListener('click', () => this.hide());
  }

  mount(): void {
    if (!this.host.isConnected) document.documentElement.appendChild(this.host);
  }

  hide(): void {
    this.host.remove();
  }

  showProgress(surface: Surface, stage: VerifyStage, detail?: string, estimateUsd?: number): void {
    this.mount();
    this.setDot('#9ca3af');
    this.titleEl.textContent = `Verifying · ${surface.name}`;
    const estimate =
      estimateUsd != null
        ? `<div class="rationale" style="margin-top:6px">Estimated cost: ~${escapeHtml(
            formatUsd(estimateUsd),
          )} (rough)</div>`
        : '';
    this.body.innerHTML = `
      <div class="stage"><span class="spinner"></span><span>${escapeHtml(STAGE_LABEL[stage])}${
        detail ? ` (${escapeHtml(detail)})` : ''
      }</span></div>${estimate}`;
    this.setFoot('Sift fetches the cited sources and checks them with your API key. Source text is sent to your model, then discarded.');
  }

  showResult(surface: Surface, result: VerifyResult): void {
    this.mount();
    const color = VERDICT_COLOR[result.verdict];
    this.setDot(color);
    this.titleEl.textContent = `${surface.name}`;

    const claimsHtml = result.claims
      .map((claim) => {
        const a = result.assessments.find((x) => x.claimId === claim.id);
        const support = a?.support ?? 'unverifiable';
        const cites = claim.citationIds
          .map((cid) => result.citations.find((c) => c.id === cid))
          .filter(Boolean)
          .map((c) => citationLi(c!))
          .join('');
        return `
          <div class="claim">
            <p class="txt">${escapeHtml(claim.text)}</p>
            <span class="tag" style="background:${supportColor(support)}">${escapeHtml(SUPPORT_LABEL[support] ?? support)}</span>
            ${a?.rationale ? `<p class="rationale">${escapeHtml(a.rationale)}</p>` : ''}
            ${cites ? `<ul class="cites">${cites}</ul>` : ''}
          </div>`;
      })
      .join('');

    const orphanCites = result.citations.filter(
      (c) => !result.claims.some((cl) => cl.citationIds.includes(c.id)),
    );

    this.body.innerHTML = `
      <p class="summary"><strong style="color:${color}">${escapeHtml(
        VERDICT_LABELS[result.verdict],
      )}.</strong> ${escapeHtml(result.summary)}</p>
      ${claimsHtml || '<p class="rationale">No discrete claims were extracted.</p>'}
      ${
        orphanCites.length
          ? `<div class="claim"><p class="rationale">Other cited links:</p><ul class="cites">${orphanCites
              .map(citationLi)
              .join('')}</ul></div>`
          : ''
      }`;
    // Measured from reported tokens — shown without the "~" used for the pre-run estimate.
    const cost = result.usage ? ` · cost ${formatUsd(result.usage.usd)}` : '';
    this.setFoot(
      `Checked with ${escapeHtml(result.model)}${cost} · ${new Date(result.createdAt).toLocaleString()}`,
    );
  }

  private setDot(color: string): void {
    const dot = this.root.querySelector('.dot') as HTMLElement;
    if (dot) dot.style.background = color;
  }

  private setFoot(text: string): void {
    const foot = this.root.querySelector('.foot') as HTMLElement;
    if (foot) foot.textContent = text;
  }
}

function citationLi(c: { url: string; title?: string; status: string }): string {
  const stClass =
    c.status === 'ok' ? 'st-ok' : c.status === 'dead' ? 'st-dead' : c.status === 'unreachable' ? 'st-unreachable' : 'st-unchecked';
  const label = c.status === 'dead' ? '404' : c.status === 'ok' ? 'ok' : c.status;
  // Defense in depth: only ever emit an http(s) href, never javascript:/data:.
  const safeHref = /^https?:\/\//i.test(c.url) ? escapeAttr(c.url) : '#';
  return `<li><span class="st ${stClass}">${escapeHtml(label)}</span><a href="${safeHref}" target="_blank" rel="noreferrer noopener">${escapeHtml(
    c.title || c.url,
  )}</a></li>`;
}

function supportColor(support: string): string {
  switch (support) {
    case 'supported':
      return '#15803d';
    case 'partial':
      return '#b45309';
    case 'unsupported':
      return '#b91c1c';
    default:
      return '#6b7280';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
