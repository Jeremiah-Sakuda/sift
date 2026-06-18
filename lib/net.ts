/**
 * Network-target guard for the Verify source fetcher (SSRF defense).
 *
 * A cited URL comes from an untrusted web page. With the optional all-sites host
 * permission granted, a naive fetch could be pointed at loopback, link-local
 * (incl. the cloud metadata endpoint 169.254.169.254), or RFC-1918 private hosts
 * to read internal services. We block those targets before fetching, and re-check
 * the final URL after redirects (see sources.ts).
 *
 * Pure string logic, no extension APIs — unit-testable. Note: DNS rebinding (a
 * public name resolving to a private IP) can't be fully prevented from inside the
 * browser; this blocks the literal-IP and known-internal-name vectors.
 */

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.intranet', '.home.arpa'];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a > 255 || b > 255 || Number(m[3]) > 255 || Number(m[4]) > 255) return true; // malformed → block
  return (
    a === 0 || // 0.0.0.0/8
    a === 127 || // loopback
    a === 10 || // private
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes(':')) return false;
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (/^f[cd]/.test(h)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(h)) return true; // fe80::/10 link-local
  // IPv4-mapped/embedded (e.g. ::ffff:169.254.169.254)
  const v4 = h.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4 && isPrivateIPv4(v4[1])) return true;
  return false;
}

/** True if a host must not be fetched (loopback / link-local / private / internal name). */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost') return true;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (isPrivateIPv4(host)) return true;
  if (isPrivateIPv6(host)) return true;
  return false;
}

/** True if a URL is a fetchable public http(s) target. */
export function isPublicHttpUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return !isBlockedHost(url.hostname);
}
