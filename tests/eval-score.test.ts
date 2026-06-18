import { describe, it, expect } from 'vitest';
import { scoreEval, type Prediction } from '@/eval/score';

describe('scoreEval', () => {
  it('computes accuracy and the false-supported rate', () => {
    const preds: Prediction[] = [
      { expected: 'supported', predicted: 'supported' }, // correct
      { expected: 'unsupported', predicted: 'unsupported' }, // correct
      { expected: 'partial', predicted: 'supported' }, // WRONG + false-supported
      { expected: 'unverifiable', predicted: 'unverifiable' }, // correct
    ];
    const r = scoreEval(preds);
    expect(r.total).toBe(4);
    expect(r.correct).toBe(3);
    expect(r.accuracy).toBeCloseTo(0.75);
    // 1 false-supported out of 3 non-supported-truth cases.
    expect(r.falseSupportedRate).toBeCloseTo(1 / 3);
    expect(r.confusion.partial.supported).toBe(1);
  });

  it('handles an empty set without dividing by zero', () => {
    const r = scoreEval([]);
    expect(r.accuracy).toBe(0);
    expect(r.falseSupportedRate).toBe(0);
  });
});
