# Chrome Web Store listing

Everything needed to publish Sift. The build artifact is produced by `npm run zip`
(→ `.output/sift-<version>-chrome.zip`); upload that. Actual submission requires a
[Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole/)
(one-time $5 fee) and must be done by the project owner.

## Listing fields

**Name:** Sift — Tag, Verify & Block AI

**Summary (≤132 chars):**
> When an AI answer cites sources, Sift checks whether they actually back the claims — or tag/block AI surfaces. Free; bring your own model.

**Category:** Productivity

**Description:**
> AI answers now show up on pages whether you asked for them or not, with no signal of whether they're grounded. Sift gives you one dial — Tag, Verify, or Block — over the AI surfaces you can identify with certainty.
>
> • TAG (free, instant): outline known AI surfaces with a small badge. No account, no key, no permissions.
> • BLOCK (free, instant): remove them entirely, cleanly.
> • VERIFY (the differentiator): when an AI answer cites sources, Sift fetches those sources and checks whether they actually back each claim — flagging fabricated (404) citations and unsupported claims, and refusing to guess when it can't tell. Bring your own Anthropic API key, or point it at a local/OpenAI-compatible model so nothing leaves your machine.
>
> Sift only acts on AI it can identify with certainty — it never guesses whether arbitrary text or images are "AI". No accounts, no servers, no tracking. Open source (MIT).

## Permission justifications (the review form asks for each)

- **storage** — saves your settings locally (chrome.storage.local). No remote storage.
- **activeTab** — reads the current tab's address in the popup so you can set a per-site level.
- **host permission `api.anthropic.com`** — required so the Verify feature can call the Anthropic API directly with your own key.
- **optional host permission `*://*/*`** — requested only if/when you turn on Verify's "fetch cited sources"; used to download the pages an AI answer cites so they can be checked. Never requested at install.
- **content script on all sites** — to find known AI surfaces wherever they appear (e.g. embeddable AI chat widgets). It reads the page locally and sends nothing anywhere.

**Data usage disclosures:** Sift does not collect or transmit personal or browsing data.
The only outbound traffic is the user-initiated Verify (source fetches + the user's own
model call). No analytics, no remote code.

## Assets to prepare (manual)

- [ ] 128×128 store icon (use `public/icon/128.png`)
- [ ] At least 1 screenshot, 1280×800 or 640×400 — suggest: the popup dial, a tagged Google AI Overview, and the Verify result panel
- [ ] Small promo tile 440×280 (optional)
- [ ] A privacy policy URL → link [PRIVACY.md](../PRIVACY.md) (raw GitHub URL is acceptable)

## Submit

```bash
npm run zip          # → .output/sift-<version>-chrome.zip
```

1. Developer Console → **New item** → upload the zip.
2. Fill the fields above; set visibility (Unlisted is a good first step for testing).
3. Submit for review.

A Firefox (AMO) listing is a later target; `npm run zip:firefox` produces that artifact.
