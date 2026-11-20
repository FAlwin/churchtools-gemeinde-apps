import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  formatierungEindeutig,
  istLinkAdresse,
  markdownAusBloecken,
  markdownSichtbarerText,
  markdownZuHtml,
  type TextBlock,
} from './markdown';

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

describe('Escape: ein Backslash macht das Zeichen zum Zeichen (W3c-1)', () => {
  it.each([
    ['\\*', '*'],
    ['\\_', '_'],
    ['\\[', '['],
    ['\\]', ']'],
    ['\\(', '('],
    ['\\)', ')'],
    ['\\\\', '\\'],
    ['\\#', '#'],
  ])('%s erscheint als %s', (roh, zeichen) => {
    expect(markdownZuHtml(`a ${roh} b`)).toBe(`<p>a ${zeichen} b</p>`);
  });

  it('maskierte Sterne sind kein Fett und kein Kursiv', () => {
    expect(markdownZuHtml('\\*a\\* und \\*\\*b\\*\\*')).toBe('<p>*a* und **b**</p>');
    // …auch mitten in echtem Fett
    expect(markdownZuHtml('**a \\* b**')).toBe('<p><strong>a * b</strong></p>');
  });

  it('maskierte Klammern bilden keinen Link', () => {
    expect(markdownZuHtml('\\[Text](https://a.de)')).toBe('<p>[Text](https://a.de)</p>');
    expect(markdownZuHtml('[Text\\]](https://a.de)')).toBe(
      '<p><a href="https://a.de" rel="noopener">Text]</a></p>',
    );
    // eine Klammer in der Adresse
    expect(markdownZuHtml('[W](https://de.wikipedia.org/wiki/A_\\(B\\))')).toBe(
      '<p><a href="https://de.wikipedia.org/wiki/A_(B)" rel="noopener">W</a></p>',
    );
  });

  it('am Zeilenanfang: `\\-`, `1\\.` und `\\###` sind Text, keine Liste und keine Überschrift', () => {
    expect(markdownZuHtml('\\- kein Punkt')).toBe('<p>- kein Punkt</p>');
    expect(markdownZuHtml('1\\. kein Punkt')).toBe('<p>1. kein Punkt</p>');
    expect(markdownZuHtml('\\### kein Titel')).toBe('<p>### kein Titel</p>');
    // in der zweiten Zeile eines Absatzes genauso
    expect(markdownZuHtml('Text\n\\- kein Punkt')).toBe('<p>Text<br>- kein Punkt</p>');
    // Listenpunkt und Zwischenüberschrift: am Anfang ihres Textes genauso
    expect(markdownZuHtml('- \\- Strich')).toBe('<ul><li>- Strich</li></ul>');
    expect(markdownZuHtml('### \\- Strich')).toBe('<h3>- Strich</h3>');
    // …aber nur dort: mitten in der Zeile bleibt `\-` wie es steht
    expect(markdownZuHtml('a \\- b')).toBe('<p>a \\- b</p>');
  });

  it('ein Backslash vor jedem anderen Zeichen bleibt, wie er ist (alte Texte)', () => {
    expect(markdownZuHtml('C:\\temp\\neu \\x')).toBe('<p>C:\\temp\\neu \\x</p>');
  });

  it('Fett UND kursiv in einem Stück (`***`)', () => {
    expect(markdownZuHtml('***beides***')).toBe('<p><strong><em>beides</em></strong></p>');
    expect(markdownZuHtml('**fett** und *kursiv*')).toBe(
      '<p><strong>fett</strong> und <em>kursiv</em></p>',
    );
  });

  it('vorhandene Texte (Vorlagen, Testdaten, bisherige Fälle) rendern unverändert – Vergleich mit dem Stand VOR dem Escape', () => {
    const golden = JSON.parse(
      readFileSync(new URL('./markdown.golden.json', import.meta.url), 'utf8'),
    ) as [string, string][];
    expect(golden.length).toBeGreaterThan(20);
    for (const [eingabe, html] of golden) expect(markdownZuHtml(eingabe), eingabe).toBe(html);
  });
});

describe('Rückweg: getippter Text → Markdown → HTML zeigt exakt den getippten Text', () => {
  const absatz = (t: string): TextBlock[] => [{ art: 'p', laeufe: [{ t }] }];
  const TEXTE = [
    'Ganz normaler Text.',
    '*',
    '**',
    '***',
    '* Stern mit Leerzeichen',
    '2 * 3 = 6 und 4*5',
    '_unterstrich_ und snake_case',
    '[Text](https://a.de)',
    '[x]',
    'a ] b [ c',
    'f(x) = (a + b)',
    '\\',
    'C:\\temp\\neu',
    'a\\*b',
    '\\*schon maskiert\\*',
    '# kein Titel',
    '### kein Titel',
    '- kein Punkt',
    '-kein Punkt',
    '1. kein Punkt',
    '12. kein Punkt',
    '1.5 Prozent',
    '<b>kein HTML</b> & Co',
    'Fett **sieht aus** wie fett',
    '`code` ~~x~~ > zitat',
    '\ue000\ue001 Privatzeichen',
  ];

  it.each(TEXTE)('Absatz: %j', (t) => {
    const md = markdownAusBloecken(absatz(t));
    expect(markdownSichtbarerText(md)).toBe(t);
  });

  it.each(TEXTE)('Listenpunkt und Zwischenüberschrift: %j', (t) => {
    for (const art of ['ul', 'ol', 'h'] as const) {
      const md = markdownAusBloecken([{ art, laeufe: [{ t }] }]);
      expect(markdownSichtbarerText(md), `${art}: ${md}`).toBe(t);
    }
  });

  it('jedes Zeichen einzeln (Escape-Zeichen mitten im Wort, am Anfang und am Ende)', () => {
    for (const z of ['\\', '*', '_', '[', ']', '(', ')', '#', '-', '.', '1']) {
      for (const t of [`a${z}b`, `${z}ab`, `ab${z}`, `${z}${z}`, `${z} x`, `x ${z}`, `${z}x${z}`]) {
        const md = markdownAusBloecken(absatz(t));
        expect(markdownSichtbarerText(md), `${t} → ${md}`).toBe(t.trim());
      }
    }
  });

  it('Auszeichnung: fett, kursiv, beides, Link – Leerzeichen am Rand stehen draußen', () => {
    const md = markdownAusBloecken([
      {
        art: 'p',
        laeufe: [
          { t: 'Das ist ' },
          { t: ' fett ', fett: true },
          { t: 'und ' },
          { t: 'kursiv', kursiv: true },
          { t: ' sowie ' },
          { t: 'beides', fett: true, kursiv: true },
          { t: ' und ein ' },
          { t: 'Link', link: 'https://a.de/x' },
          { t: '.' },
        ],
      },
    ]);
    expect(md).toBe(
      'Das ist  **fett** und *kursiv* sowie ***beides*** und ein [Link](https://a.de/x).',
    );
    expect(markdownZuHtml(md)).toBe(
      '<p>Das ist  <strong>fett</strong> und <em>kursiv</em> sowie <strong><em>beides</em></strong> und ein <a href="https://a.de/x" rel="noopener">Link</a>.</p>',
    );
  });

  it('ein Sternchen im fetten Stück bleibt Text; ein Link mit Klammern und fettem Teil', () => {
    const md = markdownAusBloecken([
      {
        art: 'p',
        laeufe: [
          { t: 'a*b', fett: true },
          { t: ' ' },
          { t: 'Wiki', link: 'https://de.wikipedia.org/wiki/A_(B)' },
          { t: ' [x]', link: 'https://de.wikipedia.org/wiki/A_(B)', fett: true },
        ],
      },
    ]);
    expect(markdownSichtbarerText(md)).toBe('a*b Wiki [x]');
    expect(markdownZuHtml(md)).toContain('href="https://de.wikipedia.org/wiki/A_(B)"');
    expect(markdownZuHtml(md)).toContain('<strong>a*b</strong>');
  });

  it('Absätze, Zeilenumbruch, Listen, Zwischenüberschrift', () => {
    const md = markdownAusBloecken([
      { art: 'h', laeufe: [{ t: 'Titel' }] },
      { art: 'p', laeufe: [{ t: 'Eins\nzwei' }] },
      { art: 'p', laeufe: [{ t: 'Drei' }] },
      { art: 'ul', laeufe: [{ t: 'a' }] },
      { art: 'ul', laeufe: [{ t: 'b' }] },
      { art: 'ol', laeufe: [{ t: 'x' }] },
      { art: 'p', laeufe: [] }, // leer: entfällt
      { art: 'p', laeufe: [{ t: 'Ende' }] },
    ]);
    expect(md).toBe('### Titel\n\nEins\nzwei\n\nDrei\n\n- a\n- b\n\n1. x\n\nEnde');
    expect(markdownZuHtml(md)).toBe(
      '<h3>Titel</h3>\n<p>Eins<br>zwei</p>\n<p>Drei</p>\n<ul><li>a</li><li>b</li></ul>\n<ol><li>x</li></ol>\n<p>Ende</p>',
    );
  });

  it('eine leere Zeile im Absatz trennt Absätze; ein Umbruch im Listenpunkt wird ein Leerzeichen', () => {
    expect(markdownAusBloecken(absatz('a\n\nb'))).toBe('a\n\nb');
    expect(markdownAusBloecken([{ art: 'ul', laeufe: [{ t: 'a\nb' }] }])).toBe('- a b');
  });

  it('istLinkAdresse: dieselbe Regel wie beim Rendern', () => {
    for (const ok of ['https://a.de', 'http://a.de/x', 'mailto:a@b.de', 'tel:+4912', '/seite/'])
      expect(istLinkAdresse(ok), ok).toBe(true);
    for (const nein of ['javascript:x', '//evil.de', 'a b', '', 'data:text/html,x', '/\\x'])
      expect(istLinkAdresse(nein), nein).toBe(false);
  });

  it('formatierungEindeutig: ausgezeichnete Stücke ohne Leerzeichen dazwischen sind unklar – mit Leerzeichen oder Link nicht', () => {
    const lauf = (t: string, o: object = {}) => ({ t, ...o });
    const ok = (laeufe: TextBlock['laeufe']) => formatierungEindeutig([{ art: 'p', laeufe }]);
    expect(ok([lauf('a', { kursiv: true }), lauf('b', { fett: true })])).toBe(false);
    expect(ok([lauf('a', { fett: true }), lauf('b', { fett: true, kursiv: true })])).toBe(false);
    expect(ok([lauf('a', { kursiv: true }), lauf(' b', { fett: true })])).toBe(true);
    expect(ok([lauf('a ', { kursiv: true }), lauf('b', { fett: true })])).toBe(true);
    expect(ok([lauf('a', { kursiv: true }), lauf('x'), lauf('b', { fett: true })])).toBe(true);
    expect(
      ok([lauf('a', { kursiv: true, link: '/a' }), lauf('b', { fett: true, link: '/b' })]),
    ).toBe(true);
    // Zeilenumbruch trennt
    expect(ok([lauf('a\n', { kursiv: true }), lauf('b', { fett: true })])).toBe(true);
    // und was als „unklar“ gilt, ist es wirklich: ohne die Probe stimmte das Ergebnis nicht
    const md = markdownAusBloecken([
      { art: 'p', laeufe: [lauf('a', { kursiv: true }), lauf('b', { fett: true })] },
    ]);
    expect(markdownZuHtml(md)).not.toBe('<p><em>a</em><strong>b</strong></p>');
  });
});
