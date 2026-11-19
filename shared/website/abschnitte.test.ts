// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, expect, it } from 'vitest';
import { abschnitt, baustein, gestaltung, kontext, seite, spalte } from './website.testdaten';
import { renderAbschnitt, renderBaustein, renderSeite } from './render';
import type { Abschnitt, Gestaltung } from './modell';

/** Den Abschnitt rendern und das äußerste Element als DOM-Knoten zurückgeben. */
function wurzel(a: Abschnitt, k = kontext()): HTMLElement {
  const doc = new DOMParser().parseFromString(`<body>${renderAbschnitt(a, k)}</body>`, 'text/html');
  return doc.body.firstElementChild as HTMLElement;
}
const mitGestaltung = (g: Partial<Gestaltung>): Abschnitt =>
  abschnitt([baustein('text')], { gestaltung: gestaltung(g) });

describe('Abschnitt: Aufbau und Klassen des Entwurfs', () => {
  it('section.w-abschnitt > div.w-abschnitt-innen.w-spalten.w-spalten--… > div.w-spalte > Baustein', () => {
    const a = abschnitt([baustein('text')], {
      aufteilung: '2-1',
      spalten: [spalte([baustein('text')], { id: 's1' }), spalte([baustein('bild')], { id: 's2' })],
    });
    const el = wurzel(a);
    expect(el.tagName).toBe('SECTION');
    expect(el.classList.contains('w-abschnitt')).toBe(true);
    const innen = el.querySelector(':scope > .w-abschnitt-innen') as HTMLElement;
    expect([...innen.classList]).toEqual(['w-abschnitt-innen', 'w-spalten', 'w-spalten--2-1']);
    const spalten = innen.querySelectorAll(':scope > .w-spalte');
    expect(spalten).toHaveLength(2);
    expect(spalten[0].querySelector(':scope > .w-baustein.w-b-text')).not.toBeNull();
    expect(spalten[1].querySelector(':scope > .w-baustein.w-b-bild')).not.toBeNull();
  });

  it('jede Aufteilung gibt ihre Klasse aus', () => {
    for (const [aufteilung, n] of [
      ['1', 1],
      ['1-1', 2],
      ['2-1', 2],
      ['1-2', 2],
      ['1-1-1', 3],
      ['1-1-1-1', 4],
    ] as const) {
      const a = abschnitt([], {
        aufteilung,
        spalten: Array.from({ length: n }, (_, i) => spalte([], { id: `s${i}` })),
      });
      expect(wurzel(a).querySelector(`.w-spalten--${aufteilung}`), aufteilung).not.toBeNull();
    }
  });

  it('Hintergrund: sanft, haupt, akzent als Klasse – grund ohne', () => {
    for (const art of ['sanft', 'haupt', 'akzent'] as const) {
      const el = wurzel(mitGestaltung({ hintergrund: { art } }));
      expect(el.classList.contains(`w-abschnitt--${art}`), art).toBe(true);
    }
    const grund = wurzel(mitGestaltung({ hintergrund: { art: 'grund' } }));
    expect([...grund.classList].filter((c) => /--(sanft|haupt|akzent|farbe|foto)/.test(c))).toEqual(
      [],
    );
  });

  it('Abstand, Breite, Ausrichtung, Höhe, senkrecht', () => {
    const standard = wurzel(mitGestaltung({}));
    expect([...standard.classList]).toEqual(['w-abschnitt', 'w-abschnitt--text-dunkel']);
    expect(
      wurzel(mitGestaltung({ abstand: 'kein' })).classList.contains('w-abschnitt--abstand-kein'),
    ).toBe(true);
    expect(
      wurzel(mitGestaltung({ abstand: 'klein' })).classList.contains('w-abschnitt--abstand-klein'),
    ).toBe(true);
    expect(
      wurzel(mitGestaltung({ abstand: 'gross' })).classList.contains('w-abschnitt--abstand-gross'),
    ).toBe(true);
    for (const b of ['schmal', 'breit', 'voll'] as const)
      expect(wurzel(mitGestaltung({ breite: b })).classList.contains(`w-abschnitt--${b}`), b).toBe(
        true,
      );
    expect(wurzel(mitGestaltung({ ausrichtung: 'mitte' })).classList.contains('w-zentriert')).toBe(
      true,
    );
    expect(
      wurzel(mitGestaltung({ hoehe: 'halb' })).classList.contains('w-abschnitt--hoehe-halb'),
    ).toBe(true);
    expect(
      wurzel(mitGestaltung({ hoehe: 'voll' })).classList.contains('w-abschnitt--hoehe-voll'),
    ).toBe(true);
    expect(
      wurzel(mitGestaltung({ senkrecht: 'mitte' })).querySelector('.w-spalten--mitte'),
    ).not.toBeNull();
    expect(
      wurzel(mitGestaltung({ senkrecht: 'oben' })).querySelector('.w-spalten--mitte'),
    ).toBeNull();
  });

  it('Anker wird zur id des Abschnitts – ein unzulässiger nicht', () => {
    expect(wurzel(mitGestaltung({ anker: 'termine' })).id).toBe('termine');
    expect(wurzel(mitGestaltung({})).id).toBe('');
    // am Schema vorbei eingeschleust: wird nicht ausgegeben
    for (const boese of ['inhalt', 'w-nav', 'a" onclick="x', 'A B'])
      expect(wurzel(mitGestaltung({ anker: boese })).id, boese).toBe('');
  });

  it('Spalte: eigener Hintergrund und „auf dem Handy zuerst“', () => {
    const a = abschnitt([], {
      aufteilung: '1-1',
      spalten: [
        spalte([baustein('text')], { id: 'l', hintergrund: { art: 'haupt' } }),
        spalte([baustein('bild')], { id: 'r', handyZuerst: true }),
      ],
    });
    const [l, r] = [...wurzel(a).querySelectorAll('.w-spalte')];
    expect(l.classList.contains('w-spalte--haupt')).toBe(true);
    expect(l.classList.contains('w-spalte--text-hell')).toBe(true);
    expect(l.classList.contains('w-spalte--handy-zuerst')).toBe(false);
    expect(r.classList.contains('w-spalte--handy-zuerst')).toBe(true);
    expect([...r.classList].filter((c) => /text-/.test(c))).toEqual([]);
  });

  it('Bild füllt die Spalte: Klasse und volle Breite in sizes', () => {
    const html = renderBaustein({ ...baustein('bild'), fuellen: true }, kontext());
    expect(html).toContain('class="w-bild w-bild--fuellen"');
    expect(html).toContain('sizes="100vw"');
    expect(renderBaustein(baustein('bild'), kontext())).not.toContain('w-bild--fuellen');
  });
});

describe('Text hell/dunkel („auto“)', () => {
  const textKlasse = (g: Partial<Gestaltung>) =>
    [...wurzel(mitGestaltung(g)).classList].filter((c) => /--text-/.test(c));

  it('auto: hell auf haupt, akzent und Bild – dunkel auf grund und sanft', () => {
    expect(textKlasse({ hintergrund: { art: 'haupt' } })).toEqual(['w-abschnitt--text-hell']);
    expect(textKlasse({ hintergrund: { art: 'akzent' } })).toEqual(['w-abschnitt--text-hell']);
    expect(textKlasse({ hintergrund: { art: 'bild', bild: { id: 'b' }, abdunkeln: 40 } })).toEqual([
      'w-abschnitt--text-hell',
    ]);
    expect(textKlasse({ hintergrund: { art: 'grund' } })).toEqual(['w-abschnitt--text-dunkel']);
    expect(textKlasse({ hintergrund: { art: 'sanft' } })).toEqual(['w-abschnitt--text-dunkel']);
  });

  it('auto bei eigener Farbe: nach der Helligkeit', () => {
    for (const dunkel of ['#000', '#000000', '#00616e', '#1a1a1a', '#222'])
      expect(textKlasse({ hintergrund: { art: 'farbe', farbe: dunkel } }), dunkel).toEqual([
        'w-abschnitt--text-hell',
      ]);
    for (const hell of ['#fff', '#ffffff', '#fffcf2', '#ccd7c5', '#ffd700'])
      expect(textKlasse({ hintergrund: { art: 'farbe', farbe: hell } }), hell).toEqual([
        'w-abschnitt--text-dunkel',
      ]);
  });

  it('ausdrücklich hell oder dunkel schlägt „auto“ – auf jedem Hintergrund', () => {
    for (const hintergrund of [
      { art: 'grund' },
      { art: 'haupt' },
      { art: 'farbe', farbe: '#fff' },
    ] as const) {
      expect(textKlasse({ hintergrund, text: 'hell' })).toEqual(['w-abschnitt--text-hell']);
      expect(textKlasse({ hintergrund, text: 'dunkel' })).toEqual(['w-abschnitt--text-dunkel']);
    }
  });

  it('Spalten mit eigenem Hintergrund entscheiden nach IHREM Hintergrund', () => {
    const a = abschnitt([], {
      aufteilung: '1-1-1',
      spalten: [
        spalte([], { id: 's1', hintergrund: { art: 'haupt' } }),
        spalte([], { id: 's2', hintergrund: { art: 'sanft' } }),
        spalte([], { id: 's3', hintergrund: { art: 'farbe', farbe: '#101010' } }),
      ],
    });
    const klassen = [...wurzel(a).querySelectorAll('.w-spalte')].map((s) =>
      [...s.classList].find((c) => /text-/.test(c)),
    );
    expect(klassen).toEqual([
      'w-spalte--text-hell',
      'w-spalte--text-dunkel',
      'w-spalte--text-hell',
    ]);
  });
});

describe('style nur mit eigenen Werten, nur als Variablen', () => {
  it('eigene Farbe: --abschnitt-farbe und --spalte-farbe', () => {
    const a = abschnitt([], {
      aufteilung: '1-1',
      gestaltung: gestaltung({ hintergrund: { art: 'farbe', farbe: '#00616e' } }),
      spalten: [
        spalte([], { id: 's1', hintergrund: { art: 'farbe', farbe: '#abc' } }),
        spalte([], { id: 's2' }),
      ],
    });
    const el = wurzel(a);
    expect(el.classList.contains('w-abschnitt--farbe')).toBe(true);
    expect(el.getAttribute('style')).toBe('--abschnitt-farbe:#00616e');
    const [s1, s2] = [...el.querySelectorAll('.w-spalte')];
    expect(s1.getAttribute('style')).toBe('--spalte-farbe:#abc');
    expect(s2.hasAttribute('style')).toBe(false);
  });

  it('Foto-Hintergrund: Bild als <img>, Abdunkeln als Variable, Bildadresse NICHT im style', () => {
    const a = mitGestaltung({
      hintergrund: { art: 'bild', bild: { id: 'hero', breite: 1600, hoehe: 900 }, abdunkeln: 55 },
    });
    const el = wurzel(a);
    expect(el.classList.contains('w-abschnitt--foto')).toBe(true);
    expect(el.getAttribute('style')).toBe('--abdunkeln:0.55');
    const img = el.querySelector(':scope > img.w-hintergrund') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/bilder/hero-800.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('sizes')).toBe('100vw');
    expect(el.getAttribute('style')).not.toContain('hero');
    expect(
      wurzel(
        mitGestaltung({ hintergrund: { art: 'bild', bild: { id: 'x' }, abdunkeln: 0 } }),
      ).getAttribute('style'),
    ).toBe('--abdunkeln:0');
    expect(
      wurzel(
        mitGestaltung({ hintergrund: { art: 'bild', bild: { id: 'x' }, abdunkeln: 90 } }),
      ).getAttribute('style'),
    ).toBe('--abdunkeln:0.9');
  });

  it('am Schema vorbei eingeschleuste Werte kommen nie in ein style', () => {
    const boeseFarbe = '#fff;}body{background:url(//evil)';
    const a = mitGestaltung({ hintergrund: { art: 'farbe', farbe: boeseFarbe } });
    const el = wurzel(a);
    expect(el.hasAttribute('style')).toBe(false);
    for (const abdunkeln of [999, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const b = wurzel(
        mitGestaltung({ hintergrund: { art: 'bild', bild: { id: 'x' }, abdunkeln } }),
      );
      expect(b.getAttribute('style'), String(abdunkeln)).toMatch(/^--abdunkeln:(0|0\.9)$/);
    }
    const doc = renderSeite(seite({ abschnitte: [a] }), kontext());
    expect(doc).not.toContain('evil');
  });

  it('jedes style der Seite besteht nur aus bekannten Variablen mit Hex oder Zahl', () => {
    const a = abschnitt([], {
      aufteilung: '1-1',
      gestaltung: gestaltung({
        hintergrund: { art: 'bild', bild: { id: 'b' }, abdunkeln: 30 },
      }),
      spalten: [
        spalte([], { id: 's1', hintergrund: { art: 'farbe', farbe: '#a1b2c3' } }),
        spalte([], { id: 's2', hintergrund: { art: 'bild', bild: { id: 'c' }, abdunkeln: 70 } }),
      ],
    });
    const doc = new DOMParser().parseFromString(
      renderSeite(seite({ abschnitte: [a] }), kontext()),
      'text/html',
    );
    const stile = [...doc.querySelectorAll('[style]')].map((e) => e.getAttribute('style'));
    expect(stile).toHaveLength(3);
    for (const st of stile)
      expect(st).toMatch(/^--(?:abschnitt|spalte)-farbe:#[0-9a-f]{3,6}$|^--abdunkeln:0(?:\.\d+)?$/);
  });
});

describe('erstes Bild lädt sofort – auch über Abschnitte und Spalten hinweg', () => {
  it('nur EIN Bild der ganzen Seite ohne loading="lazy"', () => {
    const s = seite({
      abschnitte: [
        abschnitt([baustein('text')], { id: 'a1' }),
        abschnitt([], {
          id: 'a2',
          aufteilung: '1-1',
          spalten: [
            spalte([baustein('bild', { id: 'b1' })], { id: 's1' }),
            spalte([baustein('bild', { id: 'b2' })], { id: 's2' }),
          ],
        }),
        abschnitt([baustein('bild', { id: 'b3' })], {
          id: 'a3',
          spalten: [spalte([baustein('bild', { id: 'b3' })], { id: 's3' })],
        }),
      ],
    });
    const html = renderSeite(s, kontext());
    const bilder = html.match(/<img[^>]*src="\/bilder/g) ?? [];
    expect(bilder).toHaveLength(3);
    expect(html.match(/loading="lazy"/g)).toHaveLength(2);
  });

  it('ein Foto-Hintergrund oben ist das erste Bild', () => {
    const s = seite({
      abschnitte: [
        abschnitt([baustein('bild', { id: 'b1' })], {
          id: 'a1',
          spalten: [spalte([baustein('bild', { id: 'b1' })], { id: 's1' })],
          gestaltung: gestaltung({
            hintergrund: { art: 'bild', bild: { id: 'hero' }, abdunkeln: 50 },
          }),
        }),
      ],
    });
    const html = renderSeite(s, kontext());
    expect(html.match(/<img[^>]*w-hintergrund[^>]*>/)?.[0]).not.toContain('lazy');
    expect(html.match(/loading="lazy"/g)).toHaveLength(1);
  });
});

describe('neue und geänderte Bausteine', () => {
  it('Überschrift: Ebene 1–3, Größe, Punkt in Akzentfarbe', () => {
    const u = (o: object) => renderBaustein({ ...baustein('ueberschrift'), ...o }, kontext());
    expect(u({ ebene: 1 })).toContain('<h1 class="w-ueberschrift">Willkommen</h1>');
    expect(u({ ebene: 3 })).toContain('<h3 class="w-ueberschrift">');
    expect(u({ groesse: 'gross' })).toContain('class="w-ueberschrift w-ueberschrift--gross"');
    expect(u({ groesse: 'riesig' })).toContain('w-ueberschrift--riesig w-schriftzug');
    expect(u({ punkt: true })).toContain('Willkommen<span class="w-punkt">.</span></h2>');
    expect(u({ punkt: false })).not.toContain('w-punkt');
    expect(u({})).not.toContain('w-punkt');
  });

  it('Akzentzeile', () => {
    expect(renderBaustein(baustein('akzentzeile'), kontext())).toBe(
      '<div class="w-baustein w-b-akzentzeile"><span class="w-akzent">Herzlich willkommen!</span></div>',
    );
  });

  it('Eigenes HTML wird UNVERÄNDERT ausgegeben (bewusst – nur für die Leitung)', () => {
    const roh =
      '<script>alert(1)</script><div onclick="x()" style="color:red">"&amp; <b>fett</b></div>';
    const html = renderBaustein({ ...baustein('html'), html: roh }, kontext());
    expect(html).toBe(`<div class="w-baustein w-b-html">${roh}</div>`);
  });
});

describe('Klassennamen kommen nur aus festen Listen (auch am Schema vorbei)', () => {
  it('Aufteilung, Abstand, Breite, Höhe, Überschrift-Ebene, Bild-Seite', () => {
    const BOESE = '"><img src=x onerror=alert(1)>';
    const a = abschnitt([baustein('bildText', { bildSeite: BOESE as never })], {
      aufteilung: BOESE as never,
      gestaltung: gestaltung({
        abstand: BOESE as never,
        breite: BOESE as never,
        hoehe: BOESE as never,
      }),
    });
    const html = renderSeite(seite({ abschnitte: [a] }), kontext());
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror');
    const el = wurzel(a);
    expect(el.querySelector('.w-spalten--1')).not.toBeNull(); // Ersatz: gleichmäßig nach Spaltenzahl
    expect(el.querySelector('.w-bildtext-links')).not.toBeNull();
    const h = renderBaustein(
      { ...baustein('ueberschrift'), ebene: '2><script>x</script>' as never },
      kontext(),
    );
    expect(h).toContain('<h2 class=');
    expect(h).not.toContain('<script');
  });
});
