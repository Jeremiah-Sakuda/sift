import { describe, it, expect } from 'vitest';
import { roughTokens, costUsd, estimateUpfront, formatUsd } from '@/lib/verify/cost';

describe('cost', () => {
  it('roughTokens approximates ~4 chars/token', () => {
    expect(roughTokens(0)).toBe(0);
    expect(roughTokens(4)).toBe(1);
    expect(roughTokens(401)).toBe(101);
  });

  it('costUsd uses model pricing (Haiku 4.5 = $1/$5 per 1M)', () => {
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0 }, 'claude-haiku-4-5')).toBeCloseTo(1.0);
    expect(costUsd({ inputTokens: 0, outputTokens: 200_000 }, 'claude-haiku-4-5')).toBeCloseTo(1.0);
  });

  it('falls back to mid pricing for unknown models', () => {
    const known = costUsd({ inputTokens: 1_000_000, outputTokens: 0 }, 'claude-haiku-4-5');
    const unknown = costUsd({ inputTokens: 1_000_000, outputTokens: 0 }, 'some-future-model');
    expect(unknown).toBeGreaterThan(known);
  });

  it('estimateUpfront returns a positive rough ballpark', () => {
    const est = estimateUpfront({ answerChars: 1200, citationCount: 4, maxSources: 5, model: 'claude-haiku-4-5' });
    expect(est.rough).toBe(true);
    expect(est.usd).toBeGreaterThan(0);
  });

  it('formatUsd renders small amounts readably', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.0004)).toBe('<$0.001');
    expect(formatUsd(0.004)).toBe('$0.004');
    expect(formatUsd(0.25)).toBe('$0.25');
  });
});
