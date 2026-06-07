import { describe, it, expect } from 'vitest';
import { normalizeHostname, resolveLevel, withDefaults } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/lib/config';
import type { Settings } from '@/lib/types';

describe('normalizeHostname', () => {
  it('strips protocol, www, port and lowercases', () => {
    expect(normalizeHostname('https://www.Google.com/search?q=x')).toBe('google.com');
    expect(normalizeHostname('WWW.Example.COM:8080')).toBe('example.com');
    expect(normalizeHostname('perplexity.ai')).toBe('perplexity.ai');
  });

  it('keeps subdomains other than www', () => {
    expect(normalizeHostname('https://gemini.google.com/app')).toBe('gemini.google.com');
  });
});

describe('resolveLevel', () => {
  const base: Settings = {
    ...DEFAULT_SETTINGS,
    globalLevel: 'tag',
    siteOverrides: { 'bing.com': 'block' },
  };

  it('uses the global default when no override exists', () => {
    expect(resolveLevel(base, 'example.com')).toEqual({ level: 'tag', source: 'global' });
  });

  it('prefers a per-site override and normalizes the host', () => {
    expect(resolveLevel(base, 'https://www.bing.com/search')).toEqual({
      level: 'block',
      source: 'override',
    });
  });
});

describe('withDefaults', () => {
  it('fills a complete object from undefined', () => {
    const s = withDefaults(undefined);
    expect(s.globalLevel).toBe(DEFAULT_SETTINGS.globalLevel);
    expect(s.verify.model).toBe(DEFAULT_SETTINGS.verify.model);
  });

  it('merges partial verify settings without dropping defaults', () => {
    const s = withDefaults({ verify: { apiKey: 'k' } as Settings['verify'] });
    expect(s.verify.apiKey).toBe('k');
    expect(s.verify.maxSourcesPerCheck).toBe(DEFAULT_SETTINGS.verify.maxSourcesPerCheck);
    expect(s.ui.showBadges).toBe(DEFAULT_SETTINGS.ui.showBadges);
  });
});
