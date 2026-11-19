import { describe, expect, it } from 'vitest';
import { markdownZuHtml } from './markdown';

describe('markdownZuHtml', () => {
  it('Absätze, Zeilenumbruch, fett, kursiv', () => {
    expect(markdownZuHtml('Eins\nzwei\n\nDrei **fett** und *kursiv*')).toBe(
      '<p>Eins<br>zwei</p>\n<p>Drei <strong>fett</strong> und <em>kursiv</em></p>',
    );
  });

  it('Listen und Zwischenüberschrift', () => {
    expect(markdownZuHtml('### Titel\n- a\n- b\n\n1. eins\n2. zwei')).toBe(
      '<h3>Titel</h3>\n<ul><li>a</li><li>b</li></ul>\n<ol><li>eins</li><li>zwei</li></ol>',
    );
  });

  it('ein Malzeichen mit Leerzeichen ist kein Kursiv', () => {
    expect(markdownZuHtml('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
  });

  it('Links: https mit rel, relative Adressen ohne', () => {
    expect(markdownZuHtml('[Hier](https://a.de/x)')).toBe(
      '<p><a href="https://a.de/x" rel="noopener">Hier</a></p>',
    );
    expect(markdownZuHtml('[Intern](/gruppen/)')).toBe('<p><a href="/gruppen/">Intern</a></p>');
    expect(markdownZuHtml('[Mail](mailto:a@b.de)')).toContain('href="mailto:a@b.de"');
  });

  it('gefährliche oder fremde Link-Ziele werden reiner Text, nie ein href', () => {
    for (const ziel of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      '//evil.example/x',
      '/\\evil.example',
      'java%0Ascript:x',
    ]) {
      const html = markdownZuHtml(`[Klick](${ziel})`);
      expect(html, ziel).not.toContain('<a ');
      expect(html, ziel).not.toContain('href');
    }
    expect(markdownZuHtml('[Klick](javascript:alert(1))')).toBe(
      '<p>[Klick](javascript:alert(1))</p>',
    );
  });

  it('rohes HTML wird nie durchgelassen', () => {
    for (const roh of [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '**<b onclick=x>** und *<i>*',
      '- <script>x</script>',
      '### <script>x</script>',
      '[<script>x</script>](https://a.de)',
      '[x](https://a.de/"onmouseover="alert(1))',
      '[x](https://a.de/"onmouseover=alert(1))',
    ]) {
      const html = markdownZuHtml(roh);
      expect(html, roh).not.toMatch(/<(script|img|b|i)\b/);
      expect(html, roh).not.toMatch(/"\s*on\w+=/);
    }
  });

  it('Windows-Zeilenenden und leerer Text', () => {
    expect(markdownZuHtml('a\r\n\r\nb')).toBe('<p>a</p>\n<p>b</p>');
    expect(markdownZuHtml('')).toBe('');
  });
});
