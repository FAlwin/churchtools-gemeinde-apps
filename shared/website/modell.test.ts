import { describe, expect, it } from 'vitest';
import {
  abschnitt,
  baustein,
  BEISPIELE,
  ECG_FARBEN,
  einstellungen,
  gestaltung,
  menue,
  seite,
  seiteMit,
  spalte,
} from './website.testdaten';
import {
  abschnittSchema,
  AUFTEILUNGEN,
  BAUSTEIN_TYPEN,
  bausteinSchema,
  einstellungenAlsText,
  einstellungenAusText,
  gestaltungSchema,
  hintergrundSchema,
  istErlaubteAdresse,
  linkSchema,
  menueAlsText,
  menueAusText,
  menueSchema,
  passtInEinenWert,
  pruefeWebsite,
  seiteAlsText,
  seiteAusText,
  seiteSchema,
  spaltenAnzahl,
  STANDARD_GESTALTUNG,
  WEBSITE_KENNUNG,
  WERT_MAX_ZEICHEN,
  type Seite,
} from './modell';

const GEFAEHRLICH = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'JAVASCRIPT:alert(1)',
  ' javascript:alert(1)',
  '\tjavascript:alert(1)',
  '\njavascript:alert(1)',
  '\u0001javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//evil.example',
  '/relativ',
  'https://beispiel.de/mit leerzeichen',
  '',
];

describe('Bausteine', () => {
  it('es gibt alle 15 Typen – und zu jedem ein Beispiel, das das Schema annimmt', () => {
    expect([...BAUSTEIN_TYPEN].sort()).toEqual(Object.keys(BEISPIELE).sort());
    expect(BAUSTEIN_TYPEN).toHaveLength(15);
    for (const typ of BAUSTEIN_TYPEN) {
      expect(bausteinSchema.safeParse(baustein(typ)).success, typ).toBe(true);
    }
  });

  it('Bereichsgrenzen greifen', () => {
    const nein = (b: unknown) => expect(bausteinSchema.safeParse(b).success).toBe(false);
    nein(baustein('ueberschrift', { ebene: 4 as 2 }));
    nein(baustein('ueberschrift', { ebene: 0 as 1 }));
    nein(baustein('ueberschrift', { groesse: 'winzig' as 'normal' }));
    nein(baustein('akzentzeile', { text: '' }));
    nein(baustein('knoepfe', { knoepfe: [] }));
    nein(baustein('html', { html: 'x'.repeat(20_001) }));
    nein(baustein('ueberschrift', { text: '' }));
    nein(baustein('beitraege', { anzahl: 0 }));
    nein(baustein('beitraege', { anzahl: 21 }));
    nein(baustein('termine', { kalender: [] }));
    nein(baustein('termine', { anzahl: 51 }));
    nein(baustein('galerie', { bilder: [] }));
    nein(baustein('livestream', { zeigen: 'nichts' as 'stream' }));
    nein(baustein('bildText', { bildSeite: 'oben' as 'links' }));
    nein({ ...baustein('trenner'), typ: 'unbekannt' });
    // „knopf“ gibt es nicht mehr – nur noch die Reihe „knoepfe“ (1 bis 4)
    nein({ ...baustein('trenner'), typ: 'knopf' });
    const eins = baustein('knoepfe').knoepfe[0];
    expect(bausteinSchema.safeParse(baustein('knoepfe', { knoepfe: [eins] })).success).toBe(true);
    expect(
      bausteinSchema.safeParse(baustein('knoepfe', { knoepfe: [eins, eins, eins, eins] })).success,
    ).toBe(true);
    nein(baustein('knoepfe', { knoepfe: [eins, eins, eins, eins, eins] }));
    expect(bausteinSchema.safeParse(baustein('html', { html: 'x'.repeat(20_000) })).success).toBe(
      true,
    );
    // alt darf leer sein, fehlen darf es nicht
    expect(bausteinSchema.safeParse(baustein('bild', { alt: '' })).success).toBe(true);
    const ohneAlt: Record<string, unknown> = { ...baustein('bild') };
    delete ohneAlt.alt;
    nein(ohneAlt);
  });
});

describe('Link', () => {
  it('erlaubt https, http, mailto, tel und Seiten', () => {
    for (const url of ['https://a.de', 'http://a.de/x?y=1', 'mailto:a@b.de', 'tel:+4922469']) {
      expect(linkSchema.safeParse({ art: 'extern', url }).success, url).toBe(true);
    }
    expect(linkSchema.safeParse({ art: 'seite', seiteId: 'x' }).success).toBe(true);
  });

  it('lehnt gefährliche Adressen ab – auch mit Großbuchstaben, Leerzeichen, Steuerzeichen', () => {
    for (const url of GEFAEHRLICH) {
      expect(linkSchema.safeParse({ art: 'extern', url }).success, JSON.stringify(url)).toBe(false);
      expect(istErlaubteAdresse(url), JSON.stringify(url)).toBe(false);
    }
  });

  it('Sprunglink auf einen Anker: nur ein Slug', () => {
    expect(linkSchema.safeParse({ art: 'anker', anker: 'termine' }).success).toBe(true);
    for (const anker of ['', 'Termine', 'a b', 'a"b', '#x', 'a;b'])
      expect(linkSchema.safeParse({ art: 'anker', anker }).success, anker).toBe(false);
  });

  it('Seite, Menü und Einstellungen übernehmen die Prüfung', () => {
    const boese = { art: 'extern' as const, url: 'javascript:alert(1)' };
    const knopf = baustein('knoepfe', { knoepfe: [{ text: 'x', ziel: boese, art: 'haupt' }] });
    expect(seiteSchema.safeParse(seiteMit([knopf])).success).toBe(false);
    expect(menueSchema.safeParse(menue([{ titel: 'x', ziel: boese }])).success).toBe(false);
    expect(
      menueSchema.safeParse(
        menue([
          {
            titel: 'x',
            ziel: { art: 'seite', seiteId: 'a' },
            unter: [{ titel: 'y', ziel: boese }],
          },
        ]),
      ).success,
    ).toBe(false);
    expect(
      einstellungenAusText(
        WEBSITE_KENNUNG +
          JSON.stringify({ ...einstellungen(), fusszeile: [{ titel: 'x', ziel: boese }] }),
      ).ok,
    ).toBe(false);
  });
});

describe('Seite, Menü, Einstellungen', () => {
  it('Pfad ist ein Slug', () => {
    for (const pfad of ['start', 'unsere-gruppen', 'a1-b2']) {
      expect(seiteSchema.safeParse(seite({ pfad })).success, pfad).toBe(true);
    }
    for (const pfad of ['', 'Gross', 'mit leer', 'a--b', '-a', 'a-', 'ä', 'a/b', '../x']) {
      expect(seiteSchema.safeParse(seite({ pfad })).success, pfad).toBe(false);
    }
  });

  it('das Menü hat höchstens eine Unterebene', () => {
    const ziel = { art: 'seite' as const, seiteId: 'a' };
    const tief = { titel: 'a', ziel, unter: [{ titel: 'b', ziel, unter: [{ titel: 'c', ziel }] }] };
    // zod entfernt unbekannte Felder – deshalb muss die Tiefe am Ergebnis fehlen, nicht am Erfolg.
    const r = menueSchema.parse(menue([tief]));
    expect(r.eintraege[0].unter?.[0]).not.toHaveProperty('unter');
  });

  it('Einstellungen: Sprache hat den Standard „de“, Kontaktadresse nur https/http', () => {
    const { sprache: _weg, ...ohne } = einstellungen();
    void _weg;
    const gelesen = einstellungenAusText(WEBSITE_KENNUNG + JSON.stringify(ohne));
    expect(gelesen.ok && gelesen.wert.sprache).toBe('de');
    for (const kontaktAdresse of ['mailto:a@b.de', 'javascript:alert(1)', 'ftp://x.de']) {
      const r = einstellungenAusText(WEBSITE_KENNUNG + JSON.stringify({ ...ohne, kontaktAdresse }));
      expect(r.ok, kontaktAdresse).toBe(false);
    }
  });
});

describe('Speicherformat', () => {
  const alle = BAUSTEIN_TYPEN.map((t) => baustein(t));
  const grosse = seiteMit(alle);

  it('Hin und zurück: Seite, Menü, Einstellungen', () => {
    const s = seiteAusText(seiteAlsText(grosse));
    expect(s).toEqual({ ok: true, wert: grosse });
    const m = menue([
      {
        titel: 'Start',
        ziel: { art: 'seite', seiteId: grosse.id },
        unter: [{ titel: 'Extern', ziel: { art: 'extern', url: 'https://a.de' } }],
      },
    ]);
    expect(menueAusText(menueAlsText(m))).toEqual({ ok: true, wert: m });
    const e = einstellungen({
      logo: { id: 'logo' },
      fusszeile: [{ titel: 'Impressum', ziel: { art: 'seite', seiteId: 'imp' } }],
      farben: ECG_FARBEN,
      schriften: {
        text: { art: 'auswahl', name: 'Quicksand' },
        ueberschrift: {
          art: 'eigene',
          name: 'Meine Schrift',
          datei: 'asset-1',
          gewichte: '300 700',
        },
      },
      eigenesCss: '.w-knopf { border-radius: 0 }',
      einwilligung: { youtubeText: 'Eigener Text' },
      datenschutz: { art: 'seite', seiteId: 'ds' },
    });
    expect(einstellungenAusText(einstellungenAlsText(e))).toEqual({ ok: true, wert: e });
  });

  it('schreibt das Präfix voran', () => {
    expect(seiteAlsText(seite()).startsWith(WEBSITE_KENNUNG)).toBe(true);
  });

  it('fehlendes oder falsches Präfix', () => {
    const json = JSON.stringify(seite());
    for (const text of [
      json,
      `anmeldung:v1:${json}`,
      `website:${json}`,
      `website:v0:${json}`,
      '',
    ]) {
      const r = seiteAusText(text);
      expect(r.ok, text.slice(0, 20)).toBe(false);
      if (!r.ok) expect(r.fehler).toBe('kein-praefix');
    }
  });

  it('eine neuere Version wird gemeldet, nicht verworfen', () => {
    const r = seiteAusText(`website:v2:${JSON.stringify(seite())}`);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler).toBe('neuere-version');
      expect(r.meldung).toMatch(/neueren Version/);
    }
    const r12 = menueAusText('website:v12:{}');
    expect(!r12.ok && r12.fehler).toBe('neuere-version');
  });

  it('ungültiges JSON und ungültiger Inhalt liefern eine verständliche Meldung statt einer Ausnahme', () => {
    const j = seiteAusText(`${WEBSITE_KENNUNG}{kaputt`);
    expect(!j.ok && j.fehler).toBe('kein-json');
    const u = seiteAusText(
      `${WEBSITE_KENNUNG}${JSON.stringify({ ...seite(), pfad: 'Böse Zeichen' })}`,
    );
    expect(!u.ok && u.fehler).toBe('ungueltig');
    if (!u.ok) expect(u.meldung).toMatch(/pfad/);
  });

  it('die Grenze von 10.000 Zeichen: genau 10.000 passen, 10.001 nicht', () => {
    expect(WERT_MAX_ZEICHEN).toBe(10_000);
    expect(passtInEinenWert('a'.repeat(10_000))).toBe(true);
    expect(passtInEinenWert('a'.repeat(10_001))).toBe(false);
    // Zeichen, nicht Bytes: 10.000 Umlaute sind 20.000 Bytes und passen trotzdem.
    expect(passtInEinenWert('ä'.repeat(10_000))).toBe(true);
    // am Erzeuger: ein Text, der genau auf die Grenze aufgefüllt ist
    const basis = seiteAlsText(seiteMit([baustein('text', { markdown: '' })]));
    const fuell = 'x'.repeat(WERT_MAX_ZEICHEN - basis.length);
    const genau = seiteAlsText(seiteMit([baustein('text', { markdown: fuell })]));
    expect(genau).toHaveLength(WERT_MAX_ZEICHEN);
    expect(passtInEinenWert(genau)).toBe(true);
    expect(
      passtInEinenWert(seiteAlsText(seiteMit([baustein('text', { markdown: `${fuell}x` })]))),
    ).toBe(false);
  });
});

describe('pruefeWebsite', () => {
  const start = seite();
  const zwei = seite({ id: 'seite-2', titel: 'Zweite', pfad: 'zweite', startseite: undefined });
  const art = (s: Seite[], m = menue(), e = einstellungen()) =>
    pruefeWebsite(s, m, e).map((h) => h.art);

  it('ein sauberer Stand hat keine Hinweise', () => {
    const m = menue([{ titel: 'Zweite', ziel: { art: 'seite', seiteId: zwei.id } }]);
    expect(pruefeWebsite([start, zwei], m, einstellungen())).toEqual([]);
  });

  it('keine Startseite', () => {
    expect(art([{ ...start, startseite: false }, zwei])).toEqual(['startseite']);
  });

  it('zwei Startseiten', () => {
    expect(art([start, { ...zwei, startseite: true }])).toEqual(['startseite']);
  });

  it('doppelter Pfad, doppelte Seiten-ID, doppelte Baustein-ID', () => {
    expect(art([start, { ...zwei, pfad: start.pfad }])).toEqual(['pfad']);
    expect(art([start, { ...zwei, id: start.id }])).toEqual(['id']);
    const doppelt = seiteMit([baustein('trenner'), baustein('trenner')]);
    expect(art([doppelt])).toEqual(['id']);
  });

  it('toter Link in Menü, Unterpunkt, Knopf und Fußzeile', () => {
    const tot = { art: 'seite' as const, seiteId: 'gibt-es-nicht' };
    expect(art([start], menue([{ titel: 'x', ziel: tot }]))).toEqual(['link']);
    expect(
      art(
        [start],
        menue([
          {
            titel: 'x',
            ziel: { art: 'seite', seiteId: start.id },
            unter: [{ titel: 'y', ziel: tot }],
          },
        ]),
      ),
    ).toEqual(['link']);
    const knopf = baustein('knoepfe', { knoepfe: [{ text: 'x', ziel: tot, art: 'haupt' }] });
    expect(art([seiteMit([knopf])])).toEqual(['link']);
    expect(
      art([start], menue(), einstellungen({ fusszeile: [{ titel: 'Impressum', ziel: tot }] })),
    ).toEqual(['link']);
    // externe Links sind nie „tot“
    expect(
      art([start], menue([{ titel: 'x', ziel: { art: 'extern', url: 'https://a.de' } }])),
    ).toEqual([]);
  });

  it('die Meldungen sind deutsch und nennen die Stelle', () => {
    const h = pruefeWebsite(
      [start],
      menue([{ titel: 'Gruppen', ziel: { art: 'seite', seiteId: 'weg' } }]),
      einstellungen(),
    );
    expect(h[0].meldung).toContain('Gruppen');
  });
});

describe('Abschnitt, Spalten, Gestaltung', () => {
  /** Ein Abschnitt mit der Aufteilung und genau so vielen Spalten, wie sie verlangt. */
  const passend = (aufteilung: (typeof AUFTEILUNGEN)[number]) =>
    abschnitt([], {
      aufteilung,
      spalten: Array.from({ length: spaltenAnzahl(aufteilung) }, (_, i) =>
        spalte([], { id: `s-${i}` }),
      ),
    });

  it('jede Aufteilung nimmt genau ihre Spaltenzahl an – eine Spalte mehr oder weniger nicht', () => {
    const erwartet = { '1': 1, '1-1': 2, '2-1': 2, '1-2': 2, '1-1-1': 3, '1-1-1-1': 4 };
    for (const a of AUFTEILUNGEN) {
      expect(spaltenAnzahl(a), a).toBe(erwartet[a]);
      expect(abschnittSchema.safeParse(passend(a)).success, a).toBe(true);
      const zuWenig = passend(a);
      zuWenig.spalten = zuWenig.spalten.slice(0, -1);
      const zuViel = passend(a);
      zuViel.spalten = [...zuViel.spalten, spalte([], { id: 'extra' })];
      expect(abschnittSchema.safeParse(zuWenig).success, `${a} mit einer Spalte weniger`).toBe(
        false,
      );
      expect(abschnittSchema.safeParse(zuViel).success, `${a} mit einer Spalte mehr`).toBe(false);
    }
  });

  it('die Meldung bei falscher Spaltenzahl ist verständlich und nennt Soll und Ist', () => {
    const r = abschnittSchema.safeParse(abschnitt([], { aufteilung: '1-1-1' }));
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues[0].message).toBe(
        'Die Aufteilung „1-1-1“ braucht 3 Spalten, es sind aber 1.',
      );
    const eine = abschnittSchema.safeParse(
      abschnitt([], { aufteilung: '1', spalten: [spalte(), spalte([], { id: 's-2' })] }),
    );
    expect(!eine.success && eine.error.issues[0].message).toMatch(/braucht 1 Spalte,/);
  });

  it('unbekannte Aufteilung, keine Spalte und mehr als vier Spalten sind ungültig', () => {
    expect(abschnittSchema.safeParse({ ...abschnitt(), aufteilung: '3-1' }).success).toBe(false);
    expect(abschnittSchema.safeParse({ ...abschnitt(), spalten: [] }).success).toBe(false);
    const fuenf = Array.from({ length: 5 }, (_, i) => spalte([], { id: `s${i}` }));
    expect(abschnittSchema.safeParse({ ...abschnitt(), spalten: fuenf }).success).toBe(false);
  });

  it('Hex-Farben: nur #rgb und #rrggbb – nichts, was CSS einschleusen könnte', () => {
    const farbe = (f: string) => hintergrundSchema.safeParse({ art: 'farbe', farbe: f }).success;
    for (const ok of ['#fff', '#FFF', '#00616e', '#aBc123']) expect(farbe(ok), ok).toBe(true);
    for (const boese of [
      'red',
      '#12345g',
      '#fff;}body{',
      '#ffff',
      '#fffff',
      '#fffffff',
      'fff',
      '#fff ',
      ' #fff',
      '#fff\n',
      'rgb(0,0,0)',
      'url(x)',
      '',
    ])
      expect(farbe(boese), JSON.stringify(boese)).toBe(false);
    // …und dieselbe Prüfung gilt für die Farben der Gemeinde
    const mit = (haupt: string) =>
      einstellungenAusText(
        WEBSITE_KENNUNG + JSON.stringify({ ...einstellungen(), farben: { ...ECG_FARBEN, haupt } }),
      ).ok;
    expect(mit('#00616e')).toBe(true);
    for (const boese of ['red', '#12345g', '#fff;}body{']) expect(mit(boese), boese).toBe(false);
  });

  it('Abdunkeln: ganze Zahl von 0 bis 90', () => {
    const bild = (abdunkeln: number) =>
      hintergrundSchema.safeParse({ art: 'bild', bild: { id: 'x' }, abdunkeln }).success;
    expect(bild(0)).toBe(true);
    expect(bild(90)).toBe(true);
    for (const n of [-1, 91, 55.5, Number.NaN]) expect(bild(n), String(n)).toBe(false);
  });

  it('Gestaltung: jede Option hat ihre Grenzen, der Anker ist ein freier Slug', () => {
    const nein = (o: object) =>
      expect(gestaltungSchema.safeParse({ ...STANDARD_GESTALTUNG, ...o }).success).toBe(false);
    nein({ text: 'rot' });
    nein({ abstand: 'riesig' });
    nein({ breite: 'halb' });
    nein({ ausrichtung: 'rechts' });
    nein({ senkrecht: 'unten' });
    nein({ hoehe: 'doppelt' });
    nein({ hintergrund: { art: 'blau' } });
    for (const anker of ['termine', 'a-b-1']) {
      const r = gestaltungSchema.safeParse({ ...STANDARD_GESTALTUNG, anker });
      expect(r.success, anker).toBe(true);
    }
    for (const anker of ['', 'Termine', 'a b', 'a"b', 'inhalt', 'w-nav', 'w-banner-titel'])
      nein({ anker });
    expect(gestaltungSchema.safeParse(gestaltung()).success).toBe(true);
  });

  it('Spalte: eigener Hintergrund und „auf dem Handy zuerst“ sind erlaubt', () => {
    const a = abschnitt([], {
      aufteilung: '1-1',
      spalten: [
        spalte([], { id: 'l', hintergrund: { art: 'haupt' } }),
        spalte([], { id: 'r', handyZuerst: true }),
      ],
    });
    expect(abschnittSchema.safeParse(a).success).toBe(true);
    const kaputt = abschnitt([], {
      spalten: [spalte([], { hintergrund: { art: 'farbe', farbe: 'red' } })],
    });
    expect(abschnittSchema.safeParse(kaputt).success).toBe(false);
  });

  it('die Seite braucht Abschnitte statt Bausteine', () => {
    const alt = { ...seite(), bausteine: [] } as Record<string, unknown>;
    delete alt.abschnitte;
    expect(seiteSchema.safeParse(alt).success).toBe(false);
    expect(seiteSchema.safeParse(seite()).success).toBe(true);
  });
});

describe('Einstellungen: Farben, Schriften, eigenes CSS, Einwilligung', () => {
  const lesen = (zusatz: object) =>
    einstellungenAusText(WEBSITE_KENNUNG + JSON.stringify({ ...einstellungen(), ...zusatz }));

  it('alles Neue ist optional – ein Stand von vor W1b bleibt lesbar', () => {
    expect(lesen({}).ok).toBe(true);
  });

  it('Farben: hauptTief darf fehlen, alle anderen sind Pflicht', () => {
    const { hauptTief: _weg, ...ohne } = ECG_FARBEN;
    void _weg;
    expect(lesen({ farben: ohne }).ok).toBe(true);
    const { akzent: _a, ...ohneAkzent } = ECG_FARBEN;
    void _a;
    expect(lesen({ farben: ohneAkzent }).ok).toBe(false);
  });

  it('Schriften: aus der Auswahl nur bekannte, eigene nur mit sicherem Namen', () => {
    const wahl = (text: object) => lesen({ schriften: { text, ueberschrift: text } }).ok;
    expect(wahl({ art: 'auswahl', name: 'Quicksand' })).toBe(true);
    expect(wahl({ art: 'auswahl', name: 'Comic Sans' })).toBe(false);
    expect(wahl({ art: 'eigene', name: 'Meine Schrift-2', datei: 'asset-1' })).toBe(true);
    expect(wahl({ art: 'eigene', name: 'Meine Schrift-2', datei: 'a', gewichte: '300 700' })).toBe(
      true,
    );
    for (const name of ['x;}body{', "a'b", 'a\\b', 'a</style>', 'a"b', 'a{b', '', ' ', '-x'])
      expect(wahl({ art: 'eigene', name, datei: 'asset-1' }), JSON.stringify(name)).toBe(false);
    for (const gewichte of ['bold', '400;}', '1000', '300-700', '400 700 900'])
      expect(wahl({ art: 'eigene', name: 'Ok', datei: 'a', gewichte }), gewichte).toBe(false);
    expect(wahl({ art: 'eigene', name: 'Ok', datei: '' })).toBe(false);
  });

  it('eigenes CSS und Banner-Text haben Grenzen', () => {
    expect(lesen({ eigenesCss: 'a'.repeat(20_000) }).ok).toBe(true);
    expect(lesen({ eigenesCss: 'a'.repeat(20_001) }).ok).toBe(false);
    expect(lesen({ einwilligung: { youtubeText: 'Hallo' } }).ok).toBe(true);
    expect(lesen({ einwilligung: { youtubeText: '' } }).ok).toBe(false);
  });

  it('Datenschutz-Link nutzt dieselbe Link-Prüfung', () => {
    expect(lesen({ datenschutz: { art: 'extern', url: 'https://a.de/datenschutz' } }).ok).toBe(
      true,
    );
    expect(lesen({ datenschutz: { art: 'extern', url: 'javascript:alert(1)' } }).ok).toBe(false);
  });
});

describe('pruefeWebsite: Abschnitte, Spalten, Anker', () => {
  const art = (s: Seite[], m = menue(), e = einstellungen()) =>
    pruefeWebsite(s, m, e).map((h) => h.art);

  it('doppelte Anker auf einer Seite – auf verschiedenen Seiten ist derselbe Anker in Ordnung', () => {
    const mitAnker = (id: string, anker: string) =>
      abschnitt([], {
        id,
        spalten: [spalte([], { id: `s-${id}` })],
        gestaltung: gestaltung({ anker }),
      });
    const doppelt = seite({ abschnitte: [mitAnker('a1', 'termine'), mitAnker('a2', 'termine')] });
    const h = pruefeWebsite([doppelt], menue(), einstellungen());
    expect(h.map((x) => x.art)).toEqual(['anker']);
    expect(h[0].meldung).toContain('„termine“');
    expect(h[0].meldung).toContain('Startseite');
    const verschieden = seite({
      abschnitte: [mitAnker('a1', 'termine'), mitAnker('a2', 'gruppen')],
    });
    expect(art([verschieden])).toEqual([]);
    const andere = seite({
      id: 'zwei',
      titel: 'Zwei',
      pfad: 'zwei',
      startseite: undefined,
      abschnitte: [mitAnker('a1', 'termine')],
    });
    expect(art([seite({ abschnitte: [mitAnker('a1', 'termine')] }), andere])).toEqual([]);
  });

  it('doppelte IDs über Abschnitte, Spalten und Bausteine hinweg (ein Namensraum je Seite)', () => {
    const a = abschnitt([baustein('trenner', { id: 'x' })], { id: 'a1' });
    // Baustein-ID = Spalten-ID
    const spalteGleich = abschnitt([baustein('trenner', { id: 's-1' })], { id: 'a1' });
    expect(art([seite({ abschnitte: [spalteGleich] })])).toEqual(['id']);
    // Baustein-ID = Abschnitt-ID
    const abschnittGleich = abschnitt([baustein('trenner', { id: 'a1' })], { id: 'a1' });
    expect(art([seite({ abschnitte: [abschnittGleich] })])).toEqual(['id']);
    // gleiche Baustein-ID in zwei Abschnitten
    const b = abschnitt([baustein('trenner', { id: 'x' })], {
      id: 'a2',
      spalten: [spalte([baustein('trenner', { id: 'x' })], { id: 's-2' })],
    });
    expect(art([seite({ abschnitte: [a, b] })])).toEqual(['id']);
    // gleiche Spalten-ID in zwei Abschnitten
    const c = abschnitt([], { id: 'a3', spalten: [spalte([], { id: 's-1' })] });
    const d = abschnitt([], { id: 'a4', spalten: [spalte([], { id: 's-1' })] });
    expect(art([seite({ abschnitte: [c, d] })])).toEqual(['id']);
    // alles verschieden → in Ordnung
    const e = abschnitt([baustein('trenner', { id: 'y' })], {
      id: 'a5',
      spalten: [spalte([baustein('trenner', { id: 'y2' })], { id: 's-5' })],
    });
    expect(art([seite({ abschnitte: [a, e] })])).toEqual([]);
  });

  it('tote Links in Knöpfen in jeder Spalte jedes Abschnitts', () => {
    const tot = { art: 'seite' as const, seiteId: 'weg' };
    const knopf = baustein('knoepfe', { knoepfe: [{ text: 'Tot', ziel: tot, art: 'haupt' }] });
    const tief = abschnitt([], {
      id: 'a-2',
      aufteilung: '1-1',
      spalten: [spalte([], { id: 's-3' }), spalte([knopf], { id: 's-4' })],
    });
    expect(art([seite({ abschnitte: [abschnitt(), tief] })])).toEqual(['link']);
    // der zweite Knopf einer Reihe zählt auch
    const ok = { art: 'seite' as const, seiteId: 'seite-start' };
    const zweiter = baustein('knoepfe', {
      knoepfe: [
        { text: 'Gut', ziel: ok, art: 'haupt' },
        { text: 'Tot', ziel: tot, art: 'neben' },
      ],
    });
    const meldung = pruefeWebsite([seiteMit([zweiter])], menue(), einstellungen());
    expect(meldung).toHaveLength(1);
    expect(meldung[0].meldung).toContain('Tot');
  });

  it('Sprunglinks müssen einen Anker auf derselben Seite treffen', () => {
    const sprung = (anker: string) =>
      baustein('knoepfe', {
        knoepfe: [{ text: 'Springe', ziel: { art: 'anker', anker }, art: 'haupt' }],
      });
    const mit = (anker: string) =>
      seite({
        abschnitte: [
          abschnitt([sprung(anker)], { id: 'a1' }),
          abschnitt([], {
            id: 'a2',
            spalten: [spalte([], { id: 's-2' })],
            gestaltung: gestaltung({ anker: 'termine' }),
          }),
        ],
      });
    expect(art([mit('termine')])).toEqual([]);
    expect(art([mit('gibt-es-nicht')])).toEqual(['link']);
    // im Menü gibt es keine „eigene Seite“, zu der ein Sprunglink gehören könnte
    expect(
      art([mit('termine')], menue([{ titel: 'x', ziel: { art: 'anker', anker: 'termine' } }])),
    ).toEqual(['link']);
  });

  it('Livestream ohne Datenschutz-Link wird gemeldet', () => {
    const mitStream = seiteMit([baustein('livestream')]);
    const h = pruefeWebsite([mitStream], menue(), einstellungen());
    expect(h.map((x) => x.art)).toEqual(['link']);
    expect(h[0].meldung).toContain('Datenschutz');
    const ds = einstellungen({ datenschutz: { art: 'extern', url: 'https://a.de/ds' } });
    expect(pruefeWebsite([mitStream], menue(), ds)).toEqual([]);
    // der Datenschutz-Link selbst wird auf tote Seiten geprüft
    const tot = einstellungen({ datenschutz: { art: 'seite', seiteId: 'weg' } });
    expect(art([mitStream], menue(), tot)).toEqual(['link']);
    // ohne Livestream braucht niemand den Link
    expect(pruefeWebsite([seite()], menue(), einstellungen())).toEqual([]);
  });
});
