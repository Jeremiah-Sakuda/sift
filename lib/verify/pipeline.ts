/**
 * Verify pipeline orchestrator.
 *
 * Order (cheap before expensive, per PRD):
 *   1. Extract claims (LLM) — concurrent with...
 *   2. Fetch + classify cited sources (network): dead links are the cheap,
 *      strong fabricated-citation signal.
 *   3. Judge entailment per claim (LLM) using the fetched source text.
 *   4. Aggregate into one honest verdict. REFUSE — never guess — when unverifiable.
 *
 * Runs in the background worker. Holds no module-level state.
 */

import { extractClaims } from './extract';
import { fetchCitation, type FetchedSource } from './sources';
import { judgeClaim, type SourceText } from './entailment';
import { AnthropicError } from './anthropic';
import type {
  VerifyRequest,
  VerifySettings,
  VerifyResult,
  VerifyVerdict,
  VerifyStage,
  Citation,
  ClaimAssessment,
} from '../types';

export type ProgressFn = (stage: VerifyStage, detail?: string) => void;

const JUDGE_CONCURRENCY = 3;

export async function runVerify(
  request: VerifyRequest,
  settings: VerifySettings,
  onProgress: ProgressFn = () => {},
  signal?: AbortSignal,
): Promise<VerifyResult> {
  const base = {
    surfaceId: request.surfaceId,
    answerHash: request.answerHash,
    model: settings.model,
    createdAt: new Date().toISOString(),
  };

  if (!settings.apiKey) {
    return {
      ...base,
      verdict: 'error',
      summary: 'Add an Anthropic API key in Sift options to use Verify.',
      claims: [],
      citations: [],
      assessments: [],
      error: 'missing_api_key',
    };
  }

  const inputCitations = request.citations.slice(0, Math.max(1, settings.maxSourcesPerCheck * 4));

  try {
    // Steps 1 & 2 run concurrently: claim extraction does not need source bodies.
    onProgress('extracting');
    const extractP = extractClaims({
      apiKey: settings.apiKey,
      model: settings.model,
      answerText: request.answerText,
      citations: inputCitations,
      signal,
    });

    onProgress('fetching_sources', `${Math.min(inputCitations.length, settings.maxSourcesPerCheck)} sources`);
    const fetchP = fetchCitations(inputCitations, settings, signal);

    const [claims, fetched] = await Promise.all([extractP, fetchP]);

    const citations: Citation[] = fetched.map((f) => f.citation);
    const textById = new Map<string, FetchedSource>();
    fetched.forEach((f) => textById.set(f.citation.id, f));

    // Step 3: entailment per claim, limited concurrency.
    onProgress('judging', `${claims.length} claims`);
    const assessments = await mapLimit(claims, JUDGE_CONCURRENCY, async (claim) => {
      const sources: SourceText[] = claim.citationIds
        .map((cid) => textById.get(cid))
        .filter((f): f is FetchedSource => !!f && f.citation.status === 'ok' && !!f.text)
        .map((f) => ({
          citationId: f.citation.id,
          url: f.citation.url,
          title: f.citation.title,
          text: f.text!,
        }));
      return judgeClaim({ apiKey: settings.apiKey, model: settings.model, claim, sources, signal });
    });

    // Step 4: aggregate.
    const verdict = aggregateVerdict(citations, assessments);
    onProgress('done');

    return {
      ...base,
      verdict,
      summary: buildSummary(verdict, citations, assessments),
      claims,
      citations,
      assessments,
    };
  } catch (err) {
    onProgress('error');
    return {
      ...base,
      verdict: 'error',
      summary: errorMessage(err),
      claims: [],
      citations: inputCitations.map((c, i) => ({ id: `cite-${i}`, url: c.url, title: c.title, status: 'unchecked' as const })),
      assessments: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchCitations(
  citations: VerifyRequest['citations'],
  settings: VerifySettings,
  signal?: AbortSignal,
): Promise<FetchedSource[]> {
  const capped = citations.slice(0, settings.maxSourcesPerCheck);
  // Any extra cited URLs beyond the cap are still recorded (unchecked) so the
  // UI shows the full citation list and we never silently drop sources.
  const overflow = citations.slice(settings.maxSourcesPerCheck).map((c, i) => ({
    citation: {
      id: `cite-${settings.maxSourcesPerCheck + i}`,
      url: c.url,
      title: c.title,
      status: 'unchecked' as const,
    },
  }));
  const checked = await mapLimit(capped, settings.maxSourcesPerCheck, (c, i) =>
    fetchCitation(`cite-${i}`, c.url, c.title, settings.fetchTimeoutMs, undefined),
  );
  return [...checked, ...overflow];
}

export function aggregateVerdict(
  citations: Citation[],
  assessments: ClaimAssessment[],
): VerifyVerdict {
  const hasDead = citations.some((c) => c.status === 'dead');
  if (hasDead) return 'fabricated_citations';

  const hasUnsupported = assessments.some((a) => a.support === 'unsupported');
  if (hasUnsupported) return 'unsupported_claims';

  const hasSupported = assessments.some((a) => a.support === 'supported' || a.support === 'partial');
  if (hasSupported) return 'sourced_supported';

  return 'unverifiable';
}

function buildSummary(
  verdict: VerifyVerdict,
  citations: Citation[],
  assessments: ClaimAssessment[],
): string {
  const dead = citations.filter((c) => c.status === 'dead').length;
  const supported = assessments.filter((a) => a.support === 'supported').length;
  const partial = assessments.filter((a) => a.support === 'partial').length;
  const unsupported = assessments.filter((a) => a.support === 'unsupported').length;
  const total = assessments.length;

  switch (verdict) {
    case 'fabricated_citations':
      return `${dead} cited link${dead === 1 ? '' : 's'} could not be found (404/gone) — a strong fabrication signal. Treat this answer with caution.`;
    case 'unsupported_claims':
      return `${unsupported} of ${total} checked claim${total === 1 ? '' : 's'} are not supported by the cited sources.`;
    case 'sourced_supported':
      return `${supported + partial} of ${total} checked claims are backed by their sources${partial ? ` (${partial} partially)` : ''}. No fabricated links found.`;
    case 'unverifiable':
      return citations.length === 0
        ? 'The answer cites no sources, so Sift cannot verify it.'
        : 'Sift could not retrieve or judge the cited sources, so this answer is unverifiable.';
    default:
      return 'Verification failed.';
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof AnthropicError) {
    switch (err.kind) {
      case 'auth':
        return 'Anthropic rejected the API key. Check it in Sift options.';
      case 'rate_limit':
        return 'Anthropic rate limit hit. Try again shortly.';
      case 'overloaded':
        return 'Anthropic is overloaded. Try again shortly.';
      case 'network':
        return 'Could not reach Anthropic. Check your connection.';
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : 'Verification failed.';
}

// ---------------------------------------------------------------------------
// Tiny concurrency limiter
// ---------------------------------------------------------------------------

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
