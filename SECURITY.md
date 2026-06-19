# Security Policy

Sift takes security seriously — it's a trust tool, and it fetches arbitrary URLs an
AI answer cites. Thanks for helping keep it safe.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting: go to the
[Security tab](https://github.com/Jeremiah-Sakuda/sift/security) → **Report a vulnerability**.
We aim to acknowledge reports within a few days.

If you can, include: affected version, reproduction steps, impact, and any suggested fix.

## Scope — where to look

The most security-relevant surfaces:

- **Source fetching (Verify).** The background worker fetches cited URLs with the optional
  `*://*/*` permission. We guard against SSRF (loopback / link-local incl. `169.254.169.254`
  / RFC-1918 / IPv4-mapped IPv6 / internal name suffixes), block fetches before and after
  redirects, and use `credentials: 'omit'`. See [`lib/net.ts`](lib/net.ts) and
  [`lib/verify/sources.ts`](lib/verify/sources.ts).
- **In-page result panel.** Built with `innerHTML` from answer/source-derived strings; all
  dynamic values are HTML-escaped and citation hrefs are restricted to http(s). See
  [`lib/content/ui.ts`](lib/content/ui.ts).
- **Prompt injection.** Fetched source text is fenced as untrusted before the entailment
  call. See [`lib/verify/entailment.ts`](lib/verify/entailment.ts).
- **API key handling.** The user's key lives in `chrome.storage.local` and is sent only to
  the configured model endpoint.

## Known limitations (already documented)

- **DNS rebinding** can't be fully prevented from inside a browser fetch — the SSRF guard
  inspects the literal hostname, not the resolved address (noted in `lib/net.ts`).
- The model endpoint (`baseUrl`) is user-configured and intentionally not SSRF-restricted,
  so a local provider (e.g. `localhost:11434`) works.

## Supported versions

Sift is pre-1.0; only the latest release on `main` receives security fixes.
