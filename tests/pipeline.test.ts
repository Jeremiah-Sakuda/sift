import { describe, it, expect } from 'vitest';
import { aggregateVerdict, mapLimit } from '@/lib/verify/pipeline';
import type { Citation, ClaimAssessment } from '@/lib/types';

const cite = (status: Citation['status'], id = 'c'): Citation => ({ id, url: 'https://x', status });
const assess = (
  support: ClaimAssessment['support'],
  citationIds: string[] = [],
): ClaimAssessment => ({ claimId: 'c', support, rationale: '', citationIds });

describe('aggregateVerdict precedence', () => {
  it('flags fabricated only when a claim is backed solely by dead links', () => {
    // The claim cites just c-dead, which is 404 → fabricated.
    expect(
      aggregateVerdict([cite('dead', 'c-dead')], [assess('unverifiable', ['c-dead'])]),
    ).toBe('fabricated_citations');
  });

  it('does NOT cry fabrication when one dead link sits beside live, supported sources', () => {
    // Routine link rot: one dead citation, but the claim is supported by a live one.
    const citations = [cite('dead', 'c1'), cite('ok', 'c2')];
    expect(aggregateVerdict(citations, [assess('supported', ['c2'])])).toBe('sourced_supported');
  });

  it('flags unsupported claims when no fabrication', () => {
    expect(aggregateVerdict([cite('ok')], [assess('unsupported'), assess('supported')])).toBe(
      'unsupported_claims',
    );
  });

  it('reports sourced & supported only when fully supported (no partials)', () => {
    expect(aggregateVerdict([cite('ok')], [assess('supported'), assess('supported')])).toBe(
      'sourced_supported',
    );
  });

  it('does NOT let a lone partial earn the green badge', () => {
    expect(aggregateVerdict([cite('ok')], [assess('partial'), assess('unverifiable')])).toBe(
      'partially_supported',
    );
    expect(aggregateVerdict([cite('ok')], [assess('supported'), assess('partial')])).toBe(
      'partially_supported',
    );
  });

  it('does NOT go green when a claim is uncited/unverifiable', () => {
    // One supported claim + one with no source must not earn the clean green badge.
    expect(aggregateVerdict([cite('ok')], [assess('supported'), assess('no_source')])).toBe(
      'partially_supported',
    );
    expect(aggregateVerdict([cite('ok')], [assess('supported'), assess('unverifiable')])).toBe(
      'partially_supported',
    );
  });

  it('refuses (unverifiable) when nothing could be checked', () => {
    expect(aggregateVerdict([], [assess('no_source')])).toBe('unverifiable');
    expect(aggregateVerdict([cite('unreachable')], [assess('unverifiable')])).toBe('unverifiable');
  });
});

describe('mapLimit', () => {
  it('preserves order and runs all items', async () => {
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    await mapLimit([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});
