/**
 * Claim extraction (Verify pipeline, step 1).
 *
 * Given the answer text and the citations discovered in the DOM, ask the model
 * to break the answer into discrete, checkable factual claims and map each to
 * the citations the answer itself attributes it to. The model does NOT judge
 * truth here and must not invent claims.
 */

import { callStructured } from './anthropic';
import { MAX_ANSWER_CHARS } from '../config';
import type { Claim } from '../types';
import type { ExtractedCitation } from '../selectors/engine';

interface RawExtraction {
  claims: { text: string; citation_indexes: number[] }[];
}

const SYSTEM = [
  'You extract discrete, individually checkable factual claims from an AI-generated answer.',
  'Rules:',
  '- Only extract claims that are actually stated in the answer. Never add, infer, or embellish.',
  '- Split compound sentences into atomic claims where reasonable.',
  '- Ignore hedges, opinions, questions, and meta-text ("here is a summary").',
  '- For each claim, list the 1-based indexes of the numbered citations the answer attributes it to.',
  '  If the answer does not attribute a citation to a claim, use an empty list.',
  '- Do NOT judge whether claims are true. That happens in a later step.',
].join('\n');

export async function extractClaims(params: {
  apiKey: string;
  model: string;
  provider?: import('../types').VerifyProvider;
  baseUrl?: string;
  answerText: string;
  citations: ExtractedCitation[];
  signal?: AbortSignal;
  usageSink?: (usage: { inputTokens: number; outputTokens: number }) => void;
}): Promise<Claim[]> {
  const { apiKey, model, provider, baseUrl, answerText, citations, signal, usageSink } = params;

  const numbered = citations.length
    ? citations.map((c, i) => `[${i + 1}] ${c.url}${c.title ? ` — ${c.title}` : ''}`).join('\n')
    : '(the answer provides no citations)';

  const prompt = [
    'ANSWER:',
    '"""',
    answerText.slice(0, MAX_ANSWER_CHARS),
    '"""',
    '',
    'CITATIONS:',
    numbered,
    '',
    'Extract the factual claims and map each to its attributed citation indexes.',
  ].join('\n');

  const raw = await callStructured<RawExtraction>({
    apiKey,
    model,
    provider,
    baseUrl,
    system: SYSTEM,
    prompt,
    maxTokens: 2048,
    signal,
    usageSink,
    tool: {
      name: 'record_claims',
      description: 'Record the discrete factual claims extracted from the answer.',
      input_schema: {
        type: 'object',
        additionalProperties: false,
        required: ['claims'],
        properties: {
          claims: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'citation_indexes'],
              properties: {
                text: { type: 'string', description: 'The atomic factual claim, quoted/paraphrased faithfully.' },
                citation_indexes: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: '1-based indexes of attributed citations; empty if none.',
                },
              },
            },
          },
        },
      },
    },
  });

  return (raw.claims ?? []).map((c, i) => ({
    id: `claim-${i}`,
    text: c.text,
    citationIds: (c.citation_indexes ?? [])
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= citations.length)
      .map((n) => `cite-${n - 1}`),
  }));
}
