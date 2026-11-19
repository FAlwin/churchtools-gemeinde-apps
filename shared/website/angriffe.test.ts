// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, it, expect } from 'vitest';
import { renderSeite } from './render';
import {
  BEISPIELE,
  abschnitt,
  einstellungen,
  gestaltung,
  kontext,
  seite,
  seiteMit,
  spalte,
  ECG_FARBEN,
} from './website.testdaten';
import { markdownZuHtml } from './markdown';
import { seiteAlsText, seiteAusText, type Abschnitt, type Baustein } from './modell';
import { VORLAGEN } from './vorlagen';

const BOESE = `"><img src=x onerror=alert(1)>'<script>alert(2)</script>`;
function boesartig(x: unknown): unknown {
  if (typeof x === 'string') return x + BOESE;
  if (Array.isArray(x)) return x.map(boesartig);
  if (x && typeof x === 'object')
    return Object.fromEntries(
      Object.entries(x).map(([k, v]) => [
        k,
        // nur die Unterscheidungsmerkmale bleiben heil, sonst fände der Renderer den Baustein nicht
        k === 'typ' || k === 'art' || k === 'zeigen' ? v : boesartig(v),
      ]),
    );
  return x;
}
/** Alle Bausteine – außer „Eigenes HTML“: das ist bewusst ungeschützt (E-W12) und hat unten seinen eigenen Test. */
const geschuetzteBausteine = (): Baustein[] =>
  Object.entries(BEISPIELE)
    .filter(([typ]) => typ !== 'html')
    .map(([, f], i) => boesartig(f('b' + i)) as Baustein);

describe('Angriffe über Daten (unabhängige Gegenprüfung zu den Einzeltests)', () => {
  it('kein Tag/Attribut aus Daten in irgendeinem Baustein', () => {
    const bs = geschuetzteBausteine();
    const html = renderSeite(
      seiteMit(bs, { titel: 'T' + BOESE }),
      kontext({ einstellungen: einstellungen({ name: 'G' + BOESE }) }),
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // das eine erlaubte Skript ist der Verweis des Kontexts (mit `src`), kein Inline-Skript
    expect(doc.querySelectorAll('script:not([src])').length).toBe(0);
    expect(doc.querySelectorAll('script').length).toBe(1);
    expect(doc.querySelectorAll('iframe').length).toBe(0);
    expect(doc.querySelectorAll('[onerror]').length).toBe(0);
    for (const a of doc.querySelectorAll('[href]'))
      expect(a.getAttribute('href')).not.toMatch(/^\s*javascript/i);
  });
  it('dynamische Daten', () => {
    const bs = Object.entries(BEISPIELE)
      .filter(([typ]) => typ !== 'html')
      .map(([, f], i) => f('b' + i));
    const html = renderSeite(
      seiteMit(bs),
      kontext({
        bildAdresse: () => 'x' + BOESE,
        beitraege: [
          boesartig({
            id: '1',
            titel: 't',
            text: 'x',
            datum: '2026-07-01T10:00:00Z',
            bild: { id: 'b' },
          }) as never,
        ],
        termine: [
          {
            ...(boesartig({ titel: 't', ort: 'o' }) as object),
            beginn: '2026-07-01T10:00:00Z',
            ende: '2026-07-01T11:00:00Z',
            ganztaegig: false,
            kalenderId: 2,
          } as never,
        ],
        sliderFolien: [
          {
            bild: { id: 'b' },
            alt: 'a' + BOESE,
            link: { art: 'extern', url: 'javascript:alert(1)' },
          } as never,
        ],
        livestream: {
          aktuell: {
            id: '1',
            titel: 'v' + BOESE,
            datum: '2026-07-01T10:00:00Z',
            adresse: 'javascript:alert(1)',
            vorschaubild: { id: 'b' },
            youtubeId: 'dQw4w9WgXcQ"><script>alert(1)</script>',
          },
          archiv: [
            {
              id: '2',
              titel: 'a',
              datum: '2026-07-01T10:00:00Z',
              youtubeId: '"><img src=x onerror=alert(1)>',
            },
          ],
        },
        gruppen: [boesartig({ id: 1, name: 'g', beschreibung: 'b', gruppentypId: 1 }) as never],
      }),
    );
    expect(html).toContain('&lt;script&gt;');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script:not([src]),iframe').length).toBe(0);
    expect(doc.querySelectorAll('[data-youtube]').length).toBe(0); // ungültige Kennungen → keine Sperre
    expect(doc.querySelectorAll('[onerror]').length).toBe(0);
    for (const a of doc.querySelectorAll('[href]'))
      expect(a.getAttribute('href')).not.toMatch(/^\s*javascript/i);
  });
  it('markdown-Fallen', () => {
    for (const m of [
      '[x](javascript:alert(1))',
      '[x](JaVaScRiPt:alert(1))',
      '[x](//evil.com)',
      '[x](/\\evil.com)',
      '[x](data:text/html,hi)',
      '**<b>**',
      '[**x](https://a.de)**',
    ]) {
      const d = new DOMParser().parseFromString(markdownZuHtml(m), 'text/html');
      for (const a of d.querySelectorAll('a'))
        expect(a.getAttribute('href')).toMatch(/^(https:|\/[^/\\])/);
      expect(d.querySelectorAll('b,script').length).toBe(0);
    }
  });
  it('rundreise', () => {
    const s = seiteMit(Object.values(BEISPIELE).map((f, i) => f('b' + i)));
    const r = seiteAusText(seiteAlsText(s));
    expect(r.ok && r.wert).toEqual(s);
  });
});

describe('Angriffe über Abschnitte, Spalten und Gestaltung (am Schema vorbei)', () => {
  /** Ein Abschnitt, in dem jedes Feld, das ausgegeben wird, Schadcode trägt. */
  function boeserAbschnitt(): Abschnitt {
    return abschnitt([], {
      id: 'a' + BOESE,
      vorlage: 'v' + BOESE,
      aufteilung: '1-1',
      gestaltung: gestaltung({
        hintergrund: { art: 'farbe', farbe: '#fff;}</style><script>alert(1)</script>' + BOESE },
        anker: 'anker' + BOESE,
      }),
      spalten: [
        spalte(geschuetzteBausteine(), {
          id: 's1' + BOESE,
          hintergrund: { art: 'farbe', farbe: '"onload="alert(1)' + BOESE },
        }),
        spalte([], {
          id: 's2' + BOESE,
          hintergrund: { art: 'bild', bild: { id: BOESE }, abdunkeln: Number.NaN },
        }),
      ],
    });
  }

  it('Schadcode in jedem Feld eines Abschnitts: kein Tag, kein Attribut, kein style außer unseren Variablen', () => {
    const k = kontext({ bildAdresse: (b, breite) => `/x/${b.id}-${breite}.jpg` });
    const html = renderSeite(seite({ abschnitte: [boeserAbschnitt()] }), k);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script:not([src])').length).toBe(0);
    expect(doc.querySelectorAll('iframe').length).toBe(0);
    expect(doc.querySelectorAll('[onerror],[onload],[onclick]').length).toBe(0);
    expect(doc.head.querySelectorAll('style')).toHaveLength(1);
    for (const e of doc.querySelectorAll('[style]'))
      expect(e.getAttribute('style'), 'style').toMatch(/^--abdunkeln:0(?:\.\d+)?$/);
    // der unzulässige Anker wird nicht zur id
    expect(doc.querySelector('section.w-abschnitt')?.id).toBe('');
    // die `vorlage` ist nur Information und wird nie ausgegeben
    expect(html).not.toContain('vorlage');
  });

  it('jede Vorlage, an jeder Stelle mit Schadcode angereichert, bleibt dicht', () => {
    let n = 0;
    for (const v of VORLAGEN.filter((v) => v.name !== 'html')) {
      const a = boesartig(v.erzeugen(() => 'id' + ++n)) as Abschnitt;
      const html = renderSeite(
        seite({ abschnitte: [a] }),
        kontext({ bildAdresse: (b, breite) => `/x/${b.id}-${breite}.jpg` }),
      );
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelectorAll('script:not([src])').length, v.name).toBe(0);
      expect(doc.querySelectorAll('[onerror]').length, v.name).toBe(0);
    }
  });

  it('Einstellungen mit Schadcode: Farben, Schriften, Banner-Text und Datenschutz-Link', () => {
    const e = einstellungen({
      name: 'G' + BOESE,
      farben: {
        ...ECG_FARBEN,
        haupt: 'red;}</style><script>alert(1)</script>',
        akzent: '"><script>x</script>',
      },
      schriften: {
        text: { art: 'eigene', name: 'x;}</style><script>alert(1)</script>', datei: 'f' + BOESE },
        ueberschrift: { art: 'eigene', name: 'Gut', datei: '"><script>alert(2)</script>' },
        akzent: { art: 'auswahl', name: BOESE },
      },
      einwilligung: { youtubeText: BOESE },
      datenschutz: { art: 'extern', url: 'javascript:alert(1)' },
    });
    const k = kontext({
      einstellungen: e,
      schriftAdresse: (d) => '/s/' + d,
      livestream: {
        aktuell: { id: '1', titel: 'x', datum: '2026-07-01T10:00:00Z', youtubeId: 'dQw4w9WgXcQ' },
        archiv: [],
      },
    });
    const html = renderSeite(seiteMit([BEISPIELE.livestream('l')]), k);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script:not([src])').length).toBe(0);
    expect(doc.querySelectorAll('[onerror]').length).toBe(0);
    expect(doc.querySelectorAll('style')).toHaveLength(1);
    expect(doc.querySelector('.w-banner')).not.toBeNull();
    for (const a of doc.querySelectorAll('[href]'))
      expect(a.getAttribute('href')).not.toMatch(/^\s*javascript/i);
  });

  it('„Eigenes HTML“ ist die EINZIGE bewusste Ausnahme: unverändert ausgegeben', () => {
    const roh = BOESE + '<script>alert(3)</script>';
    const html = renderSeite(seiteMit([{ typ: 'html', id: 'h', html: roh }]), kontext());
    expect(html).toContain(roh);
  });
});
