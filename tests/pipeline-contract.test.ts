import { vi, describe, it, expect } from 'vitest';

// Mock the LLM transport: extraction returns canned claims (incl. an out-of-range
// citation index that must be dropped); judgement always returns "supported".
vi.mock('@/lib/verify/anthropic', async (orig) => {
  const actual = await orig<typeof import('@/lib/verify/anthropic')>();
  return {
    ...actual,
    callStructured: vi.fn(async (params: { tool: { name: string } }) => {
      if (params.tool.name === 'record_claims') {
        return {
          claims: [
            { text: 'Claim A', citation_indexes: [1] },
            { text: 'Claim B', citation_indexes: [2, 99] }, // 99 is out of range → dropped
            { text: 'Claim C', citation_indexes: [] },
          ],
        };
      }
      return { support: 'supported', rationale: 'mock' };
    }),
  };
});

// Mock the network: every fetched source resolves OK with text.
vi.mock('@/lib/verify/sources', async (orig) => {
  const actual = await orig<typeof import('@/lib/verify/sources')>();
  return {
    ...actual,
    fetchCitation: vi.fn(async (id: string, url: string, title?: string) => ({
      citation: { id, url, title, status: 'ok' as const },
      text: `source body for ${url}`,
    })),
  };
});

import { runVerify } from '@/lib/verify/pipeline';
import type { VerifyRequest, VerifySettings } from '@/lib/types';

const settings: VerifySettings = {
  provider: 'anthropic',
  apiKey: 'sk-test',
  baseUrl: '',
  model: 'claude-haiku-4-5',
  maxSourcesPerCheck: 2, // 3rd citation becomes an unchecked overflow
  fetchTimeoutMs: 1000,
};

const request: VerifyRequest = {
  surfaceId: 'perplexity-answer',
  answerHash: 'h1',
  answerText: 'Some answer with claims.',
  citations: [
    { url: 'https://a.example/1' },
    { url: 'https://b.example/2' },
    { url: 'https://c.example/3' }, // beyond maxSourcesPerCheck → unchecked
  ],
  pageUrl: 'https://www.perplexity.ai/search/x',
};

describe('verify pipeline cite-N indexing contract', () => {
  it('aligns extracted citation indexes with fetched citation ids', async () => {
    const result = await runVerify(request, settings);

    // Citation ids are cite-0..cite-2, aligned to request order.
    expect(result.citations.map((c) => c.id)).toEqual(['cite-0', 'cite-1', 'cite-2']);
    expect(result.citations[0].url).toBe('https://a.example/1');

    // The source beyond the cap is recorded but unchecked.
    expect(result.citations[2].status).toBe('unchecked');
    expect(result.citations[0].status).toBe('ok');

    // 1-based model indexes map to cite-(n-1); the out-of-range 99 is dropped.
    const byClaim = Object.fromEntries(result.claims.map((c) => [c.text, c.citationIds]));
    expect(byClaim['Claim A']).toEqual(['cite-0']);
    expect(byClaim['Claim B']).toEqual(['cite-1']);
    expect(byClaim['Claim C']).toEqual([]);

    // Every referenced citation id actually exists in the citation list.
    const ids = new Set(result.citations.map((c) => c.id));
    for (const claim of result.claims) {
      for (const cid of claim.citationIds) expect(ids.has(cid)).toBe(true);
    }

    // Two claims are supported by live sources, but Claim C is uncited — so the
    // answer is partially (not fully) supported: green is reserved for all-checked.
    expect(result.verdict).toBe('partially_supported');
  });
});
