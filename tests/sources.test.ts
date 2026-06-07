import { describe, it, expect } from 'vitest';
import { htmlToText } from '@/lib/verify/sources';

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
});
