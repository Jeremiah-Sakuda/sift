import { describe, it, expect } from 'vitest';
import { resolveEndpoint } from '@/lib/verify/anthropic';

describe('resolveEndpoint', () => {
  it('defaults to the Anthropic Messages API', () => {
    expect(resolveEndpoint('anthropic')).toBe('https://api.anthropic.com/v1/messages');
  });

  it('appends the Anthropic path to a base override', () => {
    expect(resolveEndpoint('anthropic', 'https://proxy.example')).toBe('https://proxy.example/v1/messages');
    expect(resolveEndpoint('anthropic', 'https://proxy.example/v1')).toBe('https://proxy.example/v1/messages');
    expect(resolveEndpoint('anthropic', 'https://proxy.example/v1/messages')).toBe('https://proxy.example/v1/messages');
  });

  it('builds an OpenAI-compatible chat-completions URL', () => {
    expect(resolveEndpoint('openai-compatible', 'http://localhost:11434')).toBe('http://localhost:11434/v1/chat/completions');
    expect(resolveEndpoint('openai-compatible', 'http://localhost:11434/v1')).toBe('http://localhost:11434/v1/chat/completions');
    expect(resolveEndpoint('openai-compatible', 'http://localhost:11434/v1/chat/completions')).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('trims trailing slashes', () => {
    expect(resolveEndpoint('openai-compatible', 'http://localhost:11434/')).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('throws when an OpenAI-compatible base URL is missing', () => {
    expect(() => resolveEndpoint('openai-compatible', '')).toThrow();
  });
});
