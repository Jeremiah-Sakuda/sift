/**
 * Minimal Anthropic Messages API client for the bring-your-own-key Verify tier.
 *
 * Runs in the background service worker. Forces structured JSON output by
 * declaring a single tool and requiring the model to call it (tool_choice),
 * so we never have to parse free-form text. No SDK dependency — just fetch —
 * to keep the bundle small and the surface auditable.
 */

import {
  ANTHROPIC_ENDPOINT,
  ANTHROPIC_VERSION,
  ANTHROPIC_BROWSER_HEADER,
} from '../config';

export class AnthropicError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind: 'auth' | 'rate_limit' | 'overloaded' | 'request' | 'network' = 'request',
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

/** JSON Schema for a forced-tool input. */
export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

export interface StructuredCallParams<T> {
  apiKey: string;
  model: string;
  system: string;
  /** User message content. */
  prompt: string;
  /** The single tool the model is forced to call; its input is the typed result. */
  tool: ToolDef;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

/**
 * Call the model and return the validated tool input as `T`.
 * Throws AnthropicError on auth / transport / shape problems so the caller can
 * surface an honest error verdict (REFUSE semantics) rather than guess.
 */
export async function callStructured<T>(params: StructuredCallParams<T>): Promise<T> {
  const { apiKey, model, system, prompt, tool, maxTokens = 1024, signal } = params;

  if (!apiKey) throw new AnthropicError('No API key configured.', undefined, 'auth');

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        [ANTHROPIC_BROWSER_HEADER]: 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
      }),
      signal,
    });
  } catch (err) {
    throw new AnthropicError(
      `Network error calling Anthropic: ${(err as Error).message}`,
      undefined,
      'network',
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const kind =
      res.status === 401 || res.status === 403
        ? 'auth'
        : res.status === 429
          ? 'rate_limit'
          : res.status === 529
            ? 'overloaded'
            : 'request';
    throw new AnthropicError(
      `Anthropic API ${res.status}: ${truncate(body, 300)}`,
      res.status,
      kind,
    );
  }

  const data = (await res.json()) as AnthropicResponse;
  const block = data.content?.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!block || block.input == null) {
    throw new AnthropicError(
      `Model did not return structured output (stop_reason=${data.stop_reason ?? 'unknown'}).`,
    );
  }
  return block.input as T;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** A lightweight key check used by the options page ("Test key"). */
export async function testApiKey(apiKey: string, model: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await callStructured<{ ok: boolean }>({
      apiKey,
      model,
      system: 'You are a connectivity check.',
      prompt: 'Call the tool with ok=true.',
      maxTokens: 64,
      tool: {
        name: 'ack',
        description: 'Acknowledge connectivity.',
        input_schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
          additionalProperties: false,
        },
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
