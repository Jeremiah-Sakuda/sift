/**
 * LIVE entailment accuracy eval. Skipped unless both RUN_ENTAILMENT_EVAL=1 and an
 * API key are set, so the normal offline `npm test` never makes network calls.
 *
 *   ANTHROPIC_API_KEY=sk-... npm run eval
 *
 * Prints a confusion matrix and asserts loose guardrails (accuracy floor, and a
 * ceiling on the dangerous false-supported rate). It's a quality signal, not a
 * pass/fail gate for ordinary development.
 */
import { describe, it, expect } from 'vitest';
import { judgeClaim } from '@/lib/verify/entailment';
import { ENTAILMENT_CASES } from '@/eval/entailment-cases';
import { scoreEval, formatReport, type Prediction, type Label } from '@/eval/score';

const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
const model = process.env.SIFT_EVAL_MODEL ?? 'claude-haiku-4-5';
const RUN = process.env.RUN_ENTAILMENT_EVAL === '1' && !!apiKey;

describe.skipIf(!RUN)('entailment accuracy (live)', () => {
  it(
    'meets accuracy and false-supported guardrails',
    async () => {
      const predictions: Prediction[] = [];
      for (const c of ENTAILMENT_CASES) {
        const assessment = await judgeClaim({
          apiKey,
          model,
          claim: { id: 'c', text: c.claim, citationIds: ['cite-0'] },
          sources: [{ citationId: 'cite-0', url: 'https://eval.example/source', text: c.source }],
        });
        // 'no_source' shouldn't occur here (we always pass a source); fold into unverifiable.
        const predicted = (assessment.support === 'no_source' ? 'unverifiable' : assessment.support) as Label;
        predictions.push({ expected: c.expected, predicted });
      }

      const report = scoreEval(predictions);
      // eslint-disable-next-line no-console
      console.log('\nEntailment eval (' + model + '):\n' + formatReport(report));

      expect(report.accuracy).toBeGreaterThanOrEqual(0.6);
      expect(report.falseSupportedRate).toBeLessThanOrEqual(0.25);
    },
    120_000,
  );
});
