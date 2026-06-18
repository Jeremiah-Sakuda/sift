import { describe, it, expect } from 'vitest';
import { htmlToText, isolateMainContent } from '@/lib/verify/sources';

describe('htmlToText', () => {
  it('strips scripts and styles entirely', () => {
    const html = `<html><head><style>.x{color:red}</style></head>
      <body><script>alert('hi')</script><p>Hello world</p></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Hello world');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });

  it('removes tags and decodes entities', () => {
    const text = htmlToText('<p>Tom &amp; Jerry &lt;3 &#39;quotes&#39;</p>');
    expect(text).toBe("Tom & Jerry <3 'quotes'");
  });

  it('inserts breaks for block elements', () => {
    const text = htmlToText('<li>one</li><li>two</li>');
    expect(text).toBe('one\ntwo');
  });

  it('drops nav/footer chrome and keeps article body', () => {
    const html = `
      <body>
        <nav><a href="/">Home</a> Cookie consent please accept</nav>
        <main><p>The treaty was signed in 1648.</p></main>
        <footer>Copyright 2026 subscribe to our newsletter</footer>
      </body>`;
    const text = htmlToText(html);
    expect(text).toContain('treaty was signed in 1648');
    expect(text).not.toContain('Cookie consent');
    expect(text).not.toContain('newsletter');
  });
});

describe('isolateMainContent', () => {
  it('returns the <main> region when present and substantial', () => {
    const body = 'X'.repeat(300);
    const html = `<div>boilerplate</div><main><p>${body}</p></main><div>more boilerplate</div>`;
    expect(isolateMainContent(html)).toContain(body);
    expect(isolateMainContent(html)).not.toContain('boilerplate');
  });

  it('falls back to the whole document when there is no marked main content', () => {
    const html = '<div><p>just a div with some text content here</p></div>';
    expect(isolateMainContent(html)).toBe(html);
  });
});
