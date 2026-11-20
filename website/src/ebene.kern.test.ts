// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  markdownAusBloecken,
  markdownSichtbarerText,
  markdownZuHtml,
} from '@shared/website/markdown';
import { ladeKern, type Auswahl, type Block, type Kandidat, type Rechteck } from './ebene.testutil';

const K = ladeKern();
const R = (l: number, t: number, r: number, b: number): Rechteck => ({ l, t, r, b });
const KAND = (l: number, t: number, w: number, h: number, sk?: boolean): Kandidat => ({
  l,
  t,
  r: l + w,
  b: t + h,
  sk,
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Kollisionsregel: nie über Text oder einem anderen Bedienelement', () => {
  const TEXT = [R(100, 100, 300, 120)];

  it('der erste Wunschplatz, der nichts berührt', () => {
    const p = K.waehle([KAND(100, 100, 50, 20), KAND(100, 130, 50, 20)], TEXT, [])!;
    expect(p.index).toBe(1); // der erste liegt über der Textzeile
    expect(p.ue).toBe(0);
    expect(p.rect).toEqual(R(100, 130, 150, 150));
  });

  it('ein Wunschplatz, der einen schon belegten Platz berührt, wird übersprungen', () => {
    const p = K.waehle([KAND(10, 10, 50, 20), KAND(200, 10, 50, 20)], [], [R(0, 0, 100, 100)])!;
    expect(p.index).toBe(1);
  });

  it('kein Platz frei: ein Element ohne `pflicht` wird ausgeblendet (null)', () => {
    expect(K.waehle([KAND(100, 100, 50, 20), KAND(120, 105, 50, 10)], TEXT, [])).toBeNull();
  });

  it('kein Platz frei: mit `pflicht` bekommt es den Platz mit der GERINGSTEN Überdeckung (die Leisten erscheinen immer)', () => {
    const p = K.waehle([KAND(100, 100, 100, 20), KAND(250, 100, 100, 20)], TEXT, [], {
      pflicht: true,
    })!;
    expect(p.index).toBe(1);
    expect(p.ue).toBeGreaterThan(0);
  });

  it('außerhalb der Seitenbreite gilt nicht – auch nicht mit `pflicht`, solange ein Platz innen liegt', () => {
    const p = K.waehle(
      [KAND(-20, 10, 50, 20), KAND(990, 10, 50, 20), KAND(500, 10, 50, 20)],
      [],
      [],
      {
        breite: 1000,
        pflicht: true,
      },
    )!;
    expect(p.index).toBe(2);
  });

  it('ein Platz über dem oberen Seitenrand wird nach unten gerückt', () => {
    const p = K.waehle([KAND(10, -30, 50, 20)], [], [])!;
    expect(p.rect.t).toBe(2);
    expect(p.rect.b).toBe(22);
  });

  it('Rangordnung: Baustein-Leiste vor Abschnitt-Leiste vor „+“ vor Abstand-Pille (kleinere Zahl hat Vorrang)', () => {
    expect(K.RANG.blockleiste).toBeLessThan(K.RANG.werk);
    expect(K.RANG.werk).toBeLessThan(K.RANG.einfuegen);
    expect(K.RANG.einfuegen).toBeLessThan(K.RANG.plus);
    expect(K.RANG.plus).toBeLessThan(K.RANG.abstand);
  });

  it('beide wollen denselben Platz: der höhere Rang bekommt ihn, der niedrigere weicht aus', () => {
    const platz = K.ordne(
      [
        {
          name: 'abstand',
          rang: K.RANG.abstand,
          kand: [KAND(100, 100, 80, 20), KAND(100, 200, 80, 20)],
        },
        { name: 'werk', rang: K.RANG.werk, pflicht: true, kand: [KAND(100, 100, 80, 20)] },
      ],
      [],
      1000,
    );
    expect(platz.werk!.index).toBe(0);
    expect(platz.abstand!.index).toBe(1); // wich aus
  });

  it('beide wollen denselben Platz und es gibt keinen anderen: der niedrigere Rang wird ausgeblendet, der höhere bleibt', () => {
    const platz = K.ordne(
      [
        { name: 'plus', rang: K.RANG.plus, kand: [KAND(100, 100, 20, 20)] },
        {
          name: 'blockleiste',
          rang: K.RANG.blockleiste,
          pflicht: true,
          kand: [KAND(100, 100, 60, 20)],
        },
      ],
      [],
      1000,
    );
    expect(platz.blockleiste).not.toBeNull();
    expect(platz.plus).toBeNull();
  });

  it('platzierte Elemente berühren weder Text noch einander (auch mit 3 px Abstand)', () => {
    const hind = [R(0, 100, 500, 140)];
    const platz = K.ordne(
      [
        {
          name: 'blockleiste',
          rang: 1,
          pflicht: true,
          kand: [KAND(10, 90, 60, 20), KAND(10, 150, 60, 20)],
        },
        {
          name: 'werk',
          rang: 2,
          pflicht: true,
          kand: [KAND(10, 150, 120, 20), KAND(10, 190, 120, 20)],
        },
        { name: 'abstand', rang: 6, kand: [KAND(10, 150, 80, 20), KAND(10, 230, 80, 20)] },
      ],
      hind,
      1000,
    );
    const rs = Object.values(platz)
      .filter((p) => p !== null)
      .map((p) => p.rect);
    expect(rs).toHaveLength(3);
    for (const r of rs) expect(K.flaeche(r, hind[0])).toBe(0);
    for (let a = 0; a < rs.length; a++)
      for (let b = a + 1; b < rs.length; b++) {
        expect(K.flaeche(K.aufblasen(rs[a], 3), rs[b]), `${a}/${b}`).toBe(0);
      }
  });

  it('der feste Seitenkopf zählt als schon belegt', () => {
    const platz = K.ordne(
      [{ name: 'werk', rang: 2, kand: [KAND(10, 10, 50, 20), KAND(10, 100, 50, 20)] }],
      [],
      1000,
      [R(0, 0, 1000, 60)],
    );
    expect(platz.werk!.index).toBe(1);
  });
});

// ── Textmodell ──────────────────────────────────────────────────────────────────────────────────────────────

const P = (...laeufe: Block['laeufe']): Block => ({ art: 'p', laeufe });
const A = (b: number, von: number, bis: number, b2 = b): Auswahl => ({
  von: { b, o: von },
  bis: { b: b2, o: bis },
});
const text = (b: Block) => b.laeufe.map((l) => l.t).join('');

describe('Textmodell: Fett, Kursiv, Link ohne execCommand', () => {
  it('Fett setzen und wieder wegnehmen (Umschalten)', () => {
    const r = K.formatUmschalten([P({ t: 'Hallo Welt' })], A(0, 6, 10), 'fett');
    expect(r.bloecke[0].laeufe).toEqual([{ t: 'Hallo ' }, { t: 'Welt', fett: true }]);
    const zurueck = K.formatUmschalten(r.bloecke, A(0, 6, 10), 'fett');
    expect(zurueck.bloecke[0].laeufe).toEqual([{ t: 'Hallo Welt' }]);
  });

  it('Teil eines fetten Stücks: ist alles Markierte fett, wird es weggenommen – sonst gesetzt', () => {
    const b = [P({ t: 'a ' }, { t: 'fett', fett: true })];
    expect(K.formatUmschalten(b, A(0, 0, 6), 'fett').bloecke[0].laeufe).toEqual([
      { t: 'a fett', fett: true },
    ]);
    // nur ein Teil des Markierten ist fett → es wird für alles gesetzt
    expect(K.formatUmschalten(b, A(0, 0, 4), 'fett').bloecke[0].laeufe).toEqual([
      { t: 'a fett', fett: true },
    ]);
    // alles Markierte ist fett → mitten heraus genommen
    expect(K.formatUmschalten(b, A(0, 3, 5), 'fett').bloecke[0].laeufe).toEqual([
      { t: 'a ' },
      { t: 'f', fett: true },
      { t: 'et' },
      { t: 't', fett: true },
    ]);
  });

  it('Kursiv und Fett zugleich; über mehrere Blöcke', () => {
    const r = K.formatUmschalten(
      K.formatUmschalten([P({ t: 'eins' }), P({ t: 'zwei' })], A(0, 0, 4, 1), 'fett').bloecke,
      A(0, 0, 4, 1),
      'kursiv',
    );
    expect(r.bloecke.map((b) => b.laeufe)).toEqual([
      [{ t: 'eins', fett: true, kursiv: true }],
      [{ t: 'zwei', fett: true, kursiv: true }],
    ]);
  });

  it('nur der Cursor, nichts markiert: nichts ändert sich', () => {
    const b = [P({ t: 'Hallo' })];
    expect(K.formatUmschalten(b, A(0, 2, 2), 'fett').bloecke).toEqual(b);
  });

  it('der Text bleibt dabei genau gleich, die Eingabe wird nicht verändert', () => {
    const b = [P({ t: 'Hallo Welt' })];
    const kopie = JSON.stringify(b);
    K.formatUmschalten(b, A(0, 0, 5), 'fett');
    expect(JSON.stringify(b)).toBe(kopie);
  });

  it('Link setzen, entfernen (immer als Ganzes), Zustand für die Leiste', () => {
    const r = K.linkSetzen([P({ t: 'Mehr hier lesen' })], A(0, 5, 9), 'https://a.de');
    expect(r.bloecke[0].laeufe).toEqual([
      { t: 'Mehr ' },
      { t: 'hier', link: 'https://a.de' },
      { t: ' lesen' },
    ]);
    expect(K.formatZustand(r.bloecke, A(0, 6, 6)).link).toBe('https://a.de');
    expect(K.formatZustand(r.bloecke, A(0, 0, 2)).link).toBeNull();
    // Cursor mitten im Link genügt – es fällt der ganze Link weg
    const weg = K.linkEntfernen(r.bloecke, A(0, 6, 6));
    expect(weg.bloecke[0].laeufe).toEqual([{ t: 'Mehr hier lesen' }]);
  });

  it('formatZustand: Fett, Kursiv, Liste, Zwischenüberschrift', () => {
    const b: Block[] = [
      { art: 'h', laeufe: [{ t: 'Titel' }] },
      { art: 'ul', laeufe: [{ t: 'a', fett: true }] },
    ];
    expect(K.formatZustand(b, A(0, 0, 5))).toMatchObject({ ueberschrift: true, liste: false });
    expect(K.formatZustand(b, A(1, 0, 1))).toMatchObject({
      liste: true,
      fett: true,
      kursiv: false,
    });
  });
});

describe('Textmodell: Liste, Zwischenüberschrift, Eingabe, Einfügen', () => {
  it('Liste: Absätze werden Listenpunkte – sind alle schon einer, wieder Absätze', () => {
    const l = K.listeUmschalten([P({ t: 'a' }), P({ t: 'b' }), P({ t: 'c' })], A(0, 0, 1, 1));
    expect(l.bloecke.map((b) => b.art)).toEqual(['ul', 'ul', 'p']);
    expect(K.listeUmschalten(l.bloecke, A(0, 0, 1, 1)).bloecke.map((b) => b.art)).toEqual([
      'p',
      'p',
      'p',
    ]);
  });

  it('Zwischenüberschrift: einzeilig, und zurück zum Absatz', () => {
    const h = K.ueberschriftUmschalten([P({ t: 'a\nb' })], A(0, 0, 1));
    expect(h.bloecke[0]).toEqual({ art: 'h', laeufe: [{ t: 'a b' }] });
    expect(K.ueberschriftUmschalten(h.bloecke, A(0, 0, 1)).bloecke[0].art).toBe('p');
  });

  it('Eingabetaste teilt den Absatz an der Stelle; nach der Überschrift folgt ein Absatz', () => {
    const r = K.teilen([P({ t: 'Hallo Welt' })], A(0, 5, 5));
    expect(r.bloecke.map(text)).toEqual(['Hallo', ' Welt']);
    expect(r.auswahl).toEqual(A(1, 0, 0));
    const h = K.teilen([{ art: 'h', laeufe: [{ t: 'Titel' }] }], A(0, 5, 5));
    expect(h.bloecke.map((b) => b.art)).toEqual(['h', 'p']);
  });

  it('Eingabetaste im Listenpunkt: neuer Punkt; im leeren Punkt: die Liste endet', () => {
    const r = K.teilen([{ art: 'ul', laeufe: [{ t: 'a' }] }], A(0, 1, 1));
    expect(r.bloecke.map((b) => b.art)).toEqual(['ul', 'ul']);
    const ende = K.teilen(r.bloecke, A(1, 0, 0));
    expect(ende.bloecke.map((b) => b.art)).toEqual(['ul', 'p']);
  });

  it('Eingabe mit Markierung ersetzt sie, Blöcke wachsen zusammen', () => {
    const r = K.teilen([P({ t: 'Hallo' }), P({ t: 'Welt' })], A(0, 2, 2, 1));
    expect(r.bloecke.map(text)).toEqual(['Ha', 'lt']);
  });

  it('Umschalt+Eingabe: ein Umbruch im Absatz', () => {
    const r = K.umbruch([P({ t: 'ab' })], A(0, 1, 1));
    expect(r.bloecke[0].laeufe).toEqual([{ t: 'a\nb' }]);
    expect(r.auswahl).toEqual(A(0, 2, 2));
  });

  it('Einfügen ist reiner Text, ersetzt die Markierung und erbt die Auszeichnung vor dem Cursor', () => {
    const b = [P({ t: 'ein ' }, { t: 'fetter', fett: true }, { t: ' Text' })];
    const ersetzt = K.einfuegen(b, A(0, 4, 10), '<b>x</b> & *y*');
    expect(ersetzt.bloecke[0].laeufe).toEqual([{ t: 'ein <b>x</b> & *y* Text' }]);
    expect(ersetzt.auswahl).toEqual(A(0, 18, 18));
    const erbt = K.einfuegen(b, A(0, 10, 10), '<b>x</b>');
    expect(erbt.bloecke[0].laeufe).toEqual([
      { t: 'ein ' },
      { t: 'fetter<b>x</b>', fett: true },
      { t: ' Text' },
    ]);
  });

  it('Einfügen mit Leerzeile: neue Absätze; einfacher Umbruch bleibt Umbruch; Überschrift bleibt eine Zeile', () => {
    const r = K.einfuegen([P({ t: 'ab' })], A(0, 1, 1), 'X\nY\n\nZ');
    expect(r.bloecke.map(text)).toEqual(['aX\nY', 'Zb']);
    const h = K.einfuegen([{ art: 'h', laeufe: [{ t: 'ab' }] }], A(0, 1, 1), 'X\n\nY');
    expect(h.bloecke.map(text)).toEqual(['aX Yb']);
  });

  it('für das Speichern: leere Blöcke weg, Umbrüche am Rand weg, Läufe zusammen', () => {
    const r = K.fuerSpeichern([
      P({ t: '\nHallo' }, { t: ' Welt\n' }),
      P(),
      { art: 'ul', laeufe: [{ t: ' ' }] },
      { art: 'ul', laeufe: [{ t: 'Punkt' }] },
    ]);
    expect(r).toEqual([P({ t: 'Hallo Welt' }), { art: 'ul', laeufe: [{ t: 'Punkt' }] }]);
  });
});

// ── DOM ⇄ Modell ───────────────────────────────────────────────────────────────────────────────────────────────

const wurzel = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
};

describe('DOM lesen und zeichnen – Hin und Rück mit dem echten Markdown', () => {
  const FAELLE = [
    'Ein einfacher Absatz.',
    'Eins\nzwei\n\nDrei **fett** und *kursiv* und ***beides***',
    '### Titel\nText mit [Link](https://a.de/x) und [Intern](/gruppen/)',
    '- a\n- b **fett**\n\n1. eins\n2. zwei',
    'Zeichen: \\*Stern\\* und \\[eckig\\] und 2 * 3 und C:\\\\temp',
    '\\- kein Punkt\n\n1\\. keine Nummer\n\n\\### kein Titel',
    '[**fetter** Link](https://a.de/(x))',
  ];

  it.each(FAELLE)('Markdown → HTML → Modell → Markdown → HTML ist dasselbe: %j', (md) => {
    const html = markdownZuHtml(md);
    const el = wurzel(html);
    const modell = K.lesen(el, null).bloecke;
    const md2 = markdownAusBloecken(K.fuerSpeichern(modell));
    expect(markdownZuHtml(md2)).toBe(html);
    // auch über das Zeichnen des Modells ins DOM
    const el2 = wurzel('');
    K.rendern(el2, modell);
    expect(markdownZuHtml(markdownAusBloecken(K.fuerSpeichern(K.lesen(el2, null).bloecke)))).toBe(
      html,
    );
  });

  it('liest, was ein Browser beim Tippen daraus macht: div statt p, b/i, Stil-span, Umbruch am Ende, geschachtelte Blöcke', () => {
    const el = wurzel(
      '<div>Eins <b>fett</b> <i>kursiv</i><br></div>' +
        '<div><span style="font-weight: 700">stark</span> und <span style="font-weight: 400">normal</span></div>' +
        '<p><ul><li>a</li><li>b</li></ul></p>' +
        '<h1>Titel</h1>loser Text',
    );
    const bloecke = K.fuerSpeichern(K.lesen(el, null).bloecke); // (leere Absätze fallen weg)
    expect(bloecke.map((b) => [b.art, text(b)])).toEqual([
      ['p', 'Eins fett kursiv'],
      ['p', 'stark und normal'],
      ['ul', 'a'],
      ['ul', 'b'],
      ['h', 'Titel'],
      ['p', 'loser Text'],
    ]);
    expect(bloecke[0].laeufe[1]).toEqual({ t: 'fett', fett: true });
    expect(bloecke[1].laeufe[0]).toEqual({ t: 'stark', fett: true });
    expect(bloecke[1].laeufe[1]).toEqual({ t: ' und normal' });
  });

  it('ein Zeilenumbruch mitten im Absatz bleibt, der Platzhalter-Umbruch am Ende nicht', () => {
    const el = wurzel('<p>Zeile eins<br>Zeile zwei<br></p><p><br></p>');
    const { bloecke } = K.lesen(el, null);
    expect(text(bloecke[0])).toBe('Zeile eins\nZeile zwei');
    expect(bloecke[1].laeufe).toEqual([]);
  });

  it('die Auswahl wird in Modellstellen übersetzt – und wieder zurück', () => {
    const el = wurzel('<p>Hallo <strong>fette</strong> Welt</p><ul><li>Punkt</li></ul>');
    const s = getSelection()!;
    const text1 = el.querySelector('strong')!.firstChild!;
    const text2 = el.querySelector('li')!.firstChild!;
    const r = document.createRange();
    r.setStart(text1, 2);
    r.setEnd(text2, 3);
    s.removeAllRanges();
    s.addRange(r);
    const gelesen = K.lesen(el, s);
    expect(gelesen.auswahl).toEqual(A(0, 8, 3, 1));
    // zeichnen und zurückstellen
    K.rendern(el, gelesen.bloecke);
    K.auswahlSetzen(el, gelesen.auswahl!);
    expect(K.lesen(el, getSelection()).auswahl).toEqual(A(0, 8, 3, 1));
    expect(getSelection()!.toString()).toBe('tte WeltPun');
  });

  it('die Auswahl in einem leeren Absatz und nach einem Umbruch', () => {
    const el = wurzel('');
    K.rendern(el, [P({ t: 'a\nb' }), P()]);
    K.auswahlSetzen(el, A(0, 2, 2));
    expect(K.lesen(el, getSelection()).auswahl).toEqual(A(0, 2, 2));
    K.auswahlSetzen(el, A(1, 0, 0));
    expect(K.lesen(el, getSelection()).auswahl).toEqual(A(1, 0, 0));
  });

  it('Alles markieren (Auswahl am Behälter selbst) reicht vom Anfang bis zum Ende', () => {
    const el = wurzel('<p>eins</p><p>zwei</p>');
    const r = document.createRange();
    r.setStart(el, 0);
    r.setEnd(el, el.childNodes.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
    expect(K.lesen(el, getSelection()).auswahl).toEqual(A(0, 0, 4, 1));
  });

  it('ein leerer Behälter gibt EINEN leeren Absatz, damit man hineintippen kann', () => {
    const el = wurzel('');
    const { bloecke } = K.lesen(el, null);
    expect(bloecke).toEqual([P()]);
    K.rendern(el, bloecke);
    expect(el.innerHTML).toBe('<p><br></p>');
  });

  it('Gerendertes enthält nie etwas anderes als p, h3, ul/ol, li, strong, em, a, br – und der Text bleibt Text', () => {
    const el = wurzel('');
    K.rendern(el, [
      { art: 'h', laeufe: [{ t: '<img src=x onerror=alert(1)>' }] },
      P({
        t: '"><script>alert(1)</script>',
        fett: true,
        kursiv: true,
        link: 'https://a.de/?a=1&b="2"',
      }),
    ]);
    expect(el.querySelector('img, script')).toBeNull();
    expect(el.querySelector('h3')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(el.querySelector('p > a > strong > em')!.textContent).toBe(
      '"><script>alert(1)</script>',
    );
    expect(el.querySelector('a')!.getAttribute('href')).toBe('https://a.de/?a=1&b="2"');
  });

  it('Eingefügtes (reiner Text) kommt als Text an, nie als Markup, und verträgt sich mit dem Rückweg', () => {
    const r = K.einfuegen([P()], A(0, 0, 0), '<b>fett?</b> *nein* [x](y)');
    const md = markdownAusBloecken(K.fuerSpeichern(r.bloecke));
    expect(markdownSichtbarerText(md)).toBe('<b>fett?</b> *nein* [x](y)');
  });
});
