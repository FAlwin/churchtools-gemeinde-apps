import { describe, expect, it } from 'vitest';
import {
  FUSSZEILE_MAX,
  einstellungenMeldung,
  formularAnwenden,
  formularAus,
  fusszeileAendern,
  fusszeileEntfernen,
  fusszeileHinzufuegen,
  fusszeileVerschieben,
  neuerLink,
  type EinstellungenFormular,
} from './einstellungen';
import { einstellungenSchema, type Einstellungen, type Link } from './modell';
import { einstellungen, seite } from './website.testdaten';

const SEITEN = [
  seite({ id: 'a', titel: 'Impressum', pfad: 'impressum', startseite: false }),
  seite({ id: 'b', titel: 'Start', pfad: 'start', startseite: true }),
];
const extern = (url: string): Link => ({ art: 'extern', url });
const basis = (o: Partial<Einstellungen> = {}) =>
  einstellungen({
    name: 'ECG',
    fusszeile: [
      { titel: 'Impressum', ziel: { art: 'seite', seiteId: 'a' } },
      { titel: 'Verband', ziel: extern('https://beispiel.de') },
    ],
    ...o,
  });
const titel = (f: EinstellungenFormular) => f.fusszeile.map((l) => l.titel);

describe('formularAus / formularAnwenden', () => {
  it('Hin und zurück ändert nichts – und das Ergebnis besteht das Schema', () => {
    const e = basis({
      datenschutz: { art: 'seite', seiteId: 'a' },
      einwilligung: { youtubeText: 'Eigener Text' },
    });
    const neu = formularAnwenden(e, formularAus(e));
    expect(neu).toEqual(e);
    expect(einstellungenSchema.safeParse(neu).success).toBe(true);
  });

  it('ändert NUR Name, Fußzeile, Datenschutz und Banner-Text – Farben, Schriften, Logo, CSS bleiben', () => {
    const e = basis({
      farben: {
        haupt: '#111111',
        akzent: '#222222',
        grund: '#ffffff',
        sanft: '#eeeeee',
        text: '#000000',
      },
      schriften: {
        text: { art: 'auswahl', name: 'Lora' },
        ueberschrift: { art: 'auswahl', name: 'Lora' },
      },
      eigenesCss: '.w-fuss { color: red }',
      logo: { id: 'logo-1' },
      noindex: false,
      kontaktAdresse: 'https://kontakt.example/senden',
    });
    const neu = formularAnwenden(e, { ...formularAus(e), name: 'Neu', youtubeText: 'Hallo' });
    const { name, einwilligung, ...rest } = neu;
    const { name: _n, einwilligung: _w, ...restAlt } = e;
    expect(name).toBe('Neu');
    expect(einwilligung).toEqual({ youtubeText: 'Hallo' });
    expect(rest).toEqual(restAlt);
  });

  it('leerer Banner-Text nimmt den eigenen Text zurück, ohne Datenschutz-Link fällt das Feld weg', () => {
    const e = basis({
      datenschutz: extern('https://d.example'),
      einwilligung: { youtubeText: 'Alt' },
    });
    const neu = formularAnwenden(e, { ...formularAus(e), youtubeText: '  ', datenschutz: null });
    expect('datenschutz' in neu).toBe(false);
    expect(neu.einwilligung).toBeUndefined();
    expect(einstellungenSchema.safeParse(neu).success).toBe(true);
  });

  it('schneidet Leerzeichen an Name, Titeln, Adressen und Text ab', () => {
    const e = basis();
    const neu = formularAnwenden(e, {
      name: '  ECG  ',
      fusszeile: [{ titel: ' Datenschutz ', ziel: extern('  https://d.example ') }],
      datenschutz: extern(' https://x.example '),
      youtubeText: ' Text ',
    });
    expect(neu.name).toBe('ECG');
    expect(neu.fusszeile).toEqual([{ titel: 'Datenschutz', ziel: extern('https://d.example') }]);
    expect(neu.datenschutz).toEqual(extern('https://x.example'));
    expect(neu.einwilligung?.youtubeText).toBe('Text');
  });
});

describe('Fußzeile: hinzufügen, entfernen, verschieben, ändern', () => {
  const f = formularAus(basis());

  it('hinzufügen hängt hinten einen Link an, der auf die Startseite zeigt', () => {
    const neu = fusszeileHinzufuegen(f, SEITEN);
    expect(neu.fusszeile).toHaveLength(3);
    expect(neu.fusszeile[2]).toEqual({ titel: '', ziel: { art: 'seite', seiteId: 'b' } });
    expect(f.fusszeile).toHaveLength(2); // das Alte bleibt unberührt
  });

  it('Grenze: höchstens so viele Links, wie das Schema erlaubt – die zehnte geht, die elfte nicht', () => {
    let g = { ...f, fusszeile: [] as EinstellungenFormular['fusszeile'] };
    for (let i = 0; i < FUSSZEILE_MAX + 3; i++) g = fusszeileHinzufuegen(g, SEITEN);
    expect(g.fusszeile).toHaveLength(FUSSZEILE_MAX);
    // dieselbe Grenze wie im Schema (nicht nur eine gleich lautende Zahl)
    const gefuellt = formularAnwenden(basis(), {
      ...g,
      fusszeile: g.fusszeile.map((l, i) => ({ ...l, titel: `L${i}` })),
    });
    expect(einstellungenSchema.safeParse(gefuellt).success).toBe(true);
    const zuviel = { ...gefuellt, fusszeile: [...gefuellt.fusszeile, gefuellt.fusszeile[0]] };
    expect(einstellungenSchema.safeParse(zuviel).success).toBe(false);
  });

  it('entfernen nimmt genau den einen weg; ein falscher Index ändert nichts', () => {
    expect(titel(fusszeileEntfernen(f, 0))).toEqual(['Verband']);
    expect(fusszeileEntfernen(f, 5)).toBe(f);
    expect(fusszeileEntfernen(f, -1)).toBe(f);
  });

  it('verschieben tauscht mit dem Nachbarn; am Rand bleibt es, wie es ist', () => {
    expect(titel(fusszeileVerschieben(f, 0, 'runter'))).toEqual(['Verband', 'Impressum']);
    expect(titel(fusszeileVerschieben(f, 1, 'hoch'))).toEqual(['Verband', 'Impressum']);
    expect(fusszeileVerschieben(f, 0, 'hoch')).toBe(f);
    expect(fusszeileVerschieben(f, 1, 'runter')).toBe(f);
  });

  it('ändern ersetzt nur die genannten Felder dieses einen Links', () => {
    const neu = fusszeileAendern(f, 1, { titel: 'Anderer' });
    expect(neu.fusszeile[1]).toEqual({ titel: 'Anderer', ziel: extern('https://beispiel.de') });
    expect(neu.fusszeile[0]).toBe(f.fusszeile[0]);
  });

  it('neuerLink: Seite → Startseite (sonst erste Seite), ohne Seiten eine leere Adresse', () => {
    expect(neuerLink(SEITEN, 'seite')).toEqual({ art: 'seite', seiteId: 'b' });
    expect(neuerLink([SEITEN[0]], 'seite')).toEqual({ art: 'seite', seiteId: 'a' });
    expect(neuerLink([], 'seite')).toEqual(extern(''));
    expect(neuerLink(SEITEN, 'extern')).toEqual(extern(''));
  });
});

describe('einstellungenMeldung', () => {
  it('Einstellungen, die das Schema bestehen: keine Meldung', () => {
    expect(einstellungenMeldung(basis())).toBeNull();
  });

  it('jede Meldung gehört zu einem Fall, den das Schema wirklich ablehnt – und sagt, wo es hakt', () => {
    const fall: [Einstellungen, RegExp][] = [
      [basis({ name: '' }), /Name der Gemeinde/],
      [
        basis({ fusszeile: [{ titel: '', ziel: extern('https://a.example') }] }),
        /Link 1: Der Titel fehlt/,
      ],
      [
        basis({ fusszeile: [{ titel: 'X', ziel: extern('javascript:alert(1)') }] }),
        /Link 1: Erlaubt sind nur Adressen/,
      ],
      [
        basis({ fusszeile: [{ titel: 'X', ziel: extern('') }] }),
        /Link 1: Erlaubt sind nur Adressen/,
      ],
      [
        basis({ fusszeile: [{ titel: 'X', ziel: { art: 'seite', seiteId: '' } }] }),
        /Link 1: Bitte eine Seite/,
      ],
      [basis({ datenschutz: extern('ftp://x') }), /Datenschutz-Link: Erlaubt/],
      [basis({ datenschutz: { art: 'seite', seiteId: '' } }), /Datenschutz-Link: Bitte eine Seite/],
      [basis({ einwilligung: { youtubeText: 'x'.repeat(601) } }), /YouTube-Banners/],
      [
        basis({
          fusszeile: Array.from({ length: FUSSZEILE_MAX + 1 }, (_, i) => ({
            titel: `L${i}`,
            ziel: extern('https://a.example'),
          })),
        }),
        /höchstens 10 Links/,
      ],
    ];
    for (const [e, muster] of fall) {
      expect(einstellungenSchema.safeParse(e).success, muster.source).toBe(false);
      expect(einstellungenMeldung(e), muster.source).toMatch(muster);
    }
  });
});
