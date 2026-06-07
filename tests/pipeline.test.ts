import { describe, it, expect } from 'vitest';
import { aggregateVerdict, mapLimit } from '@/lib/verify/pipeline';
import type { Citation, ClaimAssessment } from '@/lib/types';

const cite = (status: Citation['status'], id = 'c'): Citation => ({ id, url: 'https://x', status });
const assess = (support: ClaimAssessment['support']): ClaimAssessment => ({
  claimId: 'c',
  support,
  rationale: '',
  citationIds: [],
});

describe('aggregateVerdict precedence', () => {
  it('flags fabricated citations first (a dead link)', () => {
    expect(aggregateVerdict([cite('dead'), cite('ok')], [assess('supported')])).toBe(
      'fabricated_citations',
    );
  });

  it('flags unsupported claims when no dead links', () => {
    expect(aggregateVerdict([cite('ok')], [assess('unsupported'), assess('supported')])).toBe(
      'unsupported_claims',
    );
  });

  it('reports sourced & supported when claims are backed', () => {
    expect(aggregateVerdict([cite('ok')], [assess('supported'), assess('partial')])).toBe(
      'sourced_supported',
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
