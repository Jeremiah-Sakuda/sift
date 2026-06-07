import { describe, it, expect } from 'vitest';
import { normalizeForHash, fnv1a, answerHash } from '@/lib/hash';

describe('hash', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeForHash('  Hello\n  World  ')).toBe('hello world');
  });

  it('is deterministic', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('answerHash is stable across trivial whitespace/case churn', () => {
    const a = answerHash('The Sky is Blue.', 'perplexity');
    const b = answerHash('the   sky is blue.', 'perplexity');
    expect(a).toBe(b);
  });

  it('answerHash is namespaced by surface', () => {
    expect(answerHash('same text', 'a')).not.toBe(answerHash('same text', 'b'));
    expect(answerHash('same text', 'perplexity').startsWith('perplexity:')).toBe(true);
  });
});
