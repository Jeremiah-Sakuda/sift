import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCitation } from '@/lib/verify/sources';

function fakeResponse(opts: { status?: number; url: string; body?: string; contentType?: string }) {
  return {
    ok: (opts.status ?? 200) >= 200 && (opts.status ?? 200) < 300,
    status: opts.status ?? 200,
    url: opts.url,
    headers: { get: () => opts.contentType ?? 'text/html' },
    text: vi.fn(async () => opts.body ?? '<main>Article body text here.</main>'),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchCitation security behavior', () => {
  it('omits credentials on the request', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      fakeResponse({ url: 'https://example.com/a' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchCitation('c', 'https://example.com/a', 'A', 1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  });

  it('never fetches an internal target (pre-fetch SSRF block)', async () => {
    const fetchMock = vi.fn(async () => fakeResponse({ url: 'http://169.254.169.254/' }));
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchCitation('c', 'http://169.254.169.254/latest/meta-data', undefined, 1000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.citation.status).toBe('unreachable');
    expect(out.text).toBeUndefined();
  });

  it('discards the body when a public URL redirects to an internal host', async () => {
    const internal = fakeResponse({ url: 'http://[::ffff:169.254.169.254]/', body: 'secret metadata' });
    const fetchMock = vi.fn(async () => internal);
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchCitation('c', 'https://safe.example/redirector', undefined, 1000);

    expect(fetchMock).toHaveBeenCalledTimes(1); // the request went out…
    expect(out.citation.status).toBe('unreachable'); // …but the internal landing is refused
    expect(out.text).toBeUndefined();
    expect(internal.text).not.toHaveBeenCalled(); // body never read
  });

  it('returns extracted text for a normal public source', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ url: 'https://example.com/a' })));
    const out = await fetchCitation('c', 'https://example.com/a', 'A', 1000);
    expect(out.citation.status).toBe('ok');
    expect(out.text).toContain('Article body text');
  });

  it('marks 404 as dead (the fabrication signal)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ status: 404, url: 'https://example.com/missing' })));
    const out = await fetchCitation('c', 'https://example.com/missing', undefined, 1000);
    expect(out.citation.status).toBe('dead');
  });
});
