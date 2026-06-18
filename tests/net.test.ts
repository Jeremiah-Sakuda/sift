import { describe, it, expect } from 'vitest';
import { isBlockedHost, isPublicHttpUrl } from '@/lib/net';

describe('isBlockedHost', () => {
  it('blocks loopback and localhost names', () => {
    expect(isBlockedHost('localhost')).toBe(true);
    expect(isBlockedHost('app.localhost')).toBe(true);
    expect(isBlockedHost('127.0.0.1')).toBe(true);
    expect(isBlockedHost('127.5.5.5')).toBe(true);
    expect(isBlockedHost('::1')).toBe(true);
  });

  it('blocks link-local incl. the cloud metadata IP', () => {
    expect(isBlockedHost('169.254.169.254')).toBe(true);
    expect(isBlockedHost('fe80::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 in both dotted and hex (URL-parser) forms', () => {
    expect(isBlockedHost('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedHost('[::ffff:169.254.169.254]')).toBe(true);
    // The forms the WHATWG URL parser actually yields:
    expect(isBlockedHost('::ffff:a9fe:a9fe')).toBe(true); // 169.254.169.254
    expect(isBlockedHost('::ffff:7f00:1')).toBe(true); // 127.0.0.1
    expect(isBlockedHost('::ffff:a00:1')).toBe(true); // 10.0.0.1
    // A mapped *public* IPv4 stays allowed (8.8.8.8 => ::ffff:808:808).
    expect(isBlockedHost('::ffff:808:808')).toBe(false);
  });

  it('blocks the metadata endpoint through a real parsed URL (regression)', () => {
    expect(isPublicHttpUrl(new URL('http://[::ffff:169.254.169.254]/latest/meta-data'))).toBe(false);
    expect(isPublicHttpUrl(new URL('http://[::ffff:127.0.0.1]/'))).toBe(false);
  });

  it('blocks RFC-1918 private ranges', () => {
    expect(isBlockedHost('10.0.0.1')).toBe(true);
    expect(isBlockedHost('172.16.0.1')).toBe(true);
    expect(isBlockedHost('172.31.255.255')).toBe(true);
    expect(isBlockedHost('192.168.1.1')).toBe(true);
    expect(isBlockedHost('fd00::1')).toBe(true);
  });

  it('blocks internal-looking name suffixes', () => {
    expect(isBlockedHost('printer.local')).toBe(true);
    expect(isBlockedHost('db.internal')).toBe(true);
    expect(isBlockedHost('host.home.arpa')).toBe(true);
  });

  it('allows ordinary public hosts and public IPs', () => {
    expect(isBlockedHost('example.com')).toBe(false);
    expect(isBlockedHost('en.wikipedia.org')).toBe(false);
    expect(isBlockedHost('8.8.8.8')).toBe(false);
    expect(isBlockedHost('172.15.0.1')).toBe(false); // just outside 172.16/12
    expect(isBlockedHost('172.32.0.1')).toBe(false);
  });
});

describe('isPublicHttpUrl', () => {
  it('requires http(s) and a public host', () => {
    expect(isPublicHttpUrl(new URL('https://example.com/a'))).toBe(true);
    expect(isPublicHttpUrl(new URL('http://example.com'))).toBe(true);
    expect(isPublicHttpUrl(new URL('https://169.254.169.254/latest/meta-data'))).toBe(false);
    expect(isPublicHttpUrl(new URL('http://localhost:8080/admin'))).toBe(false);
    expect(isPublicHttpUrl(new URL('ftp://example.com'))).toBe(false);
    expect(isPublicHttpUrl(new URL('file:///etc/passwd'))).toBe(false);
  });
});
