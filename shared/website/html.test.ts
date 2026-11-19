import { describe, expect, it } from 'vitest';
import { htmlAttr, htmlText } from './html';

describe('html', () => {
  it('schützt im Text & < >, lässt Anführungszeichen stehen', () => {
    expect(htmlText(`<a href="x">&</a> 'y'`)).toBe(`&lt;a href="x"&gt;&amp;&lt;/a&gt; 'y'`);
  });

  it('schützt im Attribut zusätzlich beide Anführungszeichen', () => {
    expect(htmlAttr(`" onerror='x' <>&`)).toBe('&quot; onerror=&#39;x&#39; &lt;&gt;&amp;');
  });
});
