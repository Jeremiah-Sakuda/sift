/**
 * Rough cost estimation for a Verify run, so the user is never surprised by spend.
 *
 * Two numbers:
 *  - an UPFRONT ballpark shown before the user commits (derived from answer length
 *    and citation count, since claim count isn't known until extraction), and
 *  - an ACTUAL cost computed from the token usage the API reports.
 */

import { MODEL_PRICING, FALLBACK_PRICING, MAX_SOURCE_CHARS } from '../config';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CostEstimate {
  usd: number;
  /** True when this is the pre-run ballpark rather than a measured cost. */
  rough: boolean;
}

const pricingFor = (model: string) => MODEL_PRICING[model] ?? FALLBACK_PRICING;

/** ~4 characters per token is a serviceable rule of thumb for English text. */
export function roughTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function costUsd(usage: TokenUsage, model: string): number {
  const p = pricingFor(model);
  return (usage.inputTokens / 1e6) * p.inputPerM + (usage.outputTokens / 1e6) * p.outputPerM;
}

/** Pre-run ballpark from what we can see in the DOM. Intentionally conservative. */
export function estimateUpfront(params: {
  answerChars: number;
  citationCount: number;
  maxSources: number;
  model: string;
}): CostEstimate {
  const { answerChars, citationCount, maxSources, model } = params;
  const estClaims = Math.min(25, Math.max(1, Math.ceil(answerChars / 180)));
  const sources = Math.min(citationCount, maxSources);

  // Extraction: answer + citation list in, a compact claim list out.
  const extractIn = roughTokens(answerChars) + citationCount * 30;
  const extractOut = 80 + estClaims * 40;

  // Entailment: one call per claim that has a source, each carrying source text.
  const perSourceTokens = roughTokens(Math.min(MAX_SOURCE_CHARS, 4000));
  const judgedClaims = Math.min(estClaims, Math.max(1, sources));
  const judgeIn = judgedClaims * (perSourceTokens + 120);
  const judgeOut = judgedClaims * 80;

  const usd = costUsd(
    { inputTokens: extractIn + judgeIn, outputTokens: extractOut + judgeOut },
    model,
  );
  return { usd, rough: true };
}

/** Format a small dollar amount for display, e.g. "<$0.001", "$0.004", "$0.03". */
export function formatUsd(usd: number): string {
  if (usd <= 0) return '$0.00';
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
