/**
 * Minimal structured-output LLM client for the bring-your-own-key Verify tier.
 *
 * Runs in the background service worker. Forces structured JSON output by
 * declaring a single tool and requiring the model to call it, so we never parse
 * free-form text. No SDK dependency — just fetch — to keep the bundle small and
 * the surface auditable.
 *
 * Supports two providers:
 *  - `anthropic`         — the Anthropic Messages API (default).
 *  - `openai-compatible` — any OpenAI Chat Completions endpoint, including local
 *    servers (Ollama, llama.cpp, LiteLLM) so page + source text can stay on-device.
 */

import {
  ANTHROPIC_ENDPOINT,
  ANTHROPIC_VERSION,
  ANTHROPIC_BROWSER_HEADER,
} from '../config';
import type { VerifyProvider } from '../types';

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

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredCallParams<T> {
  apiKey: string;
  model: string;
  system: string;
  /** User message content. */
  prompt: string;
  /** The single tool the model is forced to call; its input is the typed result. */
  tool: ToolDef;
  provider?: VerifyProvider;
  /** Endpoint base override (empty = provider default). */
  baseUrl?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Receives token usage for cost accounting (best effort). */
  usageSink?: (usage: TokenUsage) => void;
}

/** Resolve the full endpoint URL for a provider + optional base override. Pure/testable. */
export function resolveEndpoint(provider: VerifyProvider, baseUrl?: string): string {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
  if (provider === 'openai-compatible') {
    if (!base) throw new AnthropicError('Set a server URL for the OpenAI-compatible provider.', undefined, 'request');
    if (base.endsWith('/chat/completions')) return base;
    if (base.endsWith('/v1')) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
  }
  // anthropic
  if (!base) return ANTHROPIC_ENDPOINT;
  if (base.endsWith('/messages')) return base;
  if (base.endsWith('/v1')) return `${base}/messages`;
  return `${base}/v1/messages`;
}

export async function callStructured<T>(params: StructuredCallParams<T>): Promise<T> {
  const provider = params.provider ?? 'anthropic';
  return provider === 'openai-compatible' ? callOpenAICompatible(params) : callAnthropic(params);
}

// ---------------------------------------------------------------------------
// Anthropic Messages API
// ---------------------------------------------------------------------------

interface AnthropicResponse {
  content?: { type: string; name?: string; input?: unknown }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function callAnthropic<T>(params: StructuredCallParams<T>): Promise<T> {
  const { apiKey, model, system, prompt, tool, maxTokens = 1024, signal, usageSink, baseUrl } = params;
  if (!apiKey) throw new AnthropicError('No API key configured.', undefined, 'auth');

  const res = await send(resolveEndpoint('anthropic', baseUrl), {
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      [ANTHROPIC_BROWSER_HEADER]: 'true',
    },
    body: {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    },
    signal,
  });

  const data = (await res.json()) as AnthropicResponse;
  if (usageSink && data.usage) {
    usageSink({ inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 });
  }
  const block = data.content?.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!block || block.input == null) {
    throw new AnthropicError(`Model did not return structured output (stop_reason=${data.stop_reason ?? 'unknown'}).`);
  }
  return block.input as T;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible Chat Completions
// ---------------------------------------------------------------------------

interface OpenAIResponse {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callOpenAICompatible<T>(params: StructuredCallParams<T>): Promise<T> {
  const { apiKey, model, system, prompt, tool, maxTokens = 1024, signal, usageSink, baseUrl } = params;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`; // local servers often need no key

  const res = await send(resolveEndpoint('openai-compatible', baseUrl), {
    headers,
    body: {
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
      tool_choice: { type: 'function', function: { name: tool.name } },
    },
    signal,
  });

  const data = (await res.json()) as OpenAIResponse;
  if (usageSink && data.usage) {
    usageSink({ inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 });
  }
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new AnthropicError('Model did not return structured tool output.');
  try {
    return JSON.parse(args) as T;
  } catch {
    throw new AnthropicError('Model returned malformed tool JSON.');
  }
}

// ---------------------------------------------------------------------------
// Shared transport
// ---------------------------------------------------------------------------

async function send(
  endpoint: string,
  opts: { headers: Record<string, string>; body: unknown; signal?: AbortSignal },
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    throw new AnthropicError(`Network error calling the model: ${(err as Error).message}`, undefined, 'network');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const kind =
      res.status === 401 || res.status === 403
        ? 'auth'
        : res.status === 429
          ? 'rate_limit'
          : res.status === 529 || res.status === 503
            ? 'overloaded'
            : 'request';
    throw new AnthropicError(`Model API ${res.status}: ${truncate(body, 300)}`, res.status, kind);
  }
  return res;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** A lightweight connectivity check used by the options page ("Test"). */
export async function testApiKey(config: {
  provider: VerifyProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await callStructured<{ ok: boolean }>({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
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
