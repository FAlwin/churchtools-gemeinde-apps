import { describe, expect, it } from 'vitest';
import { baustein, BEISPIELE, einstellungen, menue, seite } from './bauhilfen';
import {
  BAUSTEIN_TYPEN,
  bausteinSchema,
  einstellungenAlsText,
  einstellungenAusText,
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
  it('es gibt alle 13 Typen aus dem Bauplan – und zu jedem ein Beispiel, das das Schema annimmt', () => {
    expect([...BAUSTEIN_TYPEN].sort()).toEqual(Object.keys(BEISPIELE).sort());
    expect(BAUSTEIN_TYPEN).toHaveLength(13);
    for (const typ of BAUSTEIN_TYPEN) {
      expect(bausteinSchema.safeParse(baustein(typ)).success, typ).toBe(true);
    }
  });

  it('Bereichsgrenzen greifen', () => {
    const nein = (b: unknown) => expect(bausteinSchema.safeParse(b).success).toBe(false);
    nein(baustein('ueberschrift', { ebene: 4 as 2 }));
    nein(baustein('ueberschrift', { text: '' }));
    nein(baustein('beitraege', { anzahl: 0 }));
    nein(baustein('beitraege', { anzahl: 21 }));
    nein(baustein('termine', { kalender: [] }));
    nein(baustein('termine', { anzahl: 51 }));
    nein(baustein('galerie', { bilder: [] }));
    nein(baustein('livestream', { zeigen: 'nichts' as 'stream' }));
    nein(baustein('bildText', { bildSeite: 'oben' as 'links' }));
    nein({ ...baustein('trenner'), typ: 'unbekannt' });
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

  it('Seite, Menü und Einstellungen übernehmen die Prüfung', () => {
    const boese = { art: 'extern' as const, url: 'javascript:alert(1)' };
    const knopf = baustein('knopf', { ziel: boese });
    expect(seiteSchema.safeParse(seite({ bausteine: [knopf] })).success).toBe(false);
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
  const grosse = seite({ bausteine: alle });

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
    const basis = seiteAlsText(seite({ bausteine: [baustein('text', { markdown: '' })] }));
    const fuell = 'x'.repeat(WERT_MAX_ZEICHEN - basis.length);
    const genau = seiteAlsText(seite({ bausteine: [baustein('text', { markdown: fuell })] }));
    expect(genau).toHaveLength(WERT_MAX_ZEICHEN);
    expect(passtInEinenWert(genau)).toBe(true);
    expect(
      passtInEinenWert(
        seiteAlsText(seite({ bausteine: [baustein('text', { markdown: `${fuell}x` })] })),
      ),
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
    const doppelt = seite({ bausteine: [baustein('trenner'), baustein('trenner')] });
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
    expect(art([seite({ bausteine: [baustein('knopf', { ziel: tot })] })])).toEqual(['link']);
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
