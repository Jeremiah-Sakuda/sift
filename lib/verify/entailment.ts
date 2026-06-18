/**
 * Support check (Verify pipeline, step 3): does the cited source actually back
 * the claim? An entailment judgement via the LLM. REFUSE semantics — when the
 * source text is missing or inconclusive, return `unverifiable`, never a guess.
 */

import { callStructured } from './anthropic';
import { MAX_SOURCE_CHARS } from '../config';
import type { Claim, ClaimAssessment, ClaimSupport } from '../types';

export interface SourceText {
  citationId: string;
  url: string;
  title?: string;
  text: string;
}

const SYSTEM = [
  'You judge whether a factual CLAIM is supported by the provided SOURCE excerpts.',
  'You are strict and literal. Base your judgement ONLY on the source text shown — never on outside knowledge.',
  'Verdicts:',
  '- "supported": the sources clearly state or directly entail the claim.',
  '- "partial": the sources back part of the claim but not all of it, or only weakly.',
  '- "unsupported": the sources address the topic but do NOT support the claim (or contradict it).',
  '- "unverifiable": the sources are off-topic, empty, or insufficient to judge. When in doubt, choose this.',
  'Give a one-sentence, plain rationale citing what the source did or did not say. Do not fabricate.',
].join('\n');

/** Judge a single claim against the text of the sources it cites. */
export async function judgeClaim(params: {
  apiKey: string;
  model: string;
  claim: Claim;
  sources: SourceText[];
  signal?: AbortSignal;
  usageSink?: (usage: { inputTokens: number; outputTokens: number }) => void;
}): Promise<ClaimAssessment> {
  const { apiKey, model, claim, sources, signal, usageSink } = params;

  // No usable source text — do not spend an LLM call; report honestly.
  if (sources.length === 0) {
    return {
      claimId: claim.id,
      support: claim.citationIds.length === 0 ? 'no_source' : 'unverifiable',
      rationale:
        claim.citationIds.length === 0
          ? 'The answer attributes no citation to this claim.'
          : 'The cited source(s) could not be retrieved, so support cannot be judged.',
      citationIds: claim.citationIds,
    };
  }

  const perSourceBudget = Math.max(1000, Math.floor(MAX_SOURCE_CHARS / sources.length));
  const sourceBlock = sources
    .map(
      (s, i) =>
        `SOURCE ${i + 1} (${s.url})${s.title ? ` — ${s.title}` : ''}:\n"""\n${s.text.slice(0, perSourceBudget)}\n"""`,
    )
    .join('\n\n');

  const prompt = [
    `CLAIM: ${claim.text}`,
    '',
    sourceBlock,
    '',
    'Does the source text support the claim?',
  ].join('\n');

  const raw = await callStructured<{ support: ClaimSupport; rationale: string }>({
    apiKey,
    model,
    system: SYSTEM,
    prompt,
    maxTokens: 512,
    signal,
    usageSink,
    tool: {
      name: 'record_judgement',
      description: 'Record whether the sources support the claim.',
      input_schema: {
        type: 'object',
        additionalProperties: false,
        required: ['support', 'rationale'],
        properties: {
          support: {
            type: 'string',
            enum: ['supported', 'partial', 'unsupported', 'unverifiable'],
          },
          rationale: { type: 'string' },
        },
      },
    },
  });

  return {
    claimId: claim.id,
    support: raw.support,
    rationale: raw.rationale,
    citationIds: claim.citationIds,
  };
}
