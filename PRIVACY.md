# Sift — Privacy

Sift is built so that, by default, **no browsing data ever leaves your device.**

## What Sift stores

Everything is kept locally in `chrome.storage.local`, on your machine only:

- Your intensity settings (global default + per-site overrides).
- Appearance preferences.
- Your Anthropic API key, if you choose to use Verify.
- A cache of Verify results (verdicts for answers you've checked).

There are no accounts, no servers, and no analytics or telemetry. Sift never phones home.

## When Sift makes a network request

Tag and Block make **zero** network requests — they only read and restyle the page.

The **only** outbound traffic Sift originates happens during a Verify that **you**
explicitly trigger by clicking the Verify button:

1. **Source fetches.** Sift downloads each page the AI answer cites, in order to check
   whether those sources actually support the answer's claims. This requires the optional
   "fetch cited sources" permission, which you grant explicitly in Options — it is not
   requested at install time. These fetches are made **without your cookies or session**
   (`credentials: 'omit'`), so they can't carry your logged-in identity to third-party
   sites, and Sift refuses to fetch internal/loopback/private network addresses.
2. **One LLM call per Verify.** The answer text and the fetched source text are sent to
   the Anthropic API using **your own API key**, to extract claims and judge support.
   This call goes directly from your browser to `api.anthropic.com` — there is no Sift
   proxy or server in between.

To be precise about egress: the fetched source text **is sent to your model** (step 2
above) for the support check. Sift does not *store* it — after that call it is discarded,
and only the resulting verdict is cached locally. If you don't want source text leaving
your machine at all, set the Verify provider to a local server (see Options → Verify).

## Your API key

Your Anthropic key is stored in `chrome.storage.local` and used only for the direct
Verify call described above. Because the call is made client-side, anyone with access to
your browser profile could read the key — it is *your* key, scoped to *your* Anthropic
account. Treat it like any other saved credential.

## Permissions Sift requests

- `storage` — to save your settings locally.
- `activeTab` — to read the current tab's address in the popup for the per-site toggle.
- `host_permissions: https://api.anthropic.com/*` — required so the Verify LLM call can be made.
- `optional_host_permissions: *://*/*` — requested only when you enable source fetching for Verify.
- A content script on all sites — so Sift can find AI surfaces wherever they appear. It
  reads the page locally and sends nothing anywhere.

## Questions

Open an issue at https://github.com/Jeremiah-Sakuda/sift.
