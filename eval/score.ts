/**
 * Scoring for the entailment eval. Pure functions so the metric logic is itself
 * unit-tested; the live model run lives in tests/eval (gated behind an API key).
 *
 * The metric we care about most is the FALSE-SUPPORTED rate: how often the judge
 * says "supported" when the truth is anything else. That's the failure mode that
 * would make Sift vouch for an answer it shouldn't.
 */

export type Label = 'supported' | 'partial' | 'unsupported' | 'unverifiable';

export interface Prediction {
  expected: Label;
  predicted: Label;
}

export interface EvalReport {
  total: number;
  correct: number;
  accuracy: number;
  /** P(predicted=supported | expected≠supported) — the dangerous over-claim rate. */
  falseSupportedRate: number;
  confusion: Record<Label, Record<Label, number>>;
}

const LABELS: Label[] = ['supported', 'partial', 'unsupported', 'unverifiable'];

export function scoreEval(predictions: Prediction[]): EvalReport {
  const confusion = Object.fromEntries(
    LABELS.map((e) => [e, Object.fromEntries(LABELS.map((p) => [p, 0])) as Record<Label, number>]),
  ) as Record<Label, Record<Label, number>>;

  let correct = 0;
  for (const { expected, predicted } of predictions) {
    confusion[expected][predicted]++;
    if (expected === predicted) correct++;
  }

  const nonSupportedTruth = predictions.filter((p) => p.expected !== 'supported');
  const falseSupported = nonSupportedTruth.filter((p) => p.predicted === 'supported').length;

  return {
    total: predictions.length,
    correct,
    accuracy: predictions.length ? correct / predictions.length : 0,
    falseSupportedRate: nonSupportedTruth.length ? falseSupported / nonSupportedTruth.length : 0,
    confusion,
  };
}

/** Render the confusion matrix as a readable block (rows = expected, cols = predicted). */
export function formatReport(report: EvalReport): string {
  const head = ['exp\\pred', ...LABELS.map((l) => l.slice(0, 6))].join('\t');
  const rows = LABELS.map((e) => [e.slice(0, 8), ...LABELS.map((p) => String(report.confusion[e][p]))].join('\t'));
  return [
    head,
    ...rows,
    '',
    `accuracy=${(report.accuracy * 100).toFixed(1)}%  false-supported=${(report.falseSupportedRate * 100).toFixed(1)}%  (n=${report.total})`,
  ].join('\n');
}
